-- ClutchLab Phase 1: identity, roles, device knowledge base, subscription stub, audit log.
-- Supabase-compatible: relies on auth.users / auth.uid() (provided by Supabase in
-- production and by supabase/tests/harness/auth_shim.sql in the local test harness).
--
-- Spec references: §9 (identity tables), §13 (roles), §0.1.8 + §2.2 (data_status and
-- source columns live in the database), CLAUDE.md hard rule: RLS on every user-owned table.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.data_status as enum ('verified', 'unverified', 'sample');
create type public.plan_tier as enum ('free', 'pro', 'elite');
create type public.subscription_status as enum
  ('active', 'trialing', 'past_due', 'canceled', 'incomplete');
create type public.form_factor as enum ('phone', 'tablet');
create type public.gyro_quality as enum
  ('none', 'poor', 'average', 'good', 'excellent', 'unknown');
create type public.dominant_hand as enum ('left', 'right', 'ambidextrous');
create type public.grip_style as enum
  ('thumbs', 'claw_3', 'claw_4', 'claw_5', 'claw_6', 'hybrid', 'other');

-- ---------------------------------------------------------------------------
-- Shared trigger: keep updated_at current
-- ---------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles — 1:1 with auth.users, auto-created on signup
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text unique check (handle ~ '^[a-z0-9_]{3,20}$'),
  display_name text check (char_length(display_name) between 1 and 40),
  bio text check (char_length(bio) <= 280),
  region text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- devices — admin-extendable device knowledge base (spec §5.1)
-- Unknown values stay NULL: never invent touch sampling rates or FPS tiers.
-- ---------------------------------------------------------------------------

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  manufacturer text not null,
  model text not null,
  marketing_name text,
  form_factor public.form_factor not null,
  os text not null check (os in ('ios', 'android')),
  screen_inches numeric(4, 2) check (screen_inches between 3 and 20),
  aspect_ratio text,
  refresh_rate_hz smallint check (refresh_rate_hz between 30 and 480),
  touch_sampling_hz smallint check (touch_sampling_hz between 30 and 2000),
  max_supported_fps smallint check (max_supported_fps between 20 and 240),
  gyro_quality public.gyro_quality not null default 'unknown',
  data_status public.data_status not null default 'unverified',
  source_name text,
  source_url text,
  source_date date,
  last_verified_at date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (manufacturer, model)
);

create trigger devices_updated_at
  before update on public.devices
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- user_devices
-- ---------------------------------------------------------------------------

create table public.user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  device_id uuid not null references public.devices (id) on delete restrict,
  is_primary boolean not null default false,
  -- user-measured corrections to KB values (e.g. actual fps tier on their unit)
  overrides jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, device_id)
);

create unique index user_devices_one_primary
  on public.user_devices (user_id)
  where is_primary;

-- ---------------------------------------------------------------------------
-- player_profiles — mechanics + onboarding subset (spec §5.1)
-- ---------------------------------------------------------------------------

create table public.player_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  edition text,
  game_version text,
  finger_count smallint check (finger_count between 2 and 6),
  dominant_hand public.dominant_hand,
  grip_style public.grip_style,
  hand_size text check (hand_size in ('small', 'medium', 'large')),
  current_rank text,
  preferred_perspective text check (preferred_perspective in ('tpp', 'fpp', 'both')),
  primary_role text,
  gyro_mode text check (gyro_mode in ('off', 'scope_on', 'always_on')),
  aim_assist_pref text check (aim_assist_pref in ('on', 'off', 'mixed', 'undecided')),
  training_minutes_per_day smallint check (training_minutes_per_day between 0 and 600),
  competitive_goal text,
  weaknesses text[] not null default '{}',
  favorite_weapons text[] not null default '{}',
  favorite_scopes text[] not null default '{}',
  main_modes text[] not null default '{}',
  preferred_maps text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger player_profiles_updated_at
  before update on public.player_profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- player_goals
-- ---------------------------------------------------------------------------

create table public.player_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  detail text,
  target_date date,
  achieved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index player_goals_user_idx on public.player_goals (user_id);

create trigger player_goals_updated_at
  before update on public.player_goals
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- user_preferences
-- ---------------------------------------------------------------------------

create table public.user_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  notifications jsonb not null default '{}'::jsonb,
  reduced_motion boolean not null default false,
  updated_at timestamptz not null default now()
);

create trigger user_preferences_updated_at
  before update on public.user_preferences
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- roles / permissions (spec §13) — grants managed server-side only
-- ---------------------------------------------------------------------------

create table public.roles (
  slug text primary key check (slug ~ '^[a-z_]{3,30}$'),
  name text not null,
  description text,
  -- ordering for "at least X" checks; higher = more privileged
  rank smallint not null unique
);

create table public.permissions (
  slug text primary key check (slug ~ '^[a-z_.]{3,60}$'),
  description text
);

create table public.role_permissions (
  role_slug text not null references public.roles (slug) on delete cascade,
  permission_slug text not null references public.permissions (slug) on delete cascade,
  primary key (role_slug, permission_slug)
);

create table public.user_roles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  role_slug text not null references public.roles (slug) on delete cascade,
  granted_by uuid references public.profiles (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role_slug)
);

-- ---------------------------------------------------------------------------
-- Role helpers. SECURITY DEFINER so RLS policies on user_roles can call them
-- without recursing into themselves (owner bypasses RLS, as on Supabase).
-- ---------------------------------------------------------------------------

create function public.has_role(required_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role_slug = required_role
  );
$$;

create function public.has_role_at_least(required_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.slug = ur.role_slug
    where ur.user_id = auth.uid()
      and r.rank >= (select rank from public.roles where slug = required_role)
  );
$$;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role_at_least('admin');
$$;

-- ---------------------------------------------------------------------------
-- subscriptions — entitlement source of record (stub until Phase 8 Stripe wiring)
-- ---------------------------------------------------------------------------

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  plan public.plan_tier not null default 'free',
  status public.subscription_status not null default 'active',
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- audit_logs — service-role writes; admin+ reads
-- ---------------------------------------------------------------------------

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index audit_logs_created_idx on public.audit_logs (created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security — enabled on every table; user-owned tables get owner
-- policies, reference data gets public read, privileged writes need roles.
-- The service role (server-side only) bypasses RLS by attribute, as on Supabase.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.devices enable row level security;
alter table public.user_devices enable row level security;
alter table public.player_profiles enable row level security;
alter table public.player_goals enable row level security;
alter table public.user_preferences enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.audit_logs enable row level security;

-- profiles: owner-only (public creator/pro profiles are separate later tables)
create policy profiles_select_own on public.profiles
  for select using (id = auth.uid());
create policy profiles_insert_own on public.profiles
  for insert with check (id = auth.uid());
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- devices: public knowledge base; editors and above maintain it
create policy devices_select_all on public.devices
  for select using (true);
create policy devices_insert_editor on public.devices
  for insert with check (public.has_role_at_least('editor'));
create policy devices_update_editor on public.devices
  for update using (public.has_role_at_least('editor'))
  with check (public.has_role_at_least('editor'));
create policy devices_delete_admin on public.devices
  for delete using (public.has_role_at_least('admin'));

-- user_devices: owner CRUD
create policy user_devices_select_own on public.user_devices
  for select using (user_id = auth.uid());
create policy user_devices_insert_own on public.user_devices
  for insert with check (user_id = auth.uid());
create policy user_devices_update_own on public.user_devices
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy user_devices_delete_own on public.user_devices
  for delete using (user_id = auth.uid());

-- player_profiles: owner CRUD
create policy player_profiles_select_own on public.player_profiles
  for select using (user_id = auth.uid());
create policy player_profiles_insert_own on public.player_profiles
  for insert with check (user_id = auth.uid());
create policy player_profiles_update_own on public.player_profiles
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy player_profiles_delete_own on public.player_profiles
  for delete using (user_id = auth.uid());

-- player_goals: owner CRUD
create policy player_goals_select_own on public.player_goals
  for select using (user_id = auth.uid());
create policy player_goals_insert_own on public.player_goals
  for insert with check (user_id = auth.uid());
create policy player_goals_update_own on public.player_goals
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy player_goals_delete_own on public.player_goals
  for delete using (user_id = auth.uid());

-- user_preferences: owner CRUD
create policy user_preferences_select_own on public.user_preferences
  for select using (user_id = auth.uid());
create policy user_preferences_insert_own on public.user_preferences
  for insert with check (user_id = auth.uid());
create policy user_preferences_update_own on public.user_preferences
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- roles/permissions metadata: readable by everyone; writes are service-role only
create policy roles_select_all on public.roles for select using (true);
create policy permissions_select_all on public.permissions for select using (true);
create policy role_permissions_select_all on public.role_permissions for select using (true);

-- user_roles: users see their own grants, admins see all.
-- No insert/update/delete policies: role grants happen exclusively through
-- server-side tooling using the service role, with audit logging. This also
-- makes self-escalation impossible from a client session.
create policy user_roles_select_own on public.user_roles
  for select using (user_id = auth.uid());
create policy user_roles_select_admin on public.user_roles
  for select using (public.is_admin());

-- subscriptions: owner read; writes only via server (Stripe webhooks, Phase 8)
create policy subscriptions_select_own on public.subscriptions
  for select using (user_id = auth.uid());

-- audit_logs: admin+ read; writes only via server/service role
create policy audit_logs_select_admin on public.audit_logs
  for select using (public.is_admin());
