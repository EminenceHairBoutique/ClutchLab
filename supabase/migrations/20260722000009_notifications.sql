-- ClutchLab: notifications (spec §5.18, §9).
--
-- Granular, strictly OPT-IN preferences (nothing fires unless the user turned
-- that kind on), an in-app inbox written only by the server, and web-push
-- subscriptions per device. Kinds mirror the §5.18 list exactly.

create type public.notification_kind as enum (
  'new_version', 'new_season', 'weapon_changed', 'attachment_changed', 'pro_updated',
  'profile_stale', 'ultimate_royale_start', 'ranked_arena_start', 'daily_training',
  'weekly_report', 'coach_response', 'community_reply');

create table public.notification_preferences (
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind public.notification_kind not null,
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, kind)
);

create trigger notification_preferences_updated_at
  before update on public.notification_preferences
  for each row execute function public.set_updated_at();

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind public.notification_kind not null,
  title text not null check (char_length(title) between 1 and 140),
  body text not null check (char_length(body) between 1 and 500),
  link_path text check (link_path is null or link_path ~ '^/'),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- RLS: everything here is strictly the owner's.
alter table public.notification_preferences enable row level security;
create policy notification_preferences_owner_select on public.notification_preferences
  for select using (user_id = auth.uid());
create policy notification_preferences_owner_insert on public.notification_preferences
  for insert with check (user_id = auth.uid());
create policy notification_preferences_owner_update on public.notification_preferences
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notification_preferences_owner_delete on public.notification_preferences
  for delete using (user_id = auth.uid());

alter table public.notifications enable row level security;
create policy notifications_owner_select on public.notifications
  for select using (user_id = auth.uid());
-- Inbox writes are server-side only (service role): users cannot forge
-- notifications, and reads/updates stay scoped to the owner.
create policy notifications_owner_update on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_owner_delete on public.notifications
  for delete using (user_id = auth.uid());

alter table public.push_subscriptions enable row level security;
create policy push_subscriptions_owner_select on public.push_subscriptions
  for select using (user_id = auth.uid());
create policy push_subscriptions_owner_insert on public.push_subscriptions
  for insert with check (user_id = auth.uid());
create policy push_subscriptions_owner_delete on public.push_subscriptions
  for delete using (user_id = auth.uid());
