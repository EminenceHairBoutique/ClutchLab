-- ClutchLab Phase 8: billing polish + coach marketplace (spec §5.17, §14).
--
-- Money model: bookings are the human workflow; marketplace_orders are the
-- ledger (amount = platform fee + coach net, enforced by CHECK). Order rows
-- are written by the server/payment webhooks only. Coaches NEVER get game
-- credentials — stated in UI, moderated in reviews, and no schema field even
-- exists to store them.

alter table public.subscriptions
  add column cancel_at_period_end boolean not null default false;

create type public.coach_service_kind as enum
  ('clip_review', 'full_match_review', 'sensitivity_calibration', 'control_layout_review',
   'ultimate_royale_prep', 'squad_vod_review', 'map_strategy');
create type public.booking_status as enum
  ('requested', 'accepted', 'declined', 'delivered', 'completed', 'canceled', 'disputed');
create type public.order_status as enum ('pending_payment', 'paid', 'refunded', 'disputed');
create type public.payout_status as enum ('not_due', 'pending', 'paid');

create table public.coach_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 3 and 60),
  headline text check (char_length(headline) <= 120),
  bio text check (char_length(bio) <= 2000),
  region text,
  languages text[] not null default '{}',
  credentials text check (char_length(credentials) <= 1000),
  availability_note text check (char_length(availability_note) <= 300),
  -- Editor-verified credentials; protected by trigger below.
  verified boolean not null default false,
  accepting_bookings boolean not null default false,
  data_status public.data_status not null default 'unverified',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.coach_services (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coach_profiles (user_id) on delete cascade,
  kind public.coach_service_kind not null,
  title text not null check (char_length(title) between 3 and 120),
  description text check (char_length(description) <= 2000),
  price_cents integer not null check (price_cents between 100 and 100000),
  currency text not null default 'usd' check (currency in ('usd', 'eur')),
  delivery_days smallint not null default 3 check (delivery_days between 1 and 30),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (coach_id, kind, title)
);
create index coach_services_coach_idx on public.coach_services (coach_id, active);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.coach_services (id) on delete restrict,
  coach_id uuid not null references public.coach_profiles (user_id) on delete cascade,
  player_id uuid not null references public.profiles (id) on delete cascade,
  status public.booking_status not null default 'requested',
  note text check (char_length(note) <= 1000),
  deliverable text check (char_length(deliverable) <= 8000),
  responded_at timestamptz,
  delivered_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (coach_id <> player_id)
);
create index bookings_coach_idx on public.bookings (coach_id, status, created_at desc);
create index bookings_player_idx on public.bookings (player_id, created_at desc);

create table public.marketplace_orders (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings (id) on delete cascade,
  player_id uuid not null references public.profiles (id) on delete cascade,
  coach_id uuid not null references public.coach_profiles (user_id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'usd',
  platform_fee_cents integer not null check (platform_fee_cents >= 0),
  coach_net_cents integer not null check (coach_net_cents >= 0),
  status public.order_status not null default 'pending_payment',
  stripe_payment_intent_id text,
  payout_status public.payout_status not null default 'not_due',
  paid_at timestamptz,
  refunded_at timestamptz,
  payout_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (platform_fee_cents + coach_net_cents = amount_cents)
);
create index marketplace_orders_payout_idx on public.marketplace_orders (status, payout_status);

create table public.coach_reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings (id) on delete cascade,
  coach_id uuid not null references public.coach_profiles (user_id) on delete cascade,
  player_id uuid not null references public.profiles (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  body text check (char_length(body) <= 1000),
  created_at timestamptz not null default now()
);
create index coach_reviews_coach_idx on public.coach_reviews (coach_id, created_at desc);

-- updated_at triggers for the new tables
do $$
declare
  t text;
begin
  foreach t in array array['coach_profiles', 'coach_services', 'bookings', 'marketplace_orders']
  loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      t || '_updated_at', t
    );
  end loop;
end;
$$;

-- Verification is an editorial act: only editor+ may flip coach_profiles.verified.
create or replace function public.protect_coach_verification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.verified is distinct from old.verified and not public.has_role_at_least('editor') then
    raise exception 'only editors can change coach verification'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger coach_profiles_protect_verified
  before update on public.coach_profiles
  for each row execute function public.protect_coach_verification();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.coach_profiles enable row level security;
-- Directory shows verified coaches; owners and editors see drafts too.
create policy coach_profiles_select on public.coach_profiles
  for select using (
    verified = true or user_id = auth.uid() or public.has_role_at_least('editor')
  );
create policy coach_profiles_insert_own on public.coach_profiles
  for insert with check (user_id = auth.uid());
create policy coach_profiles_update_own on public.coach_profiles
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy coach_profiles_update_editor on public.coach_profiles
  for update using (public.has_role_at_least('editor'))
  with check (public.has_role_at_least('editor'));

alter table public.coach_services enable row level security;
create policy coach_services_select on public.coach_services
  for select using (
    (active = true and exists (
      select 1 from public.coach_profiles p
      where p.user_id = coach_id and p.verified = true
    ))
    or coach_id = auth.uid()
    or public.has_role_at_least('editor')
  );
create policy coach_services_insert_own on public.coach_services
  for insert with check (coach_id = auth.uid());
create policy coach_services_update_own on public.coach_services
  for update using (coach_id = auth.uid()) with check (coach_id = auth.uid());
create policy coach_services_delete_own on public.coach_services
  for delete using (coach_id = auth.uid());

alter table public.bookings enable row level security;
-- Participants only; nobody else can even see a booking exists.
create policy bookings_select_participants on public.bookings
  for select using (player_id = auth.uid() or coach_id = auth.uid());
-- Players request bookings against active services of verified, accepting coaches.
create policy bookings_insert_player on public.bookings
  for insert with check (
    player_id = auth.uid()
    and status = 'requested'
    and exists (
      select 1
      from public.coach_services s
      join public.coach_profiles p on p.user_id = s.coach_id
      where s.id = service_id
        and s.coach_id = bookings.coach_id
        and s.active = true
        and p.verified = true
        and p.accepting_bookings = true
    )
  );
-- Workflow transitions stay with the participants (state machine in app layer).
create policy bookings_update_participants on public.bookings
  for update using (player_id = auth.uid() or coach_id = auth.uid())
  with check (player_id = auth.uid() or coach_id = auth.uid());

alter table public.marketplace_orders enable row level security;
-- Ledger reads for participants; admins see all (payout workflow).
create policy marketplace_orders_select_participants on public.marketplace_orders
  for select using (
    player_id = auth.uid() or coach_id = auth.uid() or public.is_admin()
  );
create policy marketplace_orders_update_admin on public.marketplace_orders
  for update using (public.is_admin()) with check (public.is_admin());
-- inserts + payment status changes via server/service role (webhooks) only

alter table public.coach_reviews enable row level security;
-- Reviews are public content on verified coaches.
create policy coach_reviews_select on public.coach_reviews for select using (true);
-- Only the player of a COMPLETED booking may review it, once (unique booking_id).
create policy coach_reviews_insert_player on public.coach_reviews
  for insert with check (
    player_id = auth.uid()
    and exists (
      select 1 from public.bookings b
      where b.id = booking_id
        and b.player_id = auth.uid()
        and b.coach_id = coach_reviews.coach_id
        and b.status = 'completed'
    )
  );
