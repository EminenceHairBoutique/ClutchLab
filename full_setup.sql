-- ============================================================================
-- ClutchLab — full database setup (GENERATED, do not edit by hand)
--
-- Concatenation, in apply order, of:
--   1. supabase/migrations/*.sql   (filename order)
--   2. supabase/seed.sql           (roles, permissions, device knowledge base)
--   3. supabase/seed_content.sql   (generated 4.5/S31 catalog + published snapshot)
--
-- This is exactly what `pnpm db:migrate && pnpm db:seed` applies. Run it once
-- against a Supabase database (it relies on the Supabase `auth` schema,
-- `auth.uid()`, and the anon/authenticated/service_role roles).
--
-- The RESET block below recreates the `public` schema first, so this file is
-- safe to re-run on a database that already has (some of) the schema — the
-- migrations use plain `create type`/`create table`, which are not idempotent
-- on their own.
-- ============================================================================


-- ============================================================================
-- RESET (DESTRUCTIVE) — REMOVES EVERYTHING IN THE public SCHEMA, INCLUDING DATA.
-- Comment out this block (the DROP/CREATE/GRANT lines below) to apply against a
-- truly fresh database and have it fail loudly on any pre-existing objects.
-- Supabase's own objects live in auth/storage/extensions and are NOT affected;
-- the grants restore Supabase's default public-schema privileges after the drop.
-- ============================================================================
drop schema if exists public cascade;
create schema public;

grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on all tables in schema public to postgres, anon, authenticated, service_role;
grant all on all routines in schema public to postgres, anon, authenticated, service_role;
grant all on all sequences in schema public to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on routines to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to postgres, anon, authenticated, service_role;


-- ============================================================================
-- FILE: supabase/migrations/20260721000001_identity.sql
-- ============================================================================

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


-- ============================================================================
-- FILE: supabase/migrations/20260721000002_content.sql
-- ============================================================================

-- ClutchLab Phase 2: versioned content engine — versions/seasons/patches,
-- modes/maps, weapons/attachments, explainable tiers/snapshots, sources/claims,
-- and the editorial review queue (spec §5.2–§5.5, §9, §10, §12).
--
-- Data integrity invariants (spec §0.1.8, §2.2, DATA_VERIFICATION.md):
--  * every content row carries data_status + source fields; seeds are never 'verified'
--  * numeric weapon stats live in weapon_stats rows ONLY when a value is actually
--    known (EAV) — absent rows render as "not yet verified", never as invented numbers
--  * tiers reference an explicit methodology and store their component breakdown

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.season_kind as enum
  ('classic', 'casual', 'ultimate_royale', 'ranked_arena', 'metro', 'other');
create type public.change_type as enum
  ('buff', 'nerf', 'adjustment', 'new', 'removed', 'system');
create type public.change_area as enum
  ('weapon', 'attachment', 'map', 'mode', 'movement', 'settings', 'audio', 'other');
create type public.impact_level as enum
  ('unaffected', 'review_recommended', 'retest_required', 'outdated');
create type public.weapon_class as enum
  ('ar', 'smg', 'dmr', 'sr', 'lmg', 'shotgun', 'pistol', 'other');
create type public.ammo_type as enum
  ('556', '762', '9mm', '45acp', '12gauge', '300magnum', 'bolt', 'other');
create type public.availability_kind as enum ('ground_loot', 'airdrop', 'map_exclusive');
create type public.attachment_slot as enum ('muzzle', 'grip', 'scope', 'magazine', 'stock', 'canted');
create type public.effect_direction as enum ('improves', 'worsens', 'mixed', 'none', 'unknown');
create type public.effect_magnitude as enum ('minor', 'moderate', 'major', 'unknown');
create type public.tier_letter as enum ('S', 'A', 'B', 'C', 'D', 'F');
create type public.confidence_level as enum ('high', 'medium', 'low', 'disputed', 'unverified');
create type public.difficulty_level as enum ('easy', 'moderate', 'hard', 'unknown');
create type public.snapshot_status as enum ('draft', 'published', 'archived');
create type public.source_kind as enum
  ('official', 'press', 'news', 'creator', 'community', 'measured', 'editorial');
create type public.reliability_level as enum ('high', 'medium', 'low');
create type public.claim_verdict as enum
  ('supported', 'partial', 'unsupported', 'disputed', 'unverified');
create type public.measurement_kind as enum ('official', 'measured', 'estimated', 'disputed');
create type public.evidence_kind as enum
  ('official_note', 'measured', 'pro_usage', 'community', 'editorial');
create type public.review_kind as enum ('verify', 'update', 'investigate');
create type public.review_status as enum ('open', 'in_progress', 'done', 'dismissed');
create type public.priority_level as enum ('low', 'medium', 'high');

-- ---------------------------------------------------------------------------
-- Versions & seasons
-- ---------------------------------------------------------------------------

create table public.game_editions (
  slug text primary key check (slug ~ '^[a-z0-9_]{2,30}$'),
  name text not null,
  notes text
);

create table public.regions (
  slug text primary key check (slug ~ '^[a-z0-9_]{2,30}$'),
  name text not null
);

create table public.game_versions (
  id uuid primary key default gen_random_uuid(),
  version text not null,
  edition_slug text not null default 'global' references public.game_editions (slug),
  released_on date,
  window_end date,
  headline text,
  data_status public.data_status not null default 'unverified',
  confidence public.confidence_level not null default 'unverified',
  source_name text,
  source_url text,
  source_date date,
  last_verified_at date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (version, edition_slug)
);

create table public.patches (
  id uuid primary key default gen_random_uuid(),
  game_version_id uuid not null references public.game_versions (id) on delete cascade,
  name text not null,
  published_on date,
  summary text,
  data_status public.data_status not null default 'unverified',
  source_name text,
  source_url text,
  source_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index patches_version_idx on public.patches (game_version_id);

create table public.patch_changes (
  id uuid primary key default gen_random_uuid(),
  patch_id uuid not null references public.patches (id) on delete cascade,
  change_type public.change_type not null,
  area public.change_area not null,
  target_slug text,
  summary text not null,
  detail text,
  data_status public.data_status not null default 'unverified',
  confidence public.confidence_level not null default 'unverified',
  source_name text,
  source_url text,
  source_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index patch_changes_patch_idx on public.patch_changes (patch_id);
create index patch_changes_target_idx on public.patch_changes (area, target_slug);

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9_-]{3,40}$'),
  kind public.season_kind not null,
  name text not null,
  starts_at timestamptz,
  ends_at timestamptz,
  game_version_id uuid references public.game_versions (id) on delete set null,
  edition_slug text not null default 'global' references public.game_editions (slug),
  data_status public.data_status not null default 'unverified',
  confidence public.confidence_level not null default 'unverified',
  source_name text,
  source_url text,
  source_date date,
  last_verified_at date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index seasons_kind_idx on public.seasons (kind, edition_slug, starts_at desc);

create table public.event_windows (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  mode_slug text,
  starts_at timestamptz,
  ends_at timestamptz,
  rules_note text,
  data_status public.data_status not null default 'unverified',
  source_name text,
  source_url text,
  source_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Modes & maps
-- ---------------------------------------------------------------------------

create table public.modes (
  slug text primary key check (slug ~ '^[a-z0-9_]{2,40}$'),
  name text not null,
  description text,
  -- null = unknown/unverified, per no-invented-data rule
  aim_assist_allowed boolean,
  team_sizes text[] not null default '{}',
  data_status public.data_status not null default 'unverified',
  source_name text,
  source_url text,
  source_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.mode_rules (
  id uuid primary key default gen_random_uuid(),
  mode_slug text not null references public.modes (slug) on delete cascade,
  rule_key text not null,
  rule_value text not null,
  note text,
  data_status public.data_status not null default 'unverified',
  source_name text,
  source_url text,
  source_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (mode_slug, rule_key)
);

create table public.maps (
  slug text primary key check (slug ~ '^[a-z0-9_]{2,40}$'),
  name text not null,
  size_km smallint check (size_km between 1 and 10),
  terrain text,
  description text,
  data_status public.data_status not null default 'unverified',
  source_name text,
  source_url text,
  source_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.map_versions (
  id uuid primary key default gen_random_uuid(),
  map_slug text not null references public.maps (slug) on delete cascade,
  game_version_id uuid not null references public.game_versions (id) on delete cascade,
  available boolean,
  modes text[] not null default '{}',
  note text,
  data_status public.data_status not null default 'unverified',
  source_name text,
  source_url text,
  source_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (map_slug, game_version_id)
);

-- ---------------------------------------------------------------------------
-- Weapons & attachments
-- ---------------------------------------------------------------------------

create table public.weapons (
  slug text primary key check (slug ~ '^[a-z0-9_]{2,40}$'),
  name text not null,
  class public.weapon_class not null,
  ammo public.ammo_type not null,
  availability public.availability_kind not null default 'ground_loot',
  fire_modes text[] not null default '{}',
  magazine_base smallint check (magazine_base between 1 and 200),
  magazine_extended smallint check (magazine_extended between 1 and 200),
  description text,
  data_status public.data_status not null default 'unverified',
  confidence public.confidence_level not null default 'unverified',
  source_name text,
  source_url text,
  source_date date,
  last_verified_at date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index weapons_class_idx on public.weapons (class);

create table public.weapon_versions (
  id uuid primary key default gen_random_uuid(),
  weapon_slug text not null references public.weapons (slug) on delete cascade,
  game_version_id uuid not null references public.game_versions (id) on delete cascade,
  change_note text,
  data_status public.data_status not null default 'unverified',
  source_name text,
  source_url text,
  source_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (weapon_slug, game_version_id)
);

-- EAV: a row exists ONLY when the value is actually known from a source.
create table public.weapon_stats (
  id uuid primary key default gen_random_uuid(),
  weapon_slug text not null references public.weapons (slug) on delete cascade,
  game_version_id uuid not null references public.game_versions (id) on delete cascade,
  stat_key text not null,
  value numeric not null,
  unit text,
  measurement public.measurement_kind not null,
  data_status public.data_status not null default 'unverified',
  source_name text,
  source_url text,
  source_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (weapon_slug, game_version_id, stat_key)
);

create table public.weapon_availability (
  id uuid primary key default gen_random_uuid(),
  weapon_slug text not null references public.weapons (slug) on delete cascade,
  map_slug text not null references public.maps (slug) on delete cascade,
  game_version_id uuid not null references public.game_versions (id) on delete cascade,
  availability public.availability_kind not null,
  note text,
  data_status public.data_status not null default 'unverified',
  source_name text,
  source_url text,
  source_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (weapon_slug, map_slug, game_version_id)
);

create table public.attachments (
  slug text primary key check (slug ~ '^[a-z0-9_]{2,50}$'),
  name text not null,
  slot public.attachment_slot not null,
  compatible_classes text[] not null default '{}',
  description text,
  data_status public.data_status not null default 'unverified',
  source_name text,
  source_url text,
  source_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.attachment_versions (
  id uuid primary key default gen_random_uuid(),
  attachment_slug text not null references public.attachments (slug) on delete cascade,
  game_version_id uuid not null references public.game_versions (id) on delete cascade,
  change_note text,
  data_status public.data_status not null default 'unverified',
  source_name text,
  source_url text,
  source_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (attachment_slug, game_version_id)
);

-- Qualitative effects only — no invented numbers (spec §5.5).
create table public.attachment_effects (
  id uuid primary key default gen_random_uuid(),
  attachment_slug text not null references public.attachments (slug) on delete cascade,
  effect_key text not null,
  direction public.effect_direction not null default 'unknown',
  magnitude public.effect_magnitude not null default 'unknown',
  note text,
  data_status public.data_status not null default 'unverified',
  source_name text,
  source_url text,
  source_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (attachment_slug, effect_key)
);

create table public.weapon_attachments (
  weapon_slug text not null references public.weapons (slug) on delete cascade,
  attachment_slug text not null references public.attachments (slug) on delete cascade,
  data_status public.data_status not null default 'unverified',
  primary key (weapon_slug, attachment_slug)
);

create table public.weapon_pairings (
  id uuid primary key default gen_random_uuid(),
  primary_slug text not null references public.weapons (slug) on delete cascade,
  secondary_slug text not null references public.weapons (slug) on delete cascade,
  archetype text not null,
  rationale text,
  mode_slug text references public.modes (slug) on delete set null,
  data_status public.data_status not null default 'unverified',
  source_name text,
  source_url text,
  source_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Explainable tiers (spec §10)
-- ---------------------------------------------------------------------------

create table public.tier_methodologies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9_-]{3,60}$'),
  name text not null,
  version text not null,
  description text,
  weights jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.meta_snapshots (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9_.-]{3,80}$'),
  game_version_id uuid not null references public.game_versions (id) on delete cascade,
  season_id uuid references public.seasons (id) on delete set null,
  methodology_id uuid not null references public.tier_methodologies (id),
  status public.snapshot_status not null default 'draft',
  published_at timestamptz,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index meta_snapshots_version_idx on public.meta_snapshots (game_version_id, status);

create table public.weapon_tiers (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.meta_snapshots (id) on delete cascade,
  weapon_slug text not null references public.weapons (slug) on delete cascade,
  mode_slug text not null references public.modes (slug) on delete cascade,
  tier public.tier_letter not null,
  score numeric check (score between 0 and 100),
  components jsonb not null default '{}'::jsonb,
  range_profile jsonb not null default '{}'::jsonb,
  role text,
  difficulty public.difficulty_level not null default 'unknown',
  confidence public.confidence_level not null default 'unverified',
  evidence_note text,
  previous_tier public.tier_letter,
  change_note text,
  data_status public.data_status not null default 'unverified',
  source_name text,
  source_url text,
  source_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (snapshot_id, weapon_slug, mode_slug)
);
create index weapon_tiers_snapshot_idx on public.weapon_tiers (snapshot_id, mode_slug, tier);

create table public.meta_evidence (
  id uuid primary key default gen_random_uuid(),
  weapon_tier_id uuid not null references public.weapon_tiers (id) on delete cascade,
  kind public.evidence_kind not null,
  summary text not null,
  url text,
  data_status public.data_status not null default 'unverified',
  created_at timestamptz not null default now()
);
create index meta_evidence_tier_idx on public.meta_evidence (weapon_tier_id);

-- ---------------------------------------------------------------------------
-- Patch impact graph (spec §5.2)
-- ---------------------------------------------------------------------------

create table public.content_impact_links (
  id uuid primary key default gen_random_uuid(),
  patch_change_id uuid not null references public.patch_changes (id) on delete cascade,
  entity_type text not null,
  entity_id text not null,
  impact public.impact_level not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index content_impact_entity_idx on public.content_impact_links (entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- Sources & editorial workflow (spec §2.2, §12)
-- ---------------------------------------------------------------------------

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text,
  source_type public.source_kind not null,
  published_on date,
  retrieved_on date,
  reliability public.reliability_level not null default 'low',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.source_snapshots (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources (id) on delete cascade,
  snapshot_note text,
  content_hash text,
  captured_at timestamptz not null default now()
);

create table public.claims (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9_-]{3,80}$'),
  statement text not null,
  verdict public.claim_verdict not null default 'unverified',
  confidence public.confidence_level not null default 'unverified',
  game_version_id uuid references public.game_versions (id) on delete set null,
  notes text,
  data_status public.data_status not null default 'unverified',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.claim_evidence (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims (id) on delete cascade,
  source_id uuid not null references public.sources (id) on delete cascade,
  quote text,
  supports boolean,
  note text,
  created_at timestamptz not null default now()
);
create index claim_evidence_claim_idx on public.claim_evidence (claim_id);

create table public.review_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  detail text,
  kind public.review_kind not null default 'verify',
  entity_type text,
  entity_id text,
  status public.review_status not null default 'open',
  priority public.priority_level not null default 'medium',
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index review_tasks_status_idx on public.review_tasks (status, priority);

create table public.content_revisions (
  id bigint generated always as identity primary key,
  entity_type text not null,
  entity_id text not null,
  action text not null,
  diff jsonb not null default '{}'::jsonb,
  actor_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index content_revisions_entity_idx on public.content_revisions (entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers for every table in this migration that has the column
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  for t in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables tb
      on tb.table_schema = c.table_schema and tb.table_name = c.table_name
    where c.table_schema = 'public'
      and c.column_name = 'updated_at'
      and tb.table_type = 'BASE TABLE'
      and not exists (
        select 1 from pg_trigger tr
        where tr.tgrelid = format('public.%I', c.table_name)::regclass
          and tr.tgname = c.table_name || '_updated_at'
      )
  loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      t || '_updated_at', t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS: enable everywhere; standard pattern = public read, editor+ write,
-- admin+ delete. Exceptions handled explicitly afterwards.
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'game_editions', 'regions', 'game_versions', 'patches', 'patch_changes', 'seasons',
    'event_windows', 'modes', 'mode_rules', 'maps', 'map_versions', 'weapons',
    'weapon_versions', 'weapon_stats', 'weapon_availability', 'attachments',
    'attachment_versions', 'attachment_effects', 'weapon_attachments', 'weapon_pairings',
    'tier_methodologies', 'content_impact_links', 'sources', 'source_snapshots',
    'claims', 'claim_evidence'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for select using (true)',
      t || '_select_all', t
    );
    execute format(
      'create policy %I on public.%I for insert with check (public.has_role_at_least(''editor''))',
      t || '_insert_editor', t
    );
    execute format(
      'create policy %I on public.%I for update using (public.has_role_at_least(''editor'')) with check (public.has_role_at_least(''editor''))',
      t || '_update_editor', t
    );
    execute format(
      'create policy %I on public.%I for delete using (public.has_role_at_least(''admin''))',
      t || '_delete_admin', t
    );
  end loop;
end;
$$;

-- meta_snapshots: drafts are editor-only; published/archived are public
alter table public.meta_snapshots enable row level security;
create policy meta_snapshots_select on public.meta_snapshots
  for select using (status <> 'draft' or public.has_role_at_least('editor'));
create policy meta_snapshots_insert_editor on public.meta_snapshots
  for insert with check (public.has_role_at_least('editor'));
create policy meta_snapshots_update_editor on public.meta_snapshots
  for update using (public.has_role_at_least('editor'))
  with check (public.has_role_at_least('editor'));
create policy meta_snapshots_delete_admin on public.meta_snapshots
  for delete using (public.has_role_at_least('admin'));

-- weapon_tiers / meta_evidence: visible only through a non-draft snapshot
alter table public.weapon_tiers enable row level security;
create policy weapon_tiers_select on public.weapon_tiers
  for select using (
    exists (
      select 1 from public.meta_snapshots s
      where s.id = snapshot_id
        and (s.status <> 'draft' or public.has_role_at_least('editor'))
    )
  );
create policy weapon_tiers_insert_editor on public.weapon_tiers
  for insert with check (public.has_role_at_least('editor'));
create policy weapon_tiers_update_editor on public.weapon_tiers
  for update using (public.has_role_at_least('editor'))
  with check (public.has_role_at_least('editor'));
create policy weapon_tiers_delete_admin on public.weapon_tiers
  for delete using (public.has_role_at_least('admin'));

alter table public.meta_evidence enable row level security;
create policy meta_evidence_select on public.meta_evidence
  for select using (
    exists (
      select 1
      from public.weapon_tiers wt
      join public.meta_snapshots s on s.id = wt.snapshot_id
      where wt.id = weapon_tier_id
        and (s.status <> 'draft' or public.has_role_at_least('editor'))
    )
  );
create policy meta_evidence_insert_editor on public.meta_evidence
  for insert with check (public.has_role_at_least('editor'));
create policy meta_evidence_update_editor on public.meta_evidence
  for update using (public.has_role_at_least('editor'))
  with check (public.has_role_at_least('editor'));
create policy meta_evidence_delete_admin on public.meta_evidence
  for delete using (public.has_role_at_least('admin'));

-- review_tasks & content_revisions: editorial-internal
alter table public.review_tasks enable row level security;
create policy review_tasks_select_editor on public.review_tasks
  for select using (public.has_role_at_least('editor'));
create policy review_tasks_insert_editor on public.review_tasks
  for insert with check (public.has_role_at_least('editor'));
create policy review_tasks_update_editor on public.review_tasks
  for update using (public.has_role_at_least('editor'))
  with check (public.has_role_at_least('editor'));
create policy review_tasks_delete_admin on public.review_tasks
  for delete using (public.has_role_at_least('admin'));

alter table public.content_revisions enable row level security;
create policy content_revisions_select_editor on public.content_revisions
  for select using (public.has_role_at_least('editor'));
create policy content_revisions_insert_editor on public.content_revisions
  for insert with check (public.has_role_at_least('editor'));


-- ============================================================================
-- FILE: supabase/migrations/20260721000003_settings_sensitivity_pros.sql
-- ============================================================================

-- ClutchLab Phase 3: settings library, personalized sensitivity system, and the
-- pro settings vault (spec §5.6–§5.8, §9).
--
-- Design notes:
--  * Sensitivity history is IMMUTABLE: profiles point at an active version;
--    edits and rollbacks always create a NEW version (spec §5.7 version control).
--  * Codes are stored VERBATIM as user artifacts — never parsed into numbers,
--    never generated (spec §5.7 code rules).
--  * Pro profiles carry verification labels + staleness fields; seeded entries
--    are 'sample' and must never claim verified status (spec §5.8, §21).

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.sensitivity_family as enum ('camera', 'ads', 'gyro', 'ads_gyro', 'free_look');
create type public.sensitivity_scope as enum
  ('no_scope_tpp', 'no_scope_fpp', 'red_dot', 'x2', 'x3', 'x4', 'x6', 'x8');
create type public.setting_category as enum
  ('aiming', 'controls', 'gyroscope', 'graphics', 'audio', 'gameplay', 'accessibility');
create type public.recommendation_kind as enum
  ('keep', 'increase_small', 'increase_medium', 'decrease_small', 'decrease_medium', 'retest');
create type public.verification_level as enum
  ('player_verified', 'team_verified', 'direct_visual', 'source_verified',
   'community_submitted', 'unverified', 'expired', 'sample');
create type public.code_kind as enum ('sensitivity', 'controls');

-- ---------------------------------------------------------------------------
-- Settings library (spec §5.6)
-- ---------------------------------------------------------------------------

create table public.setting_definitions (
  slug text primary key check (slug ~ '^[a-z0-9_]{2,60}$'),
  name text not null,
  category public.setting_category not null,
  what_it_does text not null,
  what_it_does_not text,
  advantages text,
  disadvantages text,
  beginner_recommendation text,
  competitive_recommendation text,
  mode_notes text,
  device_impact text,
  retest_after_update boolean not null default false,
  data_status public.data_status not null default 'unverified',
  confidence public.confidence_level not null default 'unverified',
  source_name text,
  source_url text,
  source_date date,
  last_verified_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index setting_definitions_category_idx on public.setting_definitions (category);

create table public.setting_versions (
  id uuid primary key default gen_random_uuid(),
  setting_slug text not null references public.setting_definitions (slug) on delete cascade,
  game_version_id uuid not null references public.game_versions (id) on delete cascade,
  change_note text,
  retest_required boolean not null default false,
  data_status public.data_status not null default 'unverified',
  source_name text,
  source_url text,
  source_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (setting_slug, game_version_id)
);

-- ---------------------------------------------------------------------------
-- Sensitivity profiles (user-owned) — spec §5.7
-- ---------------------------------------------------------------------------

create table public.sensitivity_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  notes text,
  active_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);
create index sensitivity_profiles_user_idx on public.sensitivity_profiles (user_id);

create table public.sensitivity_profile_versions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.sensitivity_profiles (id) on delete cascade,
  version_no integer not null check (version_no >= 1),
  note text,
  -- provenance of this version: manual edit, calibration step, rollback, fork
  origin text not null default 'manual'
    check (origin in ('manual', 'calibration', 'rollback', 'fork', 'import')),
  rolled_back_from uuid references public.sensitivity_profile_versions (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (profile_id, version_no)
);
create index spv_profile_idx on public.sensitivity_profile_versions (profile_id, version_no desc);

alter table public.sensitivity_profiles
  add constraint sensitivity_profiles_active_version_fk
  foreign key (active_version_id) references public.sensitivity_profile_versions (id)
  on delete set null;

create table public.sensitivity_values (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.sensitivity_profile_versions (id) on delete cascade,
  family public.sensitivity_family not null,
  scope public.sensitivity_scope,
  value smallint not null check (value between 1 and 300),
  unique (version_id, family, scope)
);
create index sensitivity_values_version_idx on public.sensitivity_values (version_id);

-- Verbatim user-supplied codes (spec: never parsed, never generated)
create table public.setting_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  profile_id uuid references public.sensitivity_profiles (id) on delete set null,
  kind public.code_kind not null,
  code text not null check (char_length(code) between 3 and 200),
  label text,
  created_at timestamptz not null default now()
);
create index setting_codes_user_idx on public.setting_codes (user_id);

-- Calibration test catalog (content) + user results (user-owned)
create table public.sensitivity_tests (
  slug text primary key check (slug ~ '^[a-z0-9_]{2,60}$'),
  name text not null,
  step_order smallint not null unique,
  instructions text not null,
  metric text not null,
  adjusts_family public.sensitivity_family,
  adjusts_scope public.sensitivity_scope,
  data_status public.data_status not null default 'unverified',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sensitivity_test_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  profile_version_id uuid references public.sensitivity_profile_versions (id) on delete set null,
  test_slug text not null references public.sensitivity_tests (slug) on delete cascade,
  outcome text not null check (outcome in ('overshoot', 'undershoot', 'on_target', 'unstable', 'stable')),
  note text,
  created_at timestamptz not null default now()
);
create index str_user_idx on public.sensitivity_test_results (user_id, created_at desc);

create table public.sensitivity_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  result_id uuid not null references public.sensitivity_test_results (id) on delete cascade,
  family public.sensitivity_family,
  scope public.sensitivity_scope,
  recommendation public.recommendation_kind not null,
  rationale text not null,
  accepted boolean,
  created_at timestamptz not null default now()
);
create index sr_user_idx on public.sensitivity_recommendations (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Pro settings vault (spec §5.8)
-- ---------------------------------------------------------------------------

create table public.teams (
  slug text primary key check (slug ~ '^[a-z0-9_-]{2,40}$'),
  name text not null,
  region text,
  data_status public.data_status not null default 'unverified',
  source_name text,
  source_url text,
  source_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pro_profiles (
  slug text primary key check (slug ~ '^[a-z0-9_-]{2,50}$'),
  display_name text not null,
  team_slug text references public.teams (slug) on delete set null,
  region text,
  role text,
  device_label text,
  fps_tier text,
  finger_count smallint check (finger_count between 2 and 6),
  grip_style public.grip_style,
  gyro_mode text check (gyro_mode in ('off', 'scope_on', 'always_on')),
  aim_assist text check (aim_assist in ('on', 'off', 'unknown')),
  preferred_weapons text[] not null default '{}',
  main_modes text[] not null default '{}',
  verification public.verification_level not null default 'unverified',
  game_version_label text,
  stale_reason text,
  is_stale boolean not null default false,
  data_status public.data_status not null default 'unverified',
  confidence public.confidence_level not null default 'unverified',
  source_name text,
  source_url text,
  source_date date,
  last_verified_at date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index pro_profiles_verification_idx on public.pro_profiles (verification);

create table public.pro_team_history (
  id uuid primary key default gen_random_uuid(),
  pro_slug text not null references public.pro_profiles (slug) on delete cascade,
  team_slug text references public.teams (slug) on delete set null,
  joined_on date,
  left_on date,
  data_status public.data_status not null default 'unverified',
  source_name text,
  created_at timestamptz not null default now()
);

create table public.pro_settings (
  id uuid primary key default gen_random_uuid(),
  pro_slug text not null references public.pro_profiles (slug) on delete cascade,
  family public.sensitivity_family not null,
  scope public.sensitivity_scope,
  value smallint not null check (value between 1 and 300),
  data_status public.data_status not null default 'unverified',
  source_name text,
  source_url text,
  source_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pro_slug, family, scope)
);

create table public.verification_sources (
  id uuid primary key default gen_random_uuid(),
  pro_slug text not null references public.pro_profiles (slug) on delete cascade,
  source_id uuid not null references public.sources (id) on delete cascade,
  note text,
  created_at timestamptz not null default now()
);

create table public.verification_reviews (
  id uuid primary key default gen_random_uuid(),
  pro_slug text not null references public.pro_profiles (slug) on delete cascade,
  reviewer_id uuid references public.profiles (id) on delete set null,
  outcome public.verification_level not null,
  note text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at triggers (same information_schema loop as migration 0002)
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  for t in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables tb
      on tb.table_schema = c.table_schema and tb.table_name = c.table_name
    where c.table_schema = 'public'
      and c.column_name = 'updated_at'
      and tb.table_type = 'BASE TABLE'
      and not exists (
        select 1 from pg_trigger tr
        where tr.tgrelid = format('public.%I', c.table_name)::regclass
          and tr.tgname = c.table_name || '_updated_at'
      )
  loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      t || '_updated_at', t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

-- Public content: settings library, calibration test catalog, pro vault
do $$
declare
  t text;
begin
  foreach t in array array[
    'setting_definitions', 'setting_versions', 'sensitivity_tests',
    'teams', 'pro_profiles', 'pro_team_history', 'pro_settings', 'verification_sources'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select using (true)', t || '_select_all', t);
    execute format(
      'create policy %I on public.%I for insert with check (public.has_role_at_least(''editor''))',
      t || '_insert_editor', t
    );
    execute format(
      'create policy %I on public.%I for update using (public.has_role_at_least(''editor'')) with check (public.has_role_at_least(''editor''))',
      t || '_update_editor', t
    );
    execute format(
      'create policy %I on public.%I for delete using (public.has_role_at_least(''admin''))',
      t || '_delete_admin', t
    );
  end loop;
end;
$$;

-- verification_reviews: editors write, everyone reads outcomes
alter table public.verification_reviews enable row level security;
create policy verification_reviews_select_all on public.verification_reviews
  for select using (true);
create policy verification_reviews_insert_editor on public.verification_reviews
  for insert with check (public.has_role_at_least('editor'));

-- User-owned sensitivity data: owner CRUD only
alter table public.sensitivity_profiles enable row level security;
create policy sensitivity_profiles_owner_select on public.sensitivity_profiles
  for select using (user_id = auth.uid());
create policy sensitivity_profiles_owner_insert on public.sensitivity_profiles
  for insert with check (user_id = auth.uid());
create policy sensitivity_profiles_owner_update on public.sensitivity_profiles
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy sensitivity_profiles_owner_delete on public.sensitivity_profiles
  for delete using (user_id = auth.uid());

-- Versions/values: ownership via the parent profile
alter table public.sensitivity_profile_versions enable row level security;
create policy spv_owner_select on public.sensitivity_profile_versions
  for select using (
    exists (select 1 from public.sensitivity_profiles p
            where p.id = profile_id and p.user_id = auth.uid())
  );
create policy spv_owner_insert on public.sensitivity_profile_versions
  for insert with check (
    exists (select 1 from public.sensitivity_profiles p
            where p.id = profile_id and p.user_id = auth.uid())
  );
-- No update policy: versions are immutable. No delete: history is preserved
-- (profile deletion cascades server-side via FK).

alter table public.sensitivity_values enable row level security;
create policy sensitivity_values_owner_select on public.sensitivity_values
  for select using (
    exists (select 1 from public.sensitivity_profile_versions v
            join public.sensitivity_profiles p on p.id = v.profile_id
            where v.id = version_id and p.user_id = auth.uid())
  );
create policy sensitivity_values_owner_insert on public.sensitivity_values
  for insert with check (
    exists (select 1 from public.sensitivity_profile_versions v
            join public.sensitivity_profiles p on p.id = v.profile_id
            where v.id = version_id and p.user_id = auth.uid())
  );

alter table public.setting_codes enable row level security;
create policy setting_codes_owner_select on public.setting_codes
  for select using (user_id = auth.uid());
create policy setting_codes_owner_insert on public.setting_codes
  for insert with check (user_id = auth.uid());
create policy setting_codes_owner_delete on public.setting_codes
  for delete using (user_id = auth.uid());

alter table public.sensitivity_test_results enable row level security;
create policy str_owner_select on public.sensitivity_test_results
  for select using (user_id = auth.uid());
create policy str_owner_insert on public.sensitivity_test_results
  for insert with check (user_id = auth.uid());

alter table public.sensitivity_recommendations enable row level security;
create policy sr_owner_select on public.sensitivity_recommendations
  for select using (user_id = auth.uid());
create policy sr_owner_insert on public.sensitivity_recommendations
  for insert with check (user_id = auth.uid());
create policy sr_owner_update on public.sensitivity_recommendations
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());


-- ============================================================================
-- FILE: supabase/migrations/20260721000004_training.sql
-- ============================================================================

-- ClutchLab Phase 4: training academy — skill taxonomy, drill library, plans,
-- session tracking, benchmarks, and the World of Wonder map directory
-- (spec §5.10, §5.14, §9).

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.drill_difficulty as enum ('beginner', 'intermediate', 'advanced');
create type public.session_status as enum ('planned', 'in_progress', 'completed', 'abandoned');
create type public.wow_status as enum ('active', 'unverified', 'retired');

-- ---------------------------------------------------------------------------
-- Skill taxonomy (spec §5.10 categories)
-- ---------------------------------------------------------------------------

create table public.skills (
  slug text primary key check (slug ~ '^[a-z0-9_]{2,50}$'),
  name text not null,
  category text not null check (category ~ '^[a-z0-9_]{2,40}$'),
  description text,
  sort_order smallint not null default 100,
  data_status public.data_status not null default 'unverified',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index skills_category_idx on public.skills (category, sort_order);

-- ---------------------------------------------------------------------------
-- Drill library
-- ---------------------------------------------------------------------------

create table public.drills (
  slug text primary key check (slug ~ '^[a-z0-9_]{2,60}$'),
  name text not null,
  skill_slug text not null references public.skills (slug) on delete restrict,
  objective text not null,
  difficulty public.drill_difficulty not null default 'beginner',
  prerequisites text,
  required_mode text,
  required_map text,
  weapon_note text,
  scope_note text,
  distance_note text,
  stance_note text,
  duration_minutes smallint not null check (duration_minutes between 1 and 60),
  repetitions text,
  passing_score text not null,
  advanced_score text,
  common_mistakes text,
  coaching_cues text,
  progression_slug text references public.drills (slug) on delete set null,
  regression_slug text references public.drills (slug) on delete set null,
  applicable_modes text[] not null default '{}',
  aim_assist_variant text check (aim_assist_variant in ('on', 'off', 'both', null)),
  data_status public.data_status not null default 'unverified',
  source_name text,
  source_url text,
  source_date date,
  last_verified_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index drills_skill_idx on public.drills (skill_slug, difficulty);

create table public.drill_versions (
  id uuid primary key default gen_random_uuid(),
  drill_slug text not null references public.drills (slug) on delete cascade,
  game_version_id uuid not null references public.game_versions (id) on delete cascade,
  change_note text,
  retest_required boolean not null default false,
  data_status public.data_status not null default 'unverified',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (drill_slug, game_version_id)
);

create table public.drill_steps (
  id uuid primary key default gen_random_uuid(),
  drill_slug text not null references public.drills (slug) on delete cascade,
  step_order smallint not null,
  instruction text not null,
  unique (drill_slug, step_order)
);

-- ---------------------------------------------------------------------------
-- Training plans (curated content; personalized plans generate at runtime)
-- ---------------------------------------------------------------------------

create table public.training_plans (
  slug text primary key check (slug ~ '^[a-z0-9_]{2,60}$'),
  name text not null,
  description text not null,
  minutes smallint not null check (minutes in (5, 10, 15, 30, 45, 60)),
  focus_categories text[] not null default '{}',
  aim_assist_focus text check (aim_assist_focus in ('on', 'off', 'mixed', null)),
  data_status public.data_status not null default 'unverified',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.training_plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_slug text not null references public.training_plans (slug) on delete cascade,
  drill_slug text not null references public.drills (slug) on delete cascade,
  item_order smallint not null,
  minutes smallint not null check (minutes between 1 and 60),
  note text,
  unique (plan_slug, item_order)
);
create index tpi_plan_idx on public.training_plan_items (plan_slug, item_order);

-- ---------------------------------------------------------------------------
-- Benchmarks (content): what good looks like per drill metric
-- ---------------------------------------------------------------------------

create table public.benchmarks (
  id uuid primary key default gen_random_uuid(),
  drill_slug text not null references public.drills (slug) on delete cascade,
  level text not null check (level in ('pass', 'advanced')),
  description text not null,
  data_status public.data_status not null default 'unverified',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (drill_slug, level)
);

-- ---------------------------------------------------------------------------
-- User training sessions + results (user-owned)
-- ---------------------------------------------------------------------------

create table public.user_training_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan_slug text references public.training_plans (slug) on delete set null,
  title text not null,
  minutes_planned smallint not null check (minutes_planned between 1 and 120),
  status public.session_status not null default 'planned',
  drill_slugs text[] not null default '{}',
  started_at timestamptz,
  completed_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index uts_user_idx on public.user_training_sessions (user_id, created_at desc);

create table public.drill_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  session_id uuid references public.user_training_sessions (id) on delete set null,
  drill_slug text not null references public.drills (slug) on delete cascade,
  passed boolean,
  self_rating smallint check (self_rating between 1 and 5),
  metric_note text,
  created_at timestamptz not null default now()
);
create index drill_results_user_idx on public.drill_results (user_id, created_at desc);
create index drill_results_drill_idx on public.drill_results (user_id, drill_slug);

-- ---------------------------------------------------------------------------
-- World of Wonder directory (spec §5.10): codes expire — never assume validity
-- ---------------------------------------------------------------------------

create table public.wow_maps (
  slug text primary key check (slug ~ '^[a-z0-9_-]{2,60}$'),
  name text not null,
  creator_label text,
  map_code text,
  region_note text,
  category text not null,
  player_count text,
  rules text,
  status public.wow_status not null default 'unverified',
  last_verified_at date,
  data_status public.data_status not null default 'unverified',
  source_name text,
  source_url text,
  source_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  for t in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables tb
      on tb.table_schema = c.table_schema and tb.table_name = c.table_name
    where c.table_schema = 'public'
      and c.column_name = 'updated_at'
      and tb.table_type = 'BASE TABLE'
      and not exists (
        select 1 from pg_trigger tr
        where tr.tgrelid = format('public.%I', c.table_name)::regclass
          and tr.tgname = c.table_name || '_updated_at'
      )
  loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      t || '_updated_at', t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'skills', 'drills', 'drill_versions', 'drill_steps', 'training_plans',
    'training_plan_items', 'benchmarks', 'wow_maps'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select using (true)', t || '_select_all', t);
    execute format(
      'create policy %I on public.%I for insert with check (public.has_role_at_least(''editor''))',
      t || '_insert_editor', t
    );
    execute format(
      'create policy %I on public.%I for update using (public.has_role_at_least(''editor'')) with check (public.has_role_at_least(''editor''))',
      t || '_update_editor', t
    );
    execute format(
      'create policy %I on public.%I for delete using (public.has_role_at_least(''admin''))',
      t || '_delete_admin', t
    );
  end loop;
end;
$$;

alter table public.user_training_sessions enable row level security;
create policy uts_owner_select on public.user_training_sessions
  for select using (user_id = auth.uid());
create policy uts_owner_insert on public.user_training_sessions
  for insert with check (user_id = auth.uid());
create policy uts_owner_update on public.user_training_sessions
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy uts_owner_delete on public.user_training_sessions
  for delete using (user_id = auth.uid());

alter table public.drill_results enable row level security;
create policy drill_results_owner_select on public.drill_results
  for select using (user_id = auth.uid());
create policy drill_results_owner_insert on public.drill_results
  for insert with check (user_id = auth.uid());


-- ============================================================================
-- FILE: supabase/migrations/20260721000005_controls.sql
-- ============================================================================

-- ClutchLab Phase 5: Control Layout Studio (spec §5.9, §9).
-- Layouts are user-owned with IMMUTABLE version history (same pattern as
-- sensitivity profiles). Element catalog is content. Positions are normalized
-- (0-1) landscape coordinates so layouts survive device changes. Analysis
-- results are stored per version for history/regression comparison.

create type public.finger_zone as enum
  ('left_thumb', 'right_thumb', 'left_index', 'right_index', 'other');

create table public.control_elements (
  slug text primary key check (slug ~ '^[a-z0-9_]{2,50}$'),
  name text not null,
  description text,
  default_size numeric(4, 3) not null check (default_size between 0.02 and 0.3),
  category text not null check (category in ('movement', 'combat', 'utility', 'camera', 'misc')),
  data_status public.data_status not null default 'unverified',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.control_layouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  finger_count smallint not null check (finger_count between 2 and 6),
  device_note text,
  active_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);
create index control_layouts_user_idx on public.control_layouts (user_id);

create table public.control_layout_versions (
  id uuid primary key default gen_random_uuid(),
  layout_id uuid not null references public.control_layouts (id) on delete cascade,
  version_no integer not null check (version_no >= 1),
  note text,
  origin text not null default 'manual'
    check (origin in ('manual', 'template', 'rollback')),
  created_at timestamptz not null default now(),
  unique (layout_id, version_no)
);
create index clv_layout_idx on public.control_layout_versions (layout_id, version_no desc);

alter table public.control_layouts
  add constraint control_layouts_active_version_fk
  foreign key (active_version_id) references public.control_layout_versions (id)
  on delete set null;

create table public.control_positions (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.control_layout_versions (id) on delete cascade,
  element_slug text not null references public.control_elements (slug) on delete cascade,
  -- normalized landscape coordinates of the element center
  x numeric(5, 4) not null check (x between 0 and 1),
  y numeric(5, 4) not null check (y between 0 and 1),
  size numeric(4, 3) not null check (size between 0.02 and 0.3),
  unique (version_id, element_slug)
);
create index control_positions_version_idx on public.control_positions (version_id);

create table public.control_analysis (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null unique references public.control_layout_versions (id) on delete cascade,
  ergonomics_score smallint not null check (ergonomics_score between 0 and 100),
  findings jsonb not null default '[]'::jsonb,
  workloads jsonb not null default '{}'::jsonb,
  engine_version text not null,
  created_at timestamptz not null default now()
);

create table public.control_test_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  version_id uuid references public.control_layout_versions (id) on delete set null,
  drill_slug text not null references public.drills (slug) on delete cascade,
  passed boolean,
  note text,
  created_at timestamptz not null default now()
);
create index ctr_user_idx on public.control_test_results (user_id, created_at desc);

-- updated_at triggers
do $$
declare
  t text;
begin
  for t in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables tb
      on tb.table_schema = c.table_schema and tb.table_name = c.table_name
    where c.table_schema = 'public'
      and c.column_name = 'updated_at'
      and tb.table_type = 'BASE TABLE'
      and not exists (
        select 1 from pg_trigger tr
        where tr.tgrelid = format('public.%I', c.table_name)::regclass
          and tr.tgname = c.table_name || '_updated_at'
      )
  loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      t || '_updated_at', t
    );
  end loop;
end;
$$;

-- RLS
alter table public.control_elements enable row level security;
create policy control_elements_select_all on public.control_elements for select using (true);
create policy control_elements_insert_editor on public.control_elements
  for insert with check (public.has_role_at_least('editor'));
create policy control_elements_update_editor on public.control_elements
  for update using (public.has_role_at_least('editor'))
  with check (public.has_role_at_least('editor'));

alter table public.control_layouts enable row level security;
create policy control_layouts_owner_select on public.control_layouts
  for select using (user_id = auth.uid());
create policy control_layouts_owner_insert on public.control_layouts
  for insert with check (user_id = auth.uid());
create policy control_layouts_owner_update on public.control_layouts
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy control_layouts_owner_delete on public.control_layouts
  for delete using (user_id = auth.uid());

alter table public.control_layout_versions enable row level security;
create policy clv_owner_select on public.control_layout_versions
  for select using (
    exists (select 1 from public.control_layouts l
            where l.id = layout_id and l.user_id = auth.uid())
  );
create policy clv_owner_insert on public.control_layout_versions
  for insert with check (
    exists (select 1 from public.control_layouts l
            where l.id = layout_id and l.user_id = auth.uid())
  );
-- Immutable: no update/delete policies.

alter table public.control_positions enable row level security;
create policy control_positions_owner_select on public.control_positions
  for select using (
    exists (select 1 from public.control_layout_versions v
            join public.control_layouts l on l.id = v.layout_id
            where v.id = version_id and l.user_id = auth.uid())
  );
create policy control_positions_owner_insert on public.control_positions
  for insert with check (
    exists (select 1 from public.control_layout_versions v
            join public.control_layouts l on l.id = v.layout_id
            where v.id = version_id and l.user_id = auth.uid())
  );

alter table public.control_analysis enable row level security;
create policy control_analysis_owner_select on public.control_analysis
  for select using (
    exists (select 1 from public.control_layout_versions v
            join public.control_layouts l on l.id = v.layout_id
            where v.id = version_id and l.user_id = auth.uid())
  );
create policy control_analysis_owner_insert on public.control_analysis
  for insert with check (
    exists (select 1 from public.control_layout_versions v
            join public.control_layouts l on l.id = v.layout_id
            where v.id = version_id and l.user_id = auth.uid())
  );

alter table public.control_test_results enable row level security;
create policy ctr_owner_select on public.control_test_results
  for select using (user_id = auth.uid());
create policy ctr_owner_insert on public.control_test_results
  for insert with check (user_id = auth.uid());


-- ============================================================================
-- FILE: supabase/migrations/20260721000006_community.sql
-- ============================================================================

-- ClutchLab Phase 6: moderated community + creator/verification surfaces
-- (spec §5.16, §5.8 creator portal subset, §9).
--
-- Moderation model: content is never hard-deleted by users — status transitions
-- ('visible' → 'removed'/'flagged') driven by authors (retract), automated risk
-- flags, and moderators. All moderator actions are recorded.

create type public.post_kind as enum
  ('discussion', 'question', 'settings', 'layout', 'drill_result', 'meta_debate',
   'squad_recruitment', 'correction');
create type public.content_status as enum ('visible', 'flagged', 'removed', 'retracted');
create type public.report_reason as enum
  ('cheating_content', 'macro_or_script', 'account_trading', 'uc_scam',
   'credential_request', 'harassment', 'false_verification', 'copyright', 'spam', 'other');
create type public.report_status as enum ('open', 'actioned', 'dismissed');
create type public.moderation_action_kind as enum
  ('remove_content', 'restore_content', 'dismiss_report', 'warn_user', 'note');

-- ---------------------------------------------------------------------------
-- Posts & comments
-- ---------------------------------------------------------------------------

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  -- Denormalized display snapshot: profiles are RLS-private, but community
  -- content needs a public byline without exposing profile rows.
  author_label text not null default 'player' check (char_length(author_label) between 1 and 40),
  kind public.post_kind not null default 'discussion',
  title text not null check (char_length(title) between 3 and 140),
  body text not null check (char_length(body) between 1 and 8000),
  status public.content_status not null default 'visible',
  auto_flag_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index posts_status_idx on public.posts (status, created_at desc);
create index posts_author_idx on public.posts (author_id);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  author_label text not null default 'player' check (char_length(author_label) between 1 and 40),
  body text not null check (char_length(body) between 1 and 4000),
  status public.content_status not null default 'visible',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index comments_post_idx on public.comments (post_id, created_at);

create table public.reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null default 'like' check (kind in ('like', 'insightful', 'tested_it')),
  created_at timestamptz not null default now(),
  unique (post_id, user_id, kind)
);

-- ---------------------------------------------------------------------------
-- Reports & moderation
-- ---------------------------------------------------------------------------

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  entity_type text not null check (entity_type in ('post', 'comment', 'pro_profile')),
  entity_id text not null,
  reason public.report_reason not null,
  detail text,
  status public.report_status not null default 'open',
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index reports_status_idx on public.reports (status, created_at);

create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  moderator_id uuid not null references public.profiles (id) on delete cascade,
  report_id uuid references public.reports (id) on delete set null,
  action public.moderation_action_kind not null,
  entity_type text,
  entity_id text,
  note text,
  created_at timestamptz not null default now()
);

create table public.reputation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  delta smallint not null check (delta between -100 and 100),
  reason text not null,
  created_at timestamptz not null default now()
);
create index reputation_user_idx on public.reputation_events (user_id);

-- Pro-vault correction requests (spec §5.16 "pro-profile corrections")
create table public.correction_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  pro_slug text not null references public.pro_profiles (slug) on delete cascade,
  claim text not null check (char_length(claim) between 10 and 2000),
  source_url text,
  status public.report_status not null default 'open',
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index correction_requests_status_idx on public.correction_requests (status);

-- ---------------------------------------------------------------------------
-- Creator surfaces (portal grows in later phases)
-- ---------------------------------------------------------------------------

create table public.creator_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  display_name text not null,
  bio text,
  links jsonb not null default '[]'::jsonb,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.creator_content (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator_profiles (user_id) on delete cascade,
  kind text not null check (kind in ('guide', 'drill_pack', 'settings', 'video')),
  title text not null,
  body text,
  status public.content_status not null default 'visible',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- updated_at triggers
do $$
declare
  t text;
begin
  for t in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables tb
      on tb.table_schema = c.table_schema and tb.table_name = c.table_name
    where c.table_schema = 'public'
      and c.column_name = 'updated_at'
      and tb.table_type = 'BASE TABLE'
      and not exists (
        select 1 from pg_trigger tr
        where tr.tgrelid = format('public.%I', c.table_name)::regclass
          and tr.tgname = c.table_name || '_updated_at'
      )
  loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      t || '_updated_at', t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

-- posts: visible content is public; authors see their own regardless; authors
-- may retract; moderators see and manage everything.
alter table public.posts enable row level security;
create policy posts_select on public.posts
  for select using (
    status = 'visible'
    or author_id = auth.uid()
    or public.has_role_at_least('moderator')
  );
create policy posts_insert_own on public.posts
  for insert with check (author_id = auth.uid());
create policy posts_update_own on public.posts
  for update using (author_id = auth.uid())
  with check (author_id = auth.uid() and status in ('visible', 'retracted'));
create policy posts_update_moderator on public.posts
  for update using (public.has_role_at_least('moderator'))
  with check (public.has_role_at_least('moderator'));

alter table public.comments enable row level security;
create policy comments_select on public.comments
  for select using (
    status = 'visible'
    or author_id = auth.uid()
    or public.has_role_at_least('moderator')
  );
create policy comments_insert_own on public.comments
  for insert with check (author_id = auth.uid());
create policy comments_update_own on public.comments
  for update using (author_id = auth.uid())
  with check (author_id = auth.uid() and status in ('visible', 'retracted'));
create policy comments_update_moderator on public.comments
  for update using (public.has_role_at_least('moderator'))
  with check (public.has_role_at_least('moderator'));

alter table public.reactions enable row level security;
create policy reactions_select_all on public.reactions for select using (true);
create policy reactions_insert_own on public.reactions
  for insert with check (user_id = auth.uid());
create policy reactions_delete_own on public.reactions
  for delete using (user_id = auth.uid());

-- reports: reporters create and see their own; moderators work the queue
alter table public.reports enable row level security;
create policy reports_select_own on public.reports
  for select using (reporter_id = auth.uid());
create policy reports_select_moderator on public.reports
  for select using (public.has_role_at_least('moderator'));
create policy reports_insert_own on public.reports
  for insert with check (reporter_id = auth.uid());
create policy reports_update_moderator on public.reports
  for update using (public.has_role_at_least('moderator'))
  with check (public.has_role_at_least('moderator'));

alter table public.moderation_actions enable row level security;
create policy moderation_actions_select_moderator on public.moderation_actions
  for select using (public.has_role_at_least('moderator'));
create policy moderation_actions_insert_moderator on public.moderation_actions
  for insert with check (
    public.has_role_at_least('moderator') and moderator_id = auth.uid()
  );

alter table public.reputation_events enable row level security;
create policy reputation_select_own on public.reputation_events
  for select using (user_id = auth.uid() or public.has_role_at_least('moderator'));
-- writes via service role / moderation tooling only

alter table public.correction_requests enable row level security;
create policy corrections_select_own on public.correction_requests
  for select using (requester_id = auth.uid() or public.has_role_at_least('editor'));
create policy corrections_insert_own on public.correction_requests
  for insert with check (requester_id = auth.uid());
create policy corrections_update_editor on public.correction_requests
  for update using (public.has_role_at_least('editor'))
  with check (public.has_role_at_least('editor'));

alter table public.creator_profiles enable row level security;
create policy creator_profiles_select_all on public.creator_profiles for select using (true);
create policy creator_profiles_insert_own on public.creator_profiles
  for insert with check (user_id = auth.uid());
create policy creator_profiles_update_own on public.creator_profiles
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid() and verified = false);
create policy creator_profiles_update_editor on public.creator_profiles
  for update using (public.has_role_at_least('editor'))
  with check (public.has_role_at_least('editor'));

alter table public.creator_content enable row level security;
create policy creator_content_select on public.creator_content
  for select using (status = 'visible' or creator_id = auth.uid() or public.has_role_at_least('moderator'));
create policy creator_content_insert_own on public.creator_content
  for insert with check (creator_id = auth.uid());
create policy creator_content_update_own on public.creator_content
  for update using (creator_id = auth.uid()) with check (creator_id = auth.uid());


-- ============================================================================
-- FILE: supabase/migrations/20260721000007_ai_coach.sql
-- ============================================================================

-- ClutchLab Phase 7: post-match AI coach (spec §5.13, §9, §11).
--
-- Product-defining constraints enforced at the schema level:
--  * analysis targets USER-UPLOADED recordings only (uploads are user-owned rows)
--  * every AI output persists model_id + prompt_version + confidence
--  * raw observations are stored separately from reports so reports can be
--    regenerated when prompts improve
--  * jobs are idempotent (unique upload_id + idempotency_key) and processed by
--    a background worker, never a request handler

create type public.upload_kind as enum
  ('clip', 'full_match', 'training_grounds', 'arena_match', 'screenshot',
   'settings_screenshot', 'controls_screenshot', 'results_screenshot');
create type public.upload_status as enum ('registered', 'uploaded', 'queued', 'processing', 'complete', 'failed');
create type public.job_status as enum ('queued', 'running', 'succeeded', 'failed');
create type public.report_review_status as enum ('pending_review', 'published', 'rejected');

create table public.video_uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind public.upload_kind not null,
  label text not null check (char_length(label) between 1 and 120),
  byte_size bigint check (byte_size between 1 and 4294967296),
  duration_seconds integer check (duration_seconds between 1 and 7200),
  storage_path text,
  status public.upload_status not null default 'registered',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index video_uploads_user_idx on public.video_uploads (user_id, created_at desc);

create table public.analysis_jobs (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid not null unique references public.video_uploads (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  idempotency_key text not null unique,
  status public.job_status not null default 'queued',
  attempts smallint not null default 0 check (attempts between 0 and 5),
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index analysis_jobs_status_idx on public.analysis_jobs (status, created_at);

create table public.video_observations (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.analysis_jobs (id) on delete cascade,
  t_seconds integer not null check (t_seconds >= 0),
  category text not null,
  observation text not null,
  inference boolean not null default false,
  confidence public.confidence_level not null,
  created_at timestamptz not null default now()
);
create index video_observations_job_idx on public.video_observations (job_id, t_seconds);

create table public.coaching_reports (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.analysis_jobs (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  executive_summary text not null,
  mistakes jsonb not null default '[]'::jsonb,
  settings_note text,
  could_not_determine text not null,
  confidence public.confidence_level not null,
  model_id text not null,
  prompt_version text not null,
  review_status public.report_review_status not null default 'pending_review',
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index coaching_reports_user_idx on public.coaching_reports (user_id, created_at desc);
create index coaching_reports_review_idx on public.coaching_reports (review_status);

create table public.coaching_recommendations (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.coaching_reports (id) on delete cascade,
  drill_slug text not null references public.drills (slug) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now(),
  unique (report_id, drill_slug)
);

-- updated_at triggers
do $$
declare
  t text;
begin
  for t in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables tb
      on tb.table_schema = c.table_schema and tb.table_name = c.table_name
    where c.table_schema = 'public'
      and c.column_name = 'updated_at'
      and tb.table_type = 'BASE TABLE'
      and not exists (
        select 1 from pg_trigger tr
        where tr.tgrelid = format('public.%I', c.table_name)::regclass
          and tr.tgname = c.table_name || '_updated_at'
      )
  loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      t || '_updated_at', t
    );
  end loop;
end;
$$;

-- RLS: owners see their own pipeline end to end; editors see reports for the
-- human-review tools; the WORKER runs with the service role (bypasses RLS).
alter table public.video_uploads enable row level security;
create policy video_uploads_owner_select on public.video_uploads
  for select using (user_id = auth.uid());
create policy video_uploads_owner_insert on public.video_uploads
  for insert with check (user_id = auth.uid());
create policy video_uploads_owner_update on public.video_uploads
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
-- privacy (§11): users can delete their recordings; cascades remove the whole
-- derived pipeline (job -> observations -> report -> recommendations).
create policy video_uploads_owner_delete on public.video_uploads
  for delete using (user_id = auth.uid());

alter table public.analysis_jobs enable row level security;
create policy analysis_jobs_owner_select on public.analysis_jobs
  for select using (user_id = auth.uid());
-- FK checks bypass RLS, so the insert policy must itself prove the caller owns
-- the upload — otherwise a user could queue analysis of someone else's video.
create policy analysis_jobs_owner_insert on public.analysis_jobs
  for insert with check (
    user_id = auth.uid()
    and status = 'queued'
    and exists (
      select 1 from public.video_uploads u
      where u.id = upload_id and u.user_id = auth.uid()
    )
  );
-- status transitions are worker/service-role territory: no owner update policy

alter table public.video_observations enable row level security;
create policy video_observations_owner_select on public.video_observations
  for select using (
    exists (select 1 from public.analysis_jobs j
            where j.id = job_id and j.user_id = auth.uid())
  );
-- inserts via worker (service role)

alter table public.coaching_reports enable row level security;
create policy coaching_reports_owner_select on public.coaching_reports
  for select using (user_id = auth.uid());
create policy coaching_reports_editor_select on public.coaching_reports
  for select using (public.has_role_at_least('editor'));
create policy coaching_reports_editor_review on public.coaching_reports
  for update using (public.has_role_at_least('editor'))
  with check (public.has_role_at_least('editor'));
-- inserts via worker (service role)

alter table public.coaching_recommendations enable row level security;
create policy coaching_recommendations_select on public.coaching_recommendations
  for select using (
    exists (select 1 from public.coaching_reports r
            where r.id = report_id
              and (r.user_id = auth.uid() or public.has_role_at_least('editor')))
  );


-- ============================================================================
-- FILE: supabase/migrations/20260722000008_billing_marketplace.sql
-- ============================================================================

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


-- ============================================================================
-- FILE: supabase/migrations/20260722000009_notifications.sql
-- ============================================================================

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


-- ============================================================================
-- FILE: supabase/seed.sql
-- ============================================================================

-- ClutchLab seed data. Idempotent: safe to re-run.
--
-- Data integrity rules (spec §0.1.8, §2.2): nothing here is presented as verified.
-- Device hardware fields come from public manufacturer specifications and are stored
-- as data_status='unverified' pending editorial verification. Values that vary by
-- game version or are not reliably published (touch sampling, PUBG FPS tier) stay
-- NULL rather than being invented.

-- ---------------------------------------------------------------------------
-- Roles (spec §13). Rank orders "at least X" checks; guest is unauthenticated
-- and therefore never stored in user_roles.
-- ---------------------------------------------------------------------------

insert into public.roles (slug, name, description, rank) values
  ('player', 'Player', 'Standard authenticated user', 10),
  ('creator', 'Creator', 'Publishes content pending verification', 20),
  ('verified_creator', 'Verified creator', 'Identity- and source-verified creator', 30),
  ('coach', 'Coach', 'Offers coaching services', 40),
  ('editor', 'Editor', 'Maintains verified content and the device knowledge base', 50),
  ('moderator', 'Moderator', 'Moderates community content', 60),
  ('admin', 'Admin', 'Administers users, roles, and publishing', 70),
  ('super_admin', 'Super admin', 'Full control including role administration', 80)
on conflict (slug) do update
  set name = excluded.name, description = excluded.description, rank = excluded.rank;

insert into public.permissions (slug, description) values
  ('content.publish', 'Publish or update verified content'),
  ('content.review', 'Review and approve submitted content'),
  ('meta.edit', 'Edit weapon tiers and meta snapshots'),
  ('patches.ingest', 'Create patch records and normalize changes'),
  ('devices.edit', 'Maintain the device knowledge base'),
  ('pros.verify', 'Verify pro/creator settings profiles'),
  ('drills.edit', 'Author and edit training drills'),
  ('community.moderate', 'Moderate posts, comments, and reports'),
  ('users.moderate', 'Apply user-level moderation actions'),
  ('roles.manage', 'Grant and revoke user roles'),
  ('flags.manage', 'Toggle feature flags'),
  ('audit.read', 'Read audit logs')
on conflict (slug) do update set description = excluded.description;

insert into public.role_permissions (role_slug, permission_slug) values
  ('editor', 'content.publish'),
  ('editor', 'content.review'),
  ('editor', 'meta.edit'),
  ('editor', 'patches.ingest'),
  ('editor', 'devices.edit'),
  ('editor', 'pros.verify'),
  ('editor', 'drills.edit'),
  ('moderator', 'community.moderate'),
  ('moderator', 'users.moderate'),
  ('admin', 'content.publish'),
  ('admin', 'content.review'),
  ('admin', 'meta.edit'),
  ('admin', 'patches.ingest'),
  ('admin', 'devices.edit'),
  ('admin', 'pros.verify'),
  ('admin', 'drills.edit'),
  ('admin', 'community.moderate'),
  ('admin', 'users.moderate'),
  ('admin', 'flags.manage'),
  ('admin', 'audit.read'),
  ('super_admin', 'content.publish'),
  ('super_admin', 'content.review'),
  ('super_admin', 'meta.edit'),
  ('super_admin', 'patches.ingest'),
  ('super_admin', 'devices.edit'),
  ('super_admin', 'pros.verify'),
  ('super_admin', 'drills.edit'),
  ('super_admin', 'community.moderate'),
  ('super_admin', 'users.moderate'),
  ('super_admin', 'roles.manage'),
  ('super_admin', 'flags.manage'),
  ('super_admin', 'audit.read')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Device knowledge base starter set (spec §5.1).
-- Hardware fields (screen size, refresh rate) from public manufacturer specs →
-- unverified until an editor confirms. touch_sampling_hz and max_supported_fps
-- are intentionally NULL: they vary by source and game version.
-- ---------------------------------------------------------------------------

insert into public.devices
  (manufacturer, model, marketing_name, form_factor, os, screen_inches, aspect_ratio,
   refresh_rate_hz, gyro_quality, data_status, source_name, source_date, notes)
values
  ('Apple', 'iPhone 15 Pro Max', 'iPhone 15 Pro Max', 'phone', 'ios', 6.70, '19.5:9',
   120, 'unknown', 'unverified', 'Manufacturer public specifications', '2023-09-22',
   'Display specs from Apple; PUBG Mobile FPS tier pending verification'),
  ('Apple', 'iPhone 15', 'iPhone 15', 'phone', 'ios', 6.10, '19.5:9',
   60, 'unknown', 'unverified', 'Manufacturer public specifications', '2023-09-22', null),
  ('Apple', 'iPhone 13', 'iPhone 13', 'phone', 'ios', 6.10, '19.5:9',
   60, 'unknown', 'unverified', 'Manufacturer public specifications', '2021-09-24', null),
  ('Apple', 'iPad Pro 11 M4', 'iPad Pro 11" (M4)', 'tablet', 'ios', 11.00, '4.3:3',
   120, 'unknown', 'unverified', 'Manufacturer public specifications', '2024-05-15', null),
  ('Apple', 'iPad 10th gen', 'iPad (10th generation)', 'tablet', 'ios', 10.90, '4.3:3',
   60, 'unknown', 'unverified', 'Manufacturer public specifications', '2022-10-26', null),
  ('Samsung', 'SM-S928', 'Galaxy S24 Ultra', 'phone', 'android', 6.80, '19.5:9',
   120, 'unknown', 'unverified', 'Manufacturer public specifications', '2024-01-31', null),
  ('Samsung', 'SM-S911', 'Galaxy S23', 'phone', 'android', 6.10, '19.5:9',
   120, 'unknown', 'unverified', 'Manufacturer public specifications', '2023-02-17', null),
  ('Samsung', 'SM-A546', 'Galaxy A54 5G', 'phone', 'android', 6.40, '19.5:9',
   120, 'unknown', 'unverified', 'Manufacturer public specifications', '2023-03-24', null),
  ('OnePlus', 'CPH2573', 'OnePlus 12', 'phone', 'android', 6.82, '19.8:9',
   120, 'unknown', 'unverified', 'Manufacturer public specifications', '2024-01-23', null),
  ('Xiaomi', '23127PN0CG', 'Xiaomi 14', 'phone', 'android', 6.36, '20:9',
   120, 'unknown', 'unverified', 'Manufacturer public specifications', '2023-10-31', null),
  ('Xiaomi', '23049PCD8G', 'POCO F5', 'phone', 'android', 6.67, '20:9',
   120, 'unknown', 'unverified', 'Manufacturer public specifications', '2023-05-09', null),
  ('Google', 'GP4BC', 'Pixel 8 Pro', 'phone', 'android', 6.70, '20:9',
   120, 'unknown', 'unverified', 'Manufacturer public specifications', '2023-10-12', null),
  ('ASUS', 'AI2401', 'ROG Phone 8 Pro', 'phone', 'android', 6.78, '20.4:9',
   165, 'unknown', 'unverified', 'Manufacturer public specifications', '2024-01-16', null),
  ('Vivo', 'I2219', 'iQOO 11', 'phone', 'android', 6.78, '20:9',
   144, 'unknown', 'unverified', 'Manufacturer public specifications', '2022-12-08', null),
  ('Generic', 'SAMPLE-BUDGET-60', 'Sample budget device (60 Hz)', 'phone', 'android', 6.50, '20:9',
   60, 'unknown', 'sample', 'ClutchLab sample data', null,
   'Illustrative catalog entry for low-end calibration flows; not a real device')
on conflict (manufacturer, model) do update set
  marketing_name = excluded.marketing_name,
  form_factor = excluded.form_factor,
  os = excluded.os,
  screen_inches = excluded.screen_inches,
  aspect_ratio = excluded.aspect_ratio,
  refresh_rate_hz = excluded.refresh_rate_hz,
  gyro_quality = excluded.gyro_quality,
  data_status = excluded.data_status,
  source_name = excluded.source_name,
  source_date = excluded.source_date,
  notes = excluded.notes;


-- ============================================================================
-- FILE: supabase/seed_content.sql
-- ============================================================================

-- GENERATED FILE — do not edit by hand.
-- Source of truth: packages/content/src/catalog/* (zod-validated, meta-engine scored).
-- Regenerate: pnpm --filter @clutchlab/content generate
-- Idempotent upserts; safe to re-run. Nothing here is data_status='verified'.

insert into public.game_editions (slug, name) values
  ('global', 'Global'),
  ('kr_jp', 'Korea / Japan'),
  ('vn', 'Vietnam'),
  ('tw', 'Taiwan'),
  ('bgmi', 'BGMI (India)')
on conflict (slug) do update set
    name = excluded.name;

insert into public.regions (slug, name) values
  ('global', 'Global'),
  ('asia', 'Asia'),
  ('sea', 'Southeast Asia'),
  ('mena', 'Middle East & North Africa'),
  ('europe', 'Europe'),
  ('na', 'North America'),
  ('sa', 'South America')
on conflict (slug) do update set
    name = excluded.name;

insert into public.game_versions (id, version, edition_slug, released_on, window_end, headline, data_status, confidence, source_name, source_url, source_date, notes) values
  ('b4d83136-5de9-4cd9-81f6-3d547137ca90', '4.5', 'global', '2026-07-09', '2026-09-07', 'Naruto Shippuden themed mode, Ferrari & Spider-Man (Jul 30) collabs, Sea Odyssey return, Fast Swim + Monster Truck handling, ACE32/SMG balance', 'unverified', 'medium', 'GamesPress (official) + SportsDunia / The Magic Rain (press, corroborating)', 'https://www.gamespress.com/PUBG-MOBILES-VERSION-45-UPDATE-INTRODUCES-ONE-OF-ITS-BIGGEST-EVER-COLL', '2026-07-22', 'Claims C1/C8 in DATA_VERIFICATION.md; window end pending official confirmation. Enriched 2026-07-22 with Ferrari collab, Fast Swim, Monster Truck, and Metro Royale Ch.33 (GamesPress official + press corroboration).')
on conflict (id) do update set
    version = excluded.version,
    edition_slug = excluded.edition_slug,
    released_on = excluded.released_on,
    window_end = excluded.window_end,
    headline = excluded.headline,
    data_status = excluded.data_status,
    confidence = excluded.confidence,
    source_name = excluded.source_name,
    source_url = excluded.source_url,
    source_date = excluded.source_date,
    notes = excluded.notes;

insert into public.seasons (id, slug, kind, name, starts_at, ends_at, game_version_id, edition_slug, data_status, confidence, source_name, source_url, source_date, notes) values
  ('18c8d358-2314-4734-85d6-f39505b14c5f', 's31-classic', 'classic', 'S31 Classic Season', '2026-07-16T00:00:00Z', '2026-09-11T23:59:59Z', 'b4d83136-5de9-4cd9-81f6-3d547137ca90', 'global', 'unverified', 'medium', 'TopupLive / SportsDunia (secondary, corroborating)', 'https://www.topuplive.com/news/pubg-mobile-season-31-update.html', '2026-07-21', 'Claim C2; matches spec baseline exactly.'),
  ('61c1d6a7-e752-43f4-887e-8fce379736cb', 's31-ultimate-royale', 'ultimate_royale', 'S31 Ultimate Royale', '2026-07-20T00:00:00Z', '2026-09-07T23:59:59Z', 'b4d83136-5de9-4cd9-81f6-3d547137ca90', 'global', 'unverified', 'low', 'TopupLive (secondary)', 'https://www.topuplive.com/news/pubg-mobile-season-31-update.html', '2026-07-21', 'Claim C3: start corroborated; end date inferred from the version window and spec baseline — review task open.'),
  ('03561527-699b-46e3-8d4d-ddc05718fd75', '45-casual', 'casual', 'Version 4.5 Casual Season', null, null, 'b4d83136-5de9-4cd9-81f6-3d547137ca90', 'global', 'unverified', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21', 'Spec §2.1 baseline says 4.5 includes a Casual Season with Season Points from eligible unranked modes; dates not verified this pass.')
on conflict (slug) do update set
    id = excluded.id,
    kind = excluded.kind,
    name = excluded.name,
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    game_version_id = excluded.game_version_id,
    edition_slug = excluded.edition_slug,
    data_status = excluded.data_status,
    confidence = excluded.confidence,
    source_name = excluded.source_name,
    source_url = excluded.source_url,
    source_date = excluded.source_date,
    notes = excluded.notes;

insert into public.patches (id, game_version_id, name, published_on, summary, data_status, source_name, source_url, source_date) values
  ('74e62fb9-998b-4d4b-8dd9-e5050ad43e01', 'b4d83136-5de9-4cd9-81f6-3d547137ca90', '4.5.0', '2026-07-09', 'Version 4.5 launch patch: themed-mode content, collab events (Naruto, Ferrari, Spider-Man), movement additions (Fast Swim, Monster Truck handling), and weapon balance (ACE32, SMG mobility).', 'unverified', 'GamesPress official release + SportsDunia / The Magic Rain (press)', 'https://www.gamespress.com/PUBG-MOBILES-VERSION-45-UPDATE-INTRODUCES-ONE-OF-ITS-BIGGEST-EVER-COLL', '2026-07-22')
on conflict (id) do update set
    game_version_id = excluded.game_version_id,
    name = excluded.name,
    published_on = excluded.published_on,
    summary = excluded.summary,
    data_status = excluded.data_status,
    source_name = excluded.source_name,
    source_url = excluded.source_url,
    source_date = excluded.source_date;

insert into public.patch_changes (id, patch_id, change_type, area, target_slug, summary, detail, data_status, confidence, source_name, source_url, source_date) values
  ('519d9ba5-1510-4e1f-82d7-c8289a407945', '74e62fb9-998b-4d4b-8dd9-e5050ad43e01', 'buff', 'weapon', 'ace32', 'ACE32 firing animation and recoil improved for better control.', 'Magnitude unknown — no numeric recoil deltas may be stored until official notes or reproducible measurements exist (claim C4).', 'unverified', 'low', 'SportsDunia balance coverage', 'https://www.sportsdunia.com/gaming/pubg-mobile-4-4-beta-weapon-balance-changes', '2026-07-21'),
  ('9fe75371-9d8b-423e-8615-18fb26c2dd15', '74e62fb9-998b-4d4b-8dd9-e5050ad43e01', 'buff', 'weapon', null, 'SMG class: sprint speed no longer reduced while an SMG is equipped; moving bullet spread reduced.', 'Which SMGs are affected is unconfirmed — stored as a class-level note, not per-weapon stats (claim C5).', 'unverified', 'low', 'SportsDunia balance coverage', 'https://www.sportsdunia.com/gaming/pubg-mobile-4-4-beta-weapon-balance-changes', '2026-07-21'),
  ('3899bc69-1589-46b6-89e7-0815a5193b24', '74e62fb9-998b-4d4b-8dd9-e5050ad43e01', 'new', 'mode', null, 'Naruto: Ninjas Assemble themed mode across Erangel, Livik, and Sanhok.', 'Claim C7 (official press release via GamesPress); map list (Erangel/Livik/Sanhok) corroborated 2026-07-22.', 'unverified', 'medium', 'GamesPress official release', 'https://www.gamespress.com/PUBG-MOBILES-VERSION-45-UPDATE-INTRODUCES-ONE-OF-ITS-BIGGEST-EVER-COLL', '2026-07-21'),
  ('cd919b6e-9742-453b-8711-2ee6a6355eb7', '74e62fb9-998b-4d4b-8dd9-e5050ad43e01', 'new', 'mode', null, 'Sea Odyssey mode returns (underwater ruins, last seen in 3.3).', null, 'unverified', 'low', 'u7buy / EnjoyGM coverage (secondary)', 'https://www.enjoygm.com/blog/pubg-mobile/pubg-mobile-4-5-update', '2026-07-21'),
  ('0baa6963-3587-4ddc-81fb-cdbb980e9399', '74e62fb9-998b-4d4b-8dd9-e5050ad43e01', 'new', 'mode', null, 'Spider-Man collaboration from 2026-07-30 with web-swinging traversal.', null, 'unverified', 'low', 'u7buy coverage (secondary)', 'https://www.u7buy.com/blog/new-update-pubg-mobile-4-5/', '2026-07-21'),
  ('ac593999-89ae-4f19-86ce-7c9f9a774888', '74e62fb9-998b-4d4b-8dd9-e5050ad43e01', 'new', 'other', null, 'Scuderia Ferrari HP collaboration arrives in July with exclusive Ferrari content.', 'Claim C8: named in the official GamesPress release alongside the Naruto headline.', 'unverified', 'medium', 'GamesPress official release', 'https://www.gamespress.com/PUBG-MOBILES-VERSION-45-UPDATE-INTRODUCES-ONE-OF-ITS-BIGGEST-EVER-COLL', '2026-07-22'),
  ('176b7fc9-9b33-49d0-8a66-7c422d19e57e', '74e62fb9-998b-4d4b-8dd9-e5050ad43e01', 'new', 'movement', null, 'New Fast Swim mechanic: propel forward through water for short bursts.', 'Claim C8: movement addition affecting aquatic mobility; magnitudes unmeasured, no numbers stored.', 'unverified', 'medium', 'GamesPress official + The Magic Rain (press)', 'https://themagicrain.com/2026/07/pubg-mobile-version-4-5-update-launches-with-naruto-shippuden-collaboration/', '2026-07-22'),
  ('7aae42c1-cd22-44c6-8eec-bae2197c8839', '74e62fb9-998b-4d4b-8dd9-e5050ad43e01', 'adjustment', 'movement', null, 'Monster Truck driving stability / handling improved.', 'Claim C8: vehicle handling tweak; direction improves, magnitude unmeasured.', 'unverified', 'low', 'SportsDunia coverage (press)', 'https://www.sportsdunia.com/gaming/pubg-mobile-4-5-update-to-go-live', '2026-07-22'),
  ('7f48f364-43e5-42ea-81ff-891046a28049', '74e62fb9-998b-4d4b-8dd9-e5050ad43e01', 'new', 'mode', null, 'Metro Royale Chapter 33: Naruto Shippuden-inspired encounters, progression, and seasonal rewards.', 'Claim C8: Metro Royale seasonal chapter update.', 'unverified', 'low', 'SportsDunia coverage (press)', 'https://www.sportsdunia.com/gaming/pubg-mobile-4-5-update-to-go-live', '2026-07-22')
on conflict (id) do update set
    patch_id = excluded.patch_id,
    change_type = excluded.change_type,
    area = excluded.area,
    target_slug = excluded.target_slug,
    summary = excluded.summary,
    detail = excluded.detail,
    data_status = excluded.data_status,
    confidence = excluded.confidence,
    source_name = excluded.source_name,
    source_url = excluded.source_url,
    source_date = excluded.source_date;

insert into public.content_impact_links (id, patch_change_id, entity_type, entity_id, impact, note) values
  ('1472d774-24ee-4b72-8e61-1e8d524d4f83', '519d9ba5-1510-4e1f-82d7-c8289a407945', 'weapon', 'ace32', 'retest_required', 'Recoil behavior changed in 4.5 — saved spray profiles should be retested.'),
  ('daad03b0-e666-4c3a-81c4-39a5e1bc0908', '9fe75371-9d8b-423e-8615-18fb26c2dd15', 'weapon', 'ump45', 'review_recommended', 'Class-level SMG mobility change in 4.5 may apply; per-weapon confirmation pending.'),
  ('417c18cc-9fa9-43e6-8375-c056294ae2cd', '9fe75371-9d8b-423e-8615-18fb26c2dd15', 'weapon', 'vector', 'review_recommended', 'Class-level SMG mobility change in 4.5 may apply; per-weapon confirmation pending.'),
  ('65f5d93e-1c42-4411-8952-565395ed4e04', '9fe75371-9d8b-423e-8615-18fb26c2dd15', 'weapon', 'uzi', 'review_recommended', 'Class-level SMG mobility change in 4.5 may apply; per-weapon confirmation pending.'),
  ('13a8dddd-e9be-47ac-802b-d855064348f8', '9fe75371-9d8b-423e-8615-18fb26c2dd15', 'weapon', 'mp5k', 'review_recommended', 'Class-level SMG mobility change in 4.5 may apply; per-weapon confirmation pending.'),
  ('cd5bb5eb-e272-4bd9-8e18-50fe5bec39a2', '9fe75371-9d8b-423e-8615-18fb26c2dd15', 'weapon', 'p90', 'review_recommended', 'Class-level SMG mobility change in 4.5 may apply; per-weapon confirmation pending.')
on conflict (id) do update set
    patch_change_id = excluded.patch_change_id,
    entity_type = excluded.entity_type,
    entity_id = excluded.entity_id,
    impact = excluded.impact,
    note = excluded.note;

insert into public.modes (slug, name, description, aim_assist_allowed, team_sizes, data_status, source_name, source_url, source_date) values
  ('classic_ranked', 'Classic Ranked', 'Ranked battle royale on the classic map pool. Rank-safe decision-making balances placement and aggression.', true, '{"solo","duo","squad"}', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('classic_casual', 'Classic (Casual/Unranked)', 'Unranked classic battle royale — the low-pressure layer for testing new sensitivity, layouts, and weapons.', true, '{"solo","duo","squad"}', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('ultimate_royale', 'Ultimate Royale', 'The competitive ruleset: esports-standard zones and loot, no aim assist — the closest ladder to tournament play.', false, '{"squad"}', 'unverified', 'GamingOnPhone — Ultimate Royale mode rules', 'https://gamingonphone.com/news/pubg-mobile-ultimate-royale-mode/', '2026-07-21'),
  ('ranked_arena', 'Ranked Arena', 'Close-quarters ranked arena: repeated engagements, spawn awareness, and loadout mastery at short time-to-kill.', null, '{"squad"}', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('arena_casual', 'Arena / TDM (Unranked)', 'Unranked arena and team deathmatch — warmups, tracking practice, and layout testing.', null, '{"solo","duo","squad"}', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('wow', 'World of Wonder', 'Creator-built training and custom maps — the home of aim, recoil, and movement drill maps.', null, '{"custom"}', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('metro', 'Metro Royale', 'Extraction-style mode with persistent gear. Tracked as a separate future module (spec §5.3).', null, '{"solo","duo","squad"}', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21')
on conflict (slug) do update set
    name = excluded.name,
    description = excluded.description,
    aim_assist_allowed = excluded.aim_assist_allowed,
    team_sizes = excluded.team_sizes,
    data_status = excluded.data_status,
    source_name = excluded.source_name,
    source_url = excluded.source_url,
    source_date = excluded.source_date;

insert into public.mode_rules (id, mode_slug, rule_key, rule_value, note, data_status, source_name, source_url, source_date) values
  ('f63f7102-edeb-4dff-8049-abf634e987de', 'classic_ranked', 'ranking', 'tiered', 'Bronze through Conqueror ladder.', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('82704a14-513b-42ff-81cb-8154fc78974a', 'classic_casual', 'season_points', 'eligible', '4.5 supports earning Season Points in eligible unranked modes (spec baseline, unverified).', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('b2797db0-6a2b-49b3-89c8-acfb8156a39a', 'ultimate_royale', 'aim_assist', 'disabled', 'Claim C6.', 'unverified', 'GamingOnPhone — Ultimate Royale mode rules', 'https://gamingonphone.com/news/pubg-mobile-ultimate-royale-mode/', '2026-07-21'),
  ('2f141868-a122-4101-8509-b47033bef4b0', 'ultimate_royale', 'shop', 'disabled', 'No in-match shop; flare guns unavailable.', 'unverified', 'GamingOnPhone — Ultimate Royale mode rules', 'https://gamingonphone.com/news/pubg-mobile-ultimate-royale-mode/', '2026-07-21'),
  ('7ee2428f-2cba-47e1-8ba4-bd8e81439b66', 'ultimate_royale', 'entry', 'crown_tier', 'Crown tier in current or previous season required.', 'unverified', 'GamingOnPhone — Ultimate Royale mode rules', 'https://gamingonphone.com/news/pubg-mobile-ultimate-royale-mode/', '2026-07-21'),
  ('8d371ae8-4279-44f0-85b0-d86a11b20443', 'ultimate_royale', 'zones', 'esports_standard', 'Playzone shrink, blue zone, supply rates per esports standard; no red zone.', 'unverified', 'GamingOnPhone — Ultimate Royale mode rules', 'https://gamingonphone.com/news/pubg-mobile-ultimate-royale-mode/', '2026-07-21')
on conflict (mode_slug, rule_key) do update set
    rule_value = excluded.rule_value,
    note = excluded.note,
    data_status = excluded.data_status,
    source_name = excluded.source_name,
    source_url = excluded.source_url,
    source_date = excluded.source_date;

insert into public.maps (slug, name, size_km, terrain, description, data_status, source_name, source_url, source_date) values
  ('erangel', 'Erangel', 8, 'Mixed farmland, military base, rolling hills', 'The original 8×8 battleground; balanced engagement ranges and compound play.', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('miramar', 'Miramar', 8, 'Desert, ridgelines, sparse cover', 'Long sightlines reward DMRs, snipers, and disciplined rotations.', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('sanhok', 'Sanhok', 4, 'Dense jungle, rivers, compounds', 'Fast 4×4 pacing with close- to mid-range fights and heavy foliage.', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('vikendi', 'Vikendi', 6, 'Snow, villages, open fields', 'Mid-size snow map; tracks in snow and varied engagement ranges.', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('livik', 'Livik', 2, 'Nordic valleys, waterfalls, small compounds', 'The 2×2 sprint map: constant fights, fast zones, exclusive weapons historically.', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('karakin', 'Karakin', 2, 'Arid rock, tunnels, destructible walls', 'Small hardcore map with breach mechanics and sticky bombs.', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('nusa', 'Nusa', 1, 'Tropical island resort', 'The smallest map — instant action, vertical resort fights.', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('rondo', 'Rondo', 8, 'East-Asian countryside, urban centers, rivers', 'The newest 8×8: dense urban blocks beside open farmland.', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21')
on conflict (slug) do update set
    name = excluded.name,
    size_km = excluded.size_km,
    terrain = excluded.terrain,
    description = excluded.description,
    data_status = excluded.data_status,
    source_name = excluded.source_name,
    source_url = excluded.source_url,
    source_date = excluded.source_date;

insert into public.map_versions (id, map_slug, game_version_id, available, modes, note, data_status, source_name, source_url, source_date) values
  ('99628452-5e52-4bb5-80de-4fdab3b1c74d', 'erangel', 'b4d83136-5de9-4cd9-81f6-3d547137ca90', null, '{}', '4.5 availability unconfirmed — the Mobile ranked rotation could not be verified this pass (DATA_VERIFICATION.md).', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('00c8dd4d-8579-4db7-8975-357d746da2bd', 'miramar', 'b4d83136-5de9-4cd9-81f6-3d547137ca90', null, '{}', '4.5 availability unconfirmed — the Mobile ranked rotation could not be verified this pass (DATA_VERIFICATION.md).', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('fe09ea9f-3642-4dd0-807e-fc79be41f413', 'sanhok', 'b4d83136-5de9-4cd9-81f6-3d547137ca90', null, '{}', '4.5 availability unconfirmed — the Mobile ranked rotation could not be verified this pass (DATA_VERIFICATION.md).', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('fc1a3d95-7ad1-4b28-8a48-ddef94e54763', 'vikendi', 'b4d83136-5de9-4cd9-81f6-3d547137ca90', null, '{}', '4.5 availability unconfirmed — the Mobile ranked rotation could not be verified this pass (DATA_VERIFICATION.md).', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('7183e520-c246-455a-87ab-fdcee81d9097', 'livik', 'b4d83136-5de9-4cd9-81f6-3d547137ca90', null, '{}', '4.5 availability unconfirmed — the Mobile ranked rotation could not be verified this pass (DATA_VERIFICATION.md).', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('81499cf3-7092-4c68-8294-ecb376a60779', 'karakin', 'b4d83136-5de9-4cd9-81f6-3d547137ca90', null, '{}', '4.5 availability unconfirmed — the Mobile ranked rotation could not be verified this pass (DATA_VERIFICATION.md).', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('0690c41c-e02f-4766-813f-a9c7508d3fe9', 'nusa', 'b4d83136-5de9-4cd9-81f6-3d547137ca90', null, '{}', '4.5 availability unconfirmed — the Mobile ranked rotation could not be verified this pass (DATA_VERIFICATION.md).', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('160ccebc-8af0-4935-81a4-fc760ceeebdf', 'rondo', 'b4d83136-5de9-4cd9-81f6-3d547137ca90', null, '{}', '4.5 availability unconfirmed — the Mobile ranked rotation could not be verified this pass (DATA_VERIFICATION.md).', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21')
on conflict (map_slug, game_version_id) do update set
    available = excluded.available,
    modes = excluded.modes,
    note = excluded.note,
    data_status = excluded.data_status,
    source_name = excluded.source_name,
    source_url = excluded.source_url,
    source_date = excluded.source_date;

insert into public.weapons (slug, name, class, ammo, availability, fire_modes, description, data_status, confidence, source_name, source_url, source_date, notes) values
  ('ace32', 'ACE32', 'ar', '762', 'ground_loot', '{"single","auto"}', '7.62 AR with strong sustained damage; 4.5 reportedly improved its firing animation and recoil control.', 'unverified', 'low', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21', null),
  ('m416', 'M416', 'ar', '556', 'ground_loot', '{"single","auto"}', 'The flexible 5.56 workhorse: forgiving recoil once kitted, strong at every practical range.', 'unverified', 'low', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21', null),
  ('aug', 'AUG A3', 'ar', '556', 'ground_loot', '{"single","auto"}', 'Premium 5.56 AR with high velocity and smooth spray; historically airdrop-only, ground loot in recent versions.', 'unverified', 'low', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21', 'Availability category to confirm for 4.5.'),
  ('m762', 'Beryl M762', 'ar', '762', 'ground_loot', '{"single","burst","auto"}', 'Highest practical DPS among ground ARs; punishing recoil that rewards dedicated control practice.', 'unverified', 'low', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21', null),
  ('akm', 'AKM', 'ar', '762', 'ground_loot', '{"single","auto"}', 'Hard-hitting classic 7.62 AR; vertical-heavy recoil, great tap-fire damage.', 'unverified', 'low', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21', null),
  ('scarl', 'SCAR-L', 'ar', '556', 'ground_loot', '{"single","auto"}', 'Comfortable 5.56 AR: gentle spray, slightly lower ceiling than the M416.', 'unverified', 'low', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21', null),
  ('groza', 'Groza', 'ar', '762', 'airdrop', '{"single","auto"}', 'Airdrop bullpup AR with elite close-mid DPS; limited attachments (suppressor-ready).', 'unverified', 'low', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21', null),
  ('ump45', 'UMP45', 'smg', '45acp', 'ground_loot', '{"single","burst","auto"}', 'The stable all-round SMG: low recoil, real mid-range reach for its class.', 'unverified', 'low', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21', null),
  ('vector', 'Vector', 'smg', '9mm', 'ground_loot', '{"single","auto"}', 'Extreme fire rate shredder; demands the extended mag and hugs close range.', 'unverified', 'low', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21', null),
  ('uzi', 'Micro UZI', 'smg', '9mm', 'ground_loot', '{"single","auto"}', 'Fastest TTK in phone-booth range; falls off sharply past a few meters.', 'unverified', 'low', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21', null),
  ('mp5k', 'MP5K', 'smg', '9mm', 'map_exclusive', '{"single","burst","auto"}', 'Vikendi-associated SMG: heavy attachment slots, very controllable spray.', 'unverified', 'low', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21', 'Map availability to confirm for 4.5.'),
  ('p90', 'P90', 'smg', 'other', 'map_exclusive', '{"single","burst","auto"}', '50-round bullpup SMG seen in select modes/maps; sustained close-range pressure.', 'unverified', 'low', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21', 'Mode/map availability to confirm for 4.5.'),
  ('dbs', 'DBS', 'shotgun', '12gauge', 'airdrop', '{"pump"}', 'Double-barrel bullpup shotgun: 14-shell pressure and brutal door fights.', 'unverified', 'low', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21', 'Airdrop vs ground availability to confirm for 4.5.'),
  ('m1014', 'M1014', 'shotgun', '12gauge', 'ground_loot', '{"semi"}', 'Semi-auto shotgun with fast follow-ups; the standard ground-loot breacher.', 'unverified', 'low', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21', null),
  ('s12k', 'S12K', 'shotgun', '12gauge', 'ground_loot', '{"semi"}', 'Magazine-fed semi-auto shotgun; takes AR muzzles and mags.', 'unverified', 'low', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21', null),
  ('mini14', 'Mini14', 'dmr', '556', 'ground_loot', '{"semi"}', 'Low-recoil 5.56 DMR: fast cadence, generous mag, beginner-friendly poke.', 'unverified', 'low', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21', null),
  ('mk12', 'Mk12', 'dmr', '556', 'ground_loot', '{"single","semi"}', '5.56 DMR with high velocity and clean follow-up shots.', 'unverified', 'low', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21', null),
  ('slr', 'SLR', 'dmr', '762', 'ground_loot', '{"semi"}', 'Hard-hitting 7.62 DMR; heavy recoil rewards stock+grip and deliberate cadence.', 'unverified', 'low', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21', null),
  ('sks', 'SKS', 'dmr', '762', 'ground_loot', '{"semi"}', 'Attachment-hungry 7.62 DMR between the Mini14 and SLR in feel.', 'unverified', 'low', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21', null),
  ('awm', 'AWM', 'sr', '300magnum', 'airdrop', '{"bolt"}', 'The airdrop king: the only rifle that drops a level-3 helmet in one shot.', 'unverified', 'low', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21', null),
  ('amr', 'Lynx AMR', 'sr', '300magnum', 'airdrop', '{"bolt"}', 'Anti-materiel airdrop rifle: extreme damage, shreds vehicles.', 'unverified', 'low', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21', 'Availability in 4.5 to confirm.'),
  ('m24', 'M24', 'sr', '762', 'ground_loot', '{"bolt"}', 'Ground-loot bolt action a tier above the Kar98k in power and handling.', 'unverified', 'low', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21', null),
  ('kar98k', 'Kar98k', 'sr', '762', 'ground_loot', '{"bolt"}', 'The classic headshot lottery: iconic, available everywhere, unforgiving cadence.', 'unverified', 'low', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21', null),
  ('mg3', 'MG3', 'lmg', '762', 'airdrop', '{"auto"}', 'Airdrop LMG with selectable fire rates, bipod prone laser, vehicle deletion.', 'unverified', 'low', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21', null),
  ('dp28', 'DP-28', 'lmg', '762', 'ground_loot', '{"auto"}', '47-round ground LMG: slow, heavy-hitting, shockingly stable when prone.', 'unverified', 'low', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21', null),
  ('p90_note', 'Map-exclusive pool (tracked)', 'other', 'other', 'map_exclusive', '{}', 'Placeholder tracking entry: additional map-exclusive weapons for 4.5 are pending verification before being cataloged individually.', 'sample', 'low', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21', 'Not a real weapon — excluded from tier seeding.')
on conflict (slug) do update set
    name = excluded.name,
    class = excluded.class,
    ammo = excluded.ammo,
    availability = excluded.availability,
    fire_modes = excluded.fire_modes,
    description = excluded.description,
    data_status = excluded.data_status,
    confidence = excluded.confidence,
    source_name = excluded.source_name,
    source_url = excluded.source_url,
    source_date = excluded.source_date,
    notes = excluded.notes;

insert into public.weapon_versions (id, weapon_slug, game_version_id, change_note, data_status, source_name, source_url, source_date) values
  ('bb57252f-9256-42fb-87ba-59942fe06bf2', 'ace32', 'b4d83136-5de9-4cd9-81f6-3d547137ca90', '4.5: firing animation and recoil improved (claim C4, secondary source — retest saved profiles).', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('218cc66b-7510-4c7c-874c-0bcfbbff325b', 'ump45', 'b4d83136-5de9-4cd9-81f6-3d547137ca90', '4.5 SMG-class mobility changes may apply (claim C5, class-level, unconfirmed per weapon).', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('9f446c5a-df0b-4733-83c0-e41c2de6b0d9', 'vector', 'b4d83136-5de9-4cd9-81f6-3d547137ca90', '4.5 SMG-class mobility changes may apply (claim C5).', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('6795958e-6af0-48cd-80dd-60adcde45bb2', 'uzi', 'b4d83136-5de9-4cd9-81f6-3d547137ca90', '4.5 SMG-class mobility changes may apply (claim C5).', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('c2c564bb-2432-441c-802e-c7b71d00b5c7', 'mp5k', 'b4d83136-5de9-4cd9-81f6-3d547137ca90', '4.5 SMG-class mobility changes may apply (claim C5).', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('940b15fb-3a06-4e62-8696-5baaec0565a2', 'p90', 'b4d83136-5de9-4cd9-81f6-3d547137ca90', '4.5 SMG-class mobility changes may apply (claim C5).', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21')
on conflict (weapon_slug, game_version_id) do update set
    change_note = excluded.change_note,
    data_status = excluded.data_status,
    source_name = excluded.source_name,
    source_url = excluded.source_url,
    source_date = excluded.source_date;

insert into public.attachments (slug, name, slot, compatible_classes, description, data_status, source_name, source_url, source_date) values
  ('compensator_ar', 'Compensator (AR, DMR, S12K)', 'muzzle', '{"ar","dmr","shotgun"}', 'The default spray muzzle: trades sound signature for recoil reduction.', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('flash_hider_ar', 'Flash Hider (AR, DMR, S12K)', 'muzzle', '{"ar","dmr","shotgun"}', 'Hides muzzle flash with a modest recoil benefit.', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('suppressor_ar', 'Suppressor (AR, DMR, S12K)', 'muzzle', '{"ar","dmr","shotgun"}', 'Silence over stability: positional advantage, no recoil help.', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('compensator_smg', 'Compensator (SMG)', 'muzzle', '{"smg"}', 'SMG spray stabilizer for sustained close fights.', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('suppressor_smg', 'Suppressor (SMG)', 'muzzle', '{"smg"}', 'Quiet compound clears; pairs with UMP45 for stealth play.', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('suppressor_sr', 'Suppressor (SR)', 'muzzle', '{"sr","dmr"}', 'Removes the shot-direction giveaway on bolt actions and DMRs.', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('choke', 'Choke', 'muzzle', '{"shotgun"}', 'Tightens shotgun pellet spread for longer effective range.', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('duckbill', 'Duckbill', 'muzzle', '{"shotgun"}', 'Widens spread horizontally, narrows vertically — strafing targets.', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('vertical_grip', 'Vertical Foregrip', 'grip', '{"ar","smg","dmr","lmg"}', 'The vertical-recoil specialist.', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('angled_grip', 'Angled Foregrip', 'grip', '{"ar","smg","dmr"}', 'Faster ADS with horizontal-recoil help.', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('half_grip', 'Half Grip', 'grip', '{"ar","smg","dmr"}', 'Overall recoil and recovery boost at the cost of stability while moving.', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('thumb_grip', 'Thumb Grip', 'grip', '{"ar","smg","dmr"}', 'Fastest scope-in among grips; first-shot oriented.', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('light_grip', 'Light Grip', 'grip', '{"ar","smg","dmr"}', 'Recoil-recovery focus; niche tap-fire choice.', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('laser_sight', 'Laser Sight', 'grip', '{"ar","smg","pistol"}', 'Tightens hip-fire spread for no-ADS fights.', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('red_dot', 'Red Dot Sight', 'scope', '{"ar","smg","dmr","sr","lmg","shotgun","pistol"}', 'Clean 1× reference sight for close-range tracking.', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('holographic', 'Holographic Sight', 'scope', '{"ar","smg","dmr","sr","lmg","shotgun"}', '1× with a boxier reticle; preference-driven alternative to the red dot.', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('scope_2x', '2× Aimpoint Scope', 'scope', '{"ar","smg","dmr","sr","lmg"}', 'Short-mid magnification with easy spray control.', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('scope_3x', '3× Backlit Scope', 'scope', '{"ar","smg","dmr","sr","lmg"}', 'The mid-range spray standard for most AR players.', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('scope_4x', '4× ACOG Scope', 'scope', '{"ar","smg","dmr","sr","lmg"}', 'Long-mid scope; sprayable only with strong recoil control.', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('scope_6x', '6× Scope', 'scope', '{"ar","dmr","sr","lmg"}', 'Variable 3–6×: DMR glass that doubles as a sprayable 3× when zoomed out.', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('scope_8x', '8× CQBSS Scope', 'scope', '{"dmr","sr"}', 'Maximum magnification; bolt-action and DMR territory only.', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('canted_sight', 'Canted Sight', 'canted', '{"ar","smg","dmr","sr","lmg"}', 'Secondary 1× on a side rail — instant close-range answer on scoped rifles.', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('quickdraw_mag', 'Quickdraw Mag', 'magazine', '{"ar","smg","dmr","sr","pistol"}', 'Faster reloads, standard capacity.', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('extended_mag', 'Extended Mag', 'magazine', '{"ar","smg","dmr","sr","pistol"}', 'More rounds per magazine; the Vector''s mandatory upgrade.', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('extended_quickdraw_mag', 'Extended Quickdraw Mag', 'magazine', '{"ar","smg","dmr","sr","pistol"}', 'Capacity and reload speed in one slot — the endgame magazine.', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('tactical_stock', 'Tactical Stock', 'stock', '{"ar","smg"}', 'Recoil and sway stabilizer for M416, Vector, and friends.', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('cheek_pad', 'Cheek Pad', 'stock', '{"dmr","sr"}', 'Reduces sway and recoil recovery time on precision rifles.', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21')
on conflict (slug) do update set
    name = excluded.name,
    slot = excluded.slot,
    compatible_classes = excluded.compatible_classes,
    description = excluded.description,
    data_status = excluded.data_status,
    source_name = excluded.source_name,
    source_url = excluded.source_url,
    source_date = excluded.source_date;

insert into public.attachment_effects (id, attachment_slug, effect_key, direction, magnitude, note, data_status, source_name, source_url, source_date) values
  ('a080f89f-83f2-47a1-82c1-e122ba4d6417', 'compensator_ar', 'vertical_recoil', 'improves', 'moderate', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('c4624fe8-f375-4bfc-8709-023cc298f6aa', 'compensator_ar', 'horizontal_recoil', 'improves', 'moderate', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('7c78b0ba-c0e6-443f-8c61-69f018c3c8bb', 'compensator_ar', 'sound_signature', 'worsens', 'minor', 'Louder/more visible than suppressed setups.', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('e422985e-cbda-4cc7-8cd3-750f3cdd1e96', 'flash_hider_ar', 'muzzle_flash', 'improves', 'major', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('8088253c-6036-4800-848a-19e9efdcaeba', 'flash_hider_ar', 'vertical_recoil', 'improves', 'minor', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('ad450a7a-15c1-44a8-8911-d005b5ca9162', 'suppressor_ar', 'sound_signature', 'improves', 'major', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('dcf629d0-2524-4f1d-8d8d-f46cb889e9ed', 'suppressor_ar', 'recoil', 'none', 'unknown', 'No direct recoil reduction.', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('a12b8826-2065-4b4f-84f0-e99e0d178f2d', 'compensator_smg', 'vertical_recoil', 'improves', 'moderate', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('6b99a2aa-ecf2-41c4-805e-c7110b3837a7', 'compensator_smg', 'horizontal_recoil', 'improves', 'moderate', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('f6ab5703-089c-4747-8fd2-a6ef009c18d1', 'suppressor_smg', 'sound_signature', 'improves', 'major', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('47d1d3ec-24af-4b5b-87db-7e85eba5951d', 'suppressor_sr', 'sound_signature', 'improves', 'major', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('700b8781-bdde-4935-8b27-0399670d929c', 'choke', 'pellet_spread', 'improves', 'moderate', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('54482741-7b0f-4d42-8d5e-8e891719f731', 'duckbill', 'pellet_spread', 'mixed', 'moderate', 'Horizontal wider, vertical tighter.', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('e799627f-936d-4068-8759-6036d867b43a', 'vertical_grip', 'vertical_recoil', 'improves', 'moderate', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('ccfc9812-05f4-49b0-843f-0e39ab88cb80', 'vertical_grip', 'horizontal_recoil', 'none', 'unknown', 'Little help with side-to-side drift.', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('fb2f57f6-8ed2-40c6-8483-4b3ade35ec73', 'angled_grip', 'ads_speed', 'improves', 'moderate', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('c2dbcdc1-8c48-489c-8c7d-ba04e5f6d5f2', 'angled_grip', 'horizontal_recoil', 'improves', 'minor', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('b5368f9d-ad01-4a27-8caa-798b5a877295', 'half_grip', 'recoil_recovery', 'improves', 'moderate', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('571be415-65c8-4977-8a1e-dcdd9af8b814', 'half_grip', 'vertical_recoil', 'improves', 'minor', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('83f709bc-0ece-4d95-8f75-c82e54756c45', 'half_grip', 'weapon_sway', 'worsens', 'minor', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('0e41360e-a237-4793-863c-485d7f8f5e03', 'thumb_grip', 'ads_speed', 'improves', 'major', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('1def93fe-9cf2-4c86-81ef-bfb21dbcfaaf', 'thumb_grip', 'vertical_recoil', 'worsens', 'minor', 'Slightly harder sustained spray.', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('d34b401d-0c71-4f2c-8ab3-62941cc032a9', 'light_grip', 'recoil_recovery', 'improves', 'major', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('b333e22d-fdf1-42f4-8fdb-955860d9c0e7', 'light_grip', 'sustained_stability', 'worsens', 'minor', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('a75769c3-d02e-43ee-84e6-0377c09ebb83', 'laser_sight', 'hipfire_spread', 'improves', 'moderate', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('23e81375-2b3a-4e6e-8183-dbdf12bf0529', 'red_dot', 'sight_picture', 'improves', 'moderate', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('099ecc3c-cbd6-4723-8af5-828abd5583d2', 'holographic', 'sight_picture', 'improves', 'moderate', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('afd3a8c0-2e8c-47f9-8aec-d48b9f912c6f', 'scope_2x', 'magnification', 'improves', 'minor', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('e3e78d96-158e-4be5-8a3e-795edfc04247', 'scope_3x', 'magnification', 'improves', 'moderate', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('fcaf7d9d-7dd3-46b1-8aa5-fb7c19f272d5', 'scope_4x', 'magnification', 'improves', 'moderate', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('67e66e9d-b228-43a6-88a2-58178eac9f0e', 'scope_6x', 'magnification', 'improves', 'major', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('64806642-89fd-47a8-816f-a1a8d42ad158', 'scope_8x', 'magnification', 'improves', 'major', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('575a5105-045f-4396-8ca9-b0a4c22794eb', 'canted_sight', 'sight_flexibility', 'improves', 'moderate', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('290767f4-deb9-4a7b-8738-05ddabe58c96', 'quickdraw_mag', 'reload_speed', 'improves', 'moderate', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('6f26a3e5-0022-44ea-80f9-de2d5c579cee', 'extended_mag', 'magazine_capacity', 'improves', 'major', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('865ac10b-2018-4885-8a0c-f850278e236f', 'extended_quickdraw_mag', 'magazine_capacity', 'improves', 'major', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('a9ce96fe-1232-4a40-89a8-9c6bf9782b49', 'extended_quickdraw_mag', 'reload_speed', 'improves', 'moderate', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('8949e5dd-ba1c-461e-8bd2-5571781bba4e', 'tactical_stock', 'vertical_recoil', 'improves', 'minor', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('1e171608-e603-4dae-8021-684bbc91547b', 'tactical_stock', 'weapon_sway', 'improves', 'moderate', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('0cc9ed5a-d2bd-4c56-8691-a508242a377c', 'cheek_pad', 'weapon_sway', 'improves', 'moderate', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('fb79caf2-049c-45e6-8944-ac6bf67e1d56', 'cheek_pad', 'recoil_recovery', 'improves', 'minor', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21')
on conflict (attachment_slug, effect_key) do update set
    direction = excluded.direction,
    magnitude = excluded.magnitude,
    note = excluded.note,
    data_status = excluded.data_status,
    source_name = excluded.source_name,
    source_url = excluded.source_url,
    source_date = excluded.source_date;

insert into public.tier_methodologies (id, slug, name, version, description, weights) values
  ('8ea6ce28-bf3f-42d6-8205-72afbf0a2863', 'editorial-baseline', 'Editorial baseline scoring', '1.0.0', 'Range scores weighted per mode, plus explicit adjustments for availability, attachment dependency, ease of use, aim-assist rules, and data confidence. Component inputs are editorial estimates until verified measurements exist.', '{"classic_ranked":{"modeSlug":"classic_ranked","rangeWeights":{"close":0.3,"mid":0.45,"long":0.25},"easeWeight":0.5,"aimAssist":"allowed"},"classic_casual":{"modeSlug":"classic_casual","rangeWeights":{"close":0.3,"mid":0.45,"long":0.25},"easeWeight":0.7,"aimAssist":"allowed"},"ultimate_royale":{"modeSlug":"ultimate_royale","rangeWeights":{"close":0.3,"mid":0.45,"long":0.25},"easeWeight":0.3,"aimAssist":"disabled"},"ranked_arena":{"modeSlug":"ranked_arena","rangeWeights":{"close":0.65,"mid":0.3,"long":0.05},"easeWeight":0.4,"aimAssist":"allowed"},"arena_casual":{"modeSlug":"arena_casual","rangeWeights":{"close":0.65,"mid":0.3,"long":0.05},"easeWeight":0.6,"aimAssist":"allowed"}}'::jsonb)
on conflict (slug) do update set
    name = excluded.name,
    version = excluded.version,
    description = excluded.description,
    weights = excluded.weights;

insert into public.meta_snapshots (id, slug, game_version_id, season_id, methodology_id, status, published_at, notes) values
  ('70370d1c-84db-4397-808b-239370665d53', '4-5-s31-editorial-baseline', 'b4d83136-5de9-4cd9-81f6-3d547137ca90', '18c8d358-2314-4734-85d6-f39505b14c5f', '8ea6ce28-bf3f-42d6-8205-72afbf0a2863', 'published', '2026-07-21T00:00:00Z', 'Editorial baseline for 4.5/S31. Component inputs are editorial estimates (low confidence); arena tiers deferred pending mode-specific research. See DATA_VERIFICATION.md.')
on conflict (slug) do update set
    game_version_id = excluded.game_version_id,
    season_id = excluded.season_id,
    methodology_id = excluded.methodology_id,
    status = excluded.status,
    published_at = excluded.published_at,
    notes = excluded.notes;

insert into public.weapon_tiers (id, snapshot_id, weapon_slug, mode_slug, tier, score, components, range_profile, difficulty, confidence, evidence_note, change_note, data_status, source_name, source_url, source_date) values
  ('a039bc19-5631-46fa-8abd-6ca7e333f515', '70370d1c-84db-4397-808b-239370665d53', 'ace32', 'classic_ranked', 'B', 74.4, '{"methodology":{"slug":"editorial-baseline","version":"1.0.0"},"availabilityAdjusted":true,"breakdown":[{"label":"Close-range 74 × weight 0.3","points":22.2},{"label":"Mid-range 82 × weight 0.45","points":36.9},{"label":"Long-range 62 × weight 0.25","points":15.5},{"label":"Ease of use 68 × mode ease weight 0.5","points":1.7999999999999998},{"label":"Data confidence (low)","points":-2}]}'::jsonb, '{"close":74,"mid":82,"long":62}'::jsonb, 'moderate', 'low', 'Computed by editorial-baseline v1.0.0 from editorial component estimates.', '4.5: firing animation and recoil improved (claim C4, secondary source — retest saved profiles).', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('f333dbf6-37e2-41be-88ab-97cce3dc5785', '70370d1c-84db-4397-808b-239370665d53', 'ace32', 'ultimate_royale', 'B', 73.08, '{"methodology":{"slug":"editorial-baseline","version":"1.0.0"},"availabilityAdjusted":true,"breakdown":[{"label":"Close-range 74 × weight 0.3","points":22.2},{"label":"Mid-range 82 × weight 0.45","points":36.9},{"label":"Long-range 62 × weight 0.25","points":15.5},{"label":"Ease of use 68 × mode ease weight 0.3","points":1.08},{"label":"Aim assist disabled × recoil difficulty 55","points":-0.6000000000000001},{"label":"Data confidence (low)","points":-2}]}'::jsonb, '{"close":74,"mid":82,"long":62}'::jsonb, 'moderate', 'low', 'Computed by editorial-baseline v1.0.0 from editorial component estimates.', '4.5: firing animation and recoil improved (claim C4, secondary source — retest saved profiles).', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('3c1f9e6c-d77d-4fae-8206-63e618039e26', '70370d1c-84db-4397-808b-239370665d53', 'm416', 'classic_ranked', 'B', 74.7, '{"methodology":{"slug":"editorial-baseline","version":"1.0.0"},"availabilityAdjusted":true,"breakdown":[{"label":"Close-range 78 × weight 0.3","points":23.4},{"label":"Mid-range 84 × weight 0.45","points":37.800000000000004},{"label":"Long-range 66 × weight 0.25","points":16.5},{"label":"Attachment dependency (high)","points":-4},{"label":"Ease of use 80 × mode ease weight 0.5","points":3},{"label":"Data confidence (low)","points":-2}]}'::jsonb, '{"close":78,"mid":84,"long":66}'::jsonb, 'moderate', 'low', 'Computed by editorial-baseline v1.0.0 from editorial component estimates.', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('8e36c93d-ef82-4f88-81f7-a635e2fd3122', '70370d1c-84db-4397-808b-239370665d53', 'm416', 'ultimate_royale', 'B', 74.46, '{"methodology":{"slug":"editorial-baseline","version":"1.0.0"},"availabilityAdjusted":true,"breakdown":[{"label":"Close-range 78 × weight 0.3","points":23.4},{"label":"Mid-range 84 × weight 0.45","points":37.800000000000004},{"label":"Long-range 66 × weight 0.25","points":16.5},{"label":"Attachment dependency (high)","points":-4},{"label":"Ease of use 80 × mode ease weight 0.3","points":1.7999999999999998},{"label":"Aim assist disabled × recoil difficulty 42","points":0.96},{"label":"Data confidence (low)","points":-2}]}'::jsonb, '{"close":78,"mid":84,"long":66}'::jsonb, 'moderate', 'low', 'Computed by editorial-baseline v1.0.0 from editorial component estimates.', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('9d348f93-eb37-4461-819c-a2ec0101eb89', '70370d1c-84db-4397-808b-239370665d53', 'aug', 'classic_ranked', 'A', 75.15, '{"methodology":{"slug":"editorial-baseline","version":"1.0.0"},"availabilityAdjusted":true,"breakdown":[{"label":"Close-range 77 × weight 0.3","points":23.099999999999998},{"label":"Mid-range 85 × weight 0.45","points":38.25},{"label":"Long-range 68 × weight 0.25","points":17},{"label":"Attachment dependency (high)","points":-4},{"label":"Ease of use 78 × mode ease weight 0.5","points":2.8000000000000003},{"label":"Data confidence (low)","points":-2}]}'::jsonb, '{"close":77,"mid":85,"long":68}'::jsonb, 'moderate', 'low', 'Computed by editorial-baseline v1.0.0 from editorial component estimates.', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('35d6ded8-51bb-4352-877e-f210cd470295', '70370d1c-84db-4397-808b-239370665d53', 'aug', 'ultimate_royale', 'A', 75.23, '{"methodology":{"slug":"editorial-baseline","version":"1.0.0"},"availabilityAdjusted":true,"breakdown":[{"label":"Close-range 77 × weight 0.3","points":23.099999999999998},{"label":"Mid-range 85 × weight 0.45","points":38.25},{"label":"Long-range 68 × weight 0.25","points":17},{"label":"Attachment dependency (high)","points":-4},{"label":"Ease of use 78 × mode ease weight 0.3","points":1.6800000000000002},{"label":"Aim assist disabled × recoil difficulty 40","points":1.2000000000000002},{"label":"Data confidence (low)","points":-2}]}'::jsonb, '{"close":77,"mid":85,"long":68}'::jsonb, 'moderate', 'low', 'Computed by editorial-baseline v1.0.0 from editorial component estimates.', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('8872000c-c4b3-463f-88f1-968113e6c5e1', '70370d1c-84db-4397-808b-239370665d53', 'm762', 'classic_ranked', 'B', 69.75, '{"methodology":{"slug":"editorial-baseline","version":"1.0.0"},"availabilityAdjusted":true,"breakdown":[{"label":"Close-range 86 × weight 0.3","points":25.8},{"label":"Mid-range 80 × weight 0.45","points":36},{"label":"Long-range 55 × weight 0.25","points":13.75},{"label":"Attachment dependency (high)","points":-4},{"label":"Ease of use 52 × mode ease weight 0.5","points":0.2},{"label":"Data confidence (low)","points":-2}]}'::jsonb, '{"close":86,"mid":80,"long":55}'::jsonb, 'hard', 'low', 'Computed by editorial-baseline v1.0.0 from editorial component estimates.', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('22dc0abe-97f7-469e-861f-9235e2e3f057', '70370d1c-84db-4397-808b-239370665d53', 'm762', 'ultimate_royale', 'B', 65.83, '{"methodology":{"slug":"editorial-baseline","version":"1.0.0"},"availabilityAdjusted":true,"breakdown":[{"label":"Close-range 86 × weight 0.3","points":25.8},{"label":"Mid-range 80 × weight 0.45","points":36},{"label":"Long-range 55 × weight 0.25","points":13.75},{"label":"Attachment dependency (high)","points":-4},{"label":"Ease of use 52 × mode ease weight 0.3","points":0.12},{"label":"Aim assist disabled × recoil difficulty 82","points":-3.84},{"label":"Data confidence (low)","points":-2}]}'::jsonb, '{"close":86,"mid":80,"long":55}'::jsonb, 'hard', 'low', 'Computed by editorial-baseline v1.0.0 from editorial component estimates.', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('1a82d392-fa70-4c99-8545-6868a024f9b8', '70370d1c-84db-4397-808b-239370665d53', 'akm', 'classic_ranked', 'B', 67.7, '{"methodology":{"slug":"editorial-baseline","version":"1.0.0"},"availabilityAdjusted":true,"breakdown":[{"label":"Close-range 80 × weight 0.3","points":24},{"label":"Mid-range 72 × weight 0.45","points":32.4},{"label":"Long-range 50 × weight 0.25","points":12.5},{"label":"Ease of use 58 × mode ease weight 0.5","points":0.8},{"label":"Data confidence (low)","points":-2}]}'::jsonb, '{"close":80,"mid":72,"long":50}'::jsonb, 'hard', 'low', 'Computed by editorial-baseline v1.0.0 from editorial component estimates.', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('31ef5a08-be76-4cfe-83f0-e3e60631f878', '70370d1c-84db-4397-808b-239370665d53', 'akm', 'ultimate_royale', 'B', 64.74, '{"methodology":{"slug":"editorial-baseline","version":"1.0.0"},"availabilityAdjusted":true,"breakdown":[{"label":"Close-range 80 × weight 0.3","points":24},{"label":"Mid-range 72 × weight 0.45","points":32.4},{"label":"Long-range 50 × weight 0.25","points":12.5},{"label":"Ease of use 58 × mode ease weight 0.3","points":0.48},{"label":"Aim assist disabled × recoil difficulty 72","points":-2.64},{"label":"Data confidence (low)","points":-2}]}'::jsonb, '{"close":80,"mid":72,"long":50}'::jsonb, 'hard', 'low', 'Computed by editorial-baseline v1.0.0 from editorial component estimates.', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('8c2907ee-e097-43fd-825b-a606a84a56c1', '70370d1c-84db-4397-808b-239370665d53', 'scarl', 'classic_ranked', 'B', 73.5, '{"methodology":{"slug":"editorial-baseline","version":"1.0.0"},"availabilityAdjusted":true,"breakdown":[{"label":"Close-range 74 × weight 0.3","points":22.2},{"label":"Mid-range 78 × weight 0.45","points":35.1},{"label":"Long-range 60 × weight 0.25","points":15},{"label":"Ease of use 82 × mode ease weight 0.5","points":3.2},{"label":"Data confidence (low)","points":-2}]}'::jsonb, '{"close":74,"mid":78,"long":60}'::jsonb, 'easy', 'low', 'Computed by editorial-baseline v1.0.0 from editorial component estimates.', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('2f8fc06b-8ca4-40f8-8f95-3217347c7abc', '70370d1c-84db-4397-808b-239370665d53', 'scarl', 'ultimate_royale', 'B', 73.66, '{"methodology":{"slug":"editorial-baseline","version":"1.0.0"},"availabilityAdjusted":true,"breakdown":[{"label":"Close-range 74 × weight 0.3","points":22.2},{"label":"Mid-range 78 × weight 0.45","points":35.1},{"label":"Long-range 60 × weight 0.25","points":15},{"label":"Ease of use 82 × mode ease weight 0.3","points":1.92},{"label":"Aim assist disabled × recoil difficulty 38","points":1.44},{"label":"Data confidence (low)","points":-2}]}'::jsonb, '{"close":74,"mid":78,"long":60}'::jsonb, 'easy', 'low', 'Computed by editorial-baseline v1.0.0 from editorial component estimates.', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('44d99e72-2098-4417-8c1a-33c310a862f8', '70370d1c-84db-4397-808b-239370665d53', 'groza', 'classic_ranked', 'B', 72.75, '{"methodology":{"slug":"editorial-baseline","version":"1.0.0"},"availabilityAdjusted":true,"breakdown":[{"label":"Close-range 92 × weight 0.3","points":27.599999999999998},{"label":"Mid-range 84 × weight 0.45","points":37.800000000000004},{"label":"Long-range 55 × weight 0.25","points":13.75},{"label":"Availability (airdrop) in availability-adjusted view","points":-8},{"label":"Attachment dependency (low)","points":2},{"label":"Ease of use 66 × mode ease weight 0.5","points":1.6},{"label":"Data confidence (low)","points":-2}]}'::jsonb, '{"close":92,"mid":84,"long":55}'::jsonb, 'moderate', 'low', 'Computed by editorial-baseline v1.0.0 from editorial component estimates.', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('d0063fda-e31c-49f2-88b4-3dfc352b5cf3', '70370d1c-84db-4397-808b-239370665d53', 'groza', 'ultimate_royale', 'B', 70.91, '{"methodology":{"slug":"editorial-baseline","version":"1.0.0"},"availabilityAdjusted":true,"breakdown":[{"label":"Close-range 92 × weight 0.3","points":27.599999999999998},{"label":"Mid-range 84 × weight 0.45","points":37.800000000000004},{"label":"Long-range 55 × weight 0.25","points":13.75},{"label":"Availability (airdrop) in availability-adjusted view","points":-8},{"label":"Attachment dependency (low)","points":2},{"label":"Ease of use 66 × mode ease weight 0.3","points":0.96},{"label":"Aim assist disabled × recoil difficulty 60","points":-1.2000000000000002},{"label":"Data confidence (low)","points":-2}]}'::jsonb, '{"close":92,"mid":84,"long":55}'::jsonb, 'moderate', 'low', 'Computed by editorial-baseline v1.0.0 from editorial component estimates.', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('0f903d06-3e43-49b0-86b1-9d16b7ac1128', '70370d1c-84db-4397-808b-239370665d53', 'ump45', 'classic_ranked', 'C', 61.4, '{"methodology":{"slug":"editorial-baseline","version":"1.0.0"},"availabilityAdjusted":true,"breakdown":[{"label":"Close-range 82 × weight 0.3","points":24.599999999999998},{"label":"Mid-range 62 × weight 0.45","points":27.900000000000002},{"label":"Long-range 30 × weight 0.25","points":7.5},{"label":"Ease of use 84 × mode ease weight 0.5","points":3.4000000000000004},{"label":"Data confidence (low)","points":-2}]}'::jsonb, '{"close":82,"mid":62,"long":30}'::jsonb, 'easy', 'low', 'Computed by editorial-baseline v1.0.0 from editorial component estimates.', '4.5 SMG-class mobility changes may apply (claim C5, class-level, unconfirmed per weapon).', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('0fd10326-594a-47e9-8ec5-139eb5b0494b', '70370d1c-84db-4397-808b-239370665d53', 'ump45', 'ultimate_royale', 'B', 62.44, '{"methodology":{"slug":"editorial-baseline","version":"1.0.0"},"availabilityAdjusted":true,"breakdown":[{"label":"Close-range 82 × weight 0.3","points":24.599999999999998},{"label":"Mid-range 62 × weight 0.45","points":27.900000000000002},{"label":"Long-range 30 × weight 0.25","points":7.5},{"label":"Ease of use 84 × mode ease weight 0.3","points":2.04},{"label":"Aim assist disabled × recoil difficulty 30","points":2.4000000000000004},{"label":"Data confidence (low)","points":-2}]}'::jsonb, '{"close":82,"mid":62,"long":30}'::jsonb, 'easy', 'low', 'Computed by editorial-baseline v1.0.0 from editorial component estimates.', '4.5 SMG-class mobility changes may apply (claim C5, class-level, unconfirmed per weapon).', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('5144ae59-4f3a-4c3c-87be-431065692425', '70370d1c-84db-4397-808b-239370665d53', 'vector', 'classic_ranked', 'C', 51.95, '{"methodology":{"slug":"editorial-baseline","version":"1.0.0"},"availabilityAdjusted":true,"breakdown":[{"label":"Close-range 90 × weight 0.3","points":27},{"label":"Mid-range 55 × weight 0.45","points":24.75},{"label":"Long-range 20 × weight 0.25","points":5},{"label":"Attachment dependency (high)","points":-4},{"label":"Ease of use 62 × mode ease weight 0.5","points":1.2},{"label":"Data confidence (low)","points":-2}]}'::jsonb, '{"close":90,"mid":55,"long":20}'::jsonb, 'moderate', 'low', 'Computed by editorial-baseline v1.0.0 from editorial component estimates.', '4.5 SMG-class mobility changes may apply (claim C5).', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('a3a81cc3-54b6-4cab-846e-1735c7921e42', '70370d1c-84db-4397-808b-239370665d53', 'vector', 'ultimate_royale', 'C', 52.07, '{"methodology":{"slug":"editorial-baseline","version":"1.0.0"},"availabilityAdjusted":true,"breakdown":[{"label":"Close-range 90 × weight 0.3","points":27},{"label":"Mid-range 55 × weight 0.45","points":24.75},{"label":"Long-range 20 × weight 0.25","points":5},{"label":"Attachment dependency (high)","points":-4},{"label":"Ease of use 62 × mode ease weight 0.3","points":0.72},{"label":"Aim assist disabled × recoil difficulty 45","points":0.6000000000000001},{"label":"Data confidence (low)","points":-2}]}'::jsonb, '{"close":90,"mid":55,"long":20}'::jsonb, 'moderate', 'low', 'Computed by editorial-baseline v1.0.0 from editorial component estimates.', '4.5 SMG-class mobility changes may apply (claim C5).', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('bae11700-a3e5-4e48-8753-9d6b8b7834ce', '70370d1c-84db-4397-808b-239370665d53', 'uzi', 'classic_ranked', 'D', 49.4, '{"methodology":{"slug":"editorial-baseline","version":"1.0.0"},"availabilityAdjusted":true,"breakdown":[{"label":"Close-range 88 × weight 0.3","points":26.4},{"label":"Mid-range 40 × weight 0.45","points":18},{"label":"Long-range 12 × weight 0.25","points":3},{"label":"Attachment dependency (low)","points":2},{"label":"Ease of use 70 × mode ease weight 0.5","points":2},{"label":"Data confidence (low)","points":-2}]}'::jsonb, '{"close":88,"mid":40,"long":12}'::jsonb, 'easy', 'low', 'Computed by editorial-baseline v1.0.0 from editorial component estimates.', '4.5 SMG-class mobility changes may apply (claim C5).', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('a08b0bcc-c843-4d75-85aa-321fe74c5bce', '70370d1c-84db-4397-808b-239370665d53', 'uzi', 'ultimate_royale', 'C', 50.4, '{"methodology":{"slug":"editorial-baseline","version":"1.0.0"},"availabilityAdjusted":true,"breakdown":[{"label":"Close-range 88 × weight 0.3","points":26.4},{"label":"Mid-range 40 × weight 0.45","points":18},{"label":"Long-range 12 × weight 0.25","points":3},{"label":"Attachment dependency (low)","points":2},{"label":"Ease of use 70 × mode ease weight 0.3","points":1.2},{"label":"Aim assist disabled × recoil difficulty 35","points":1.7999999999999998},{"label":"Data confidence (low)","points":-2}]}'::jsonb, '{"close":88,"mid":40,"long":12}'::jsonb, 'easy', 'low', 'Computed by editorial-baseline v1.0.0 from editorial component estimates.', '4.5 SMG-class mobility changes may apply (claim C5).', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('0e7a0ce9-75d0-4b63-8425-b3323f6fc66b', '70370d1c-84db-4397-808b-239370665d53', 'mp5k', 'classic_ranked', 'C', 54.55, '{"methodology":{"slug":"editorial-baseline","version":"1.0.0"},"availabilityAdjusted":true,"breakdown":[{"label":"Close-range 84 × weight 0.3","points":25.2},{"label":"Mid-range 58 × weight 0.45","points":26.1},{"label":"Long-range 25 × weight 0.25","points":6.25},{"label":"Availability (map_exclusive) in availability-adjusted view","points":-4},{"label":"Ease of use 80 × mode ease weight 0.5","points":3},{"label":"Data confidence (low)","points":-2}]}'::jsonb, '{"close":84,"mid":58,"long":25}'::jsonb, 'easy', 'low', 'Computed by editorial-baseline v1.0.0 from editorial component estimates.', '4.5 SMG-class mobility changes may apply (claim C5).', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('b0eb7dea-8e71-4802-80be-6d8c0c272b64', '70370d1c-84db-4397-808b-239370665d53', 'mp5k', 'ultimate_royale', 'C', 55.51, '{"methodology":{"slug":"editorial-baseline","version":"1.0.0"},"availabilityAdjusted":true,"breakdown":[{"label":"Close-range 84 × weight 0.3","points":25.2},{"label":"Mid-range 58 × weight 0.45","points":26.1},{"label":"Long-range 25 × weight 0.25","points":6.25},{"label":"Availability (map_exclusive) in availability-adjusted view","points":-4},{"label":"Ease of use 80 × mode ease weight 0.3","points":1.7999999999999998},{"label":"Aim assist disabled × recoil difficulty 32","points":2.16},{"label":"Data confidence (low)","points":-2}]}'::jsonb, '{"close":84,"mid":58,"long":25}'::jsonb, 'easy', 'low', 'Computed by editorial-baseline v1.0.0 from editorial component estimates.', '4.5 SMG-class mobility changes may apply (claim C5).', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('cd2754bd-b297-4efb-8e15-3c65d2c08cf0', '70370d1c-84db-4397-808b-239370665d53', 'p90', 'classic_ranked', 'C', 57.4, '{"methodology":{"slug":"editorial-baseline","version":"1.0.0"},"availabilityAdjusted":true,"breakdown":[{"label":"Close-range 89 × weight 0.3","points":26.7},{"label":"Mid-range 60 × weight 0.45","points":27},{"label":"Long-range 22 × weight 0.25","points":5.5},{"label":"Availability (map_exclusive) in availability-adjusted view","points":-4},{"label":"Attachment dependency (low)","points":2},{"label":"Ease of use 72 × mode ease weight 0.5","points":2.2},{"label":"Data confidence (low)","points":-2}]}'::jsonb, '{"close":89,"mid":60,"long":22}'::jsonb, 'easy', 'low', 'Computed by editorial-baseline v1.0.0 from editorial component estimates.', '4.5 SMG-class mobility changes may apply (claim C5).', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('558ccac2-a28a-4094-8362-92988f3ba12d', '70370d1c-84db-4397-808b-239370665d53', 'p90', 'ultimate_royale', 'C', 57.96, '{"methodology":{"slug":"editorial-baseline","version":"1.0.0"},"availabilityAdjusted":true,"breakdown":[{"label":"Close-range 89 × weight 0.3","points":26.7},{"label":"Mid-range 60 × weight 0.45","points":27},{"label":"Long-range 22 × weight 0.25","points":5.5},{"label":"Availability (map_exclusive) in availability-adjusted view","points":-4},{"label":"Attachment dependency (low)","points":2},{"label":"Ease of use 72 × mode ease weight 0.3","points":1.32},{"label":"Aim assist disabled × recoil difficulty 38","points":1.44},{"label":"Data confidence (low)","points":-2}]}'::jsonb, '{"close":89,"mid":60,"long":22}'::jsonb, 'easy', 'low', 'Computed by editorial-baseline v1.0.0 from editorial component estimates.', '4.5 SMG-class mobility changes may apply (claim C5).', 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('6d9ff318-3630-4afc-85ef-ddcdaef39ab3', '70370d1c-84db-4397-808b-239370665d53', 'dbs', 'classic_ranked', 'D', 38.65, '{"methodology":{"slug":"editorial-baseline","version":"1.0.0"},"availabilityAdjusted":true,"breakdown":[{"label":"Close-range 93 × weight 0.3","points":27.9},{"label":"Mid-range 35 × weight 0.45","points":15.75},{"label":"Long-range 8 × weight 0.25","points":2},{"label":"Availability (airdrop) in availability-adjusted view","points":-8},{"label":"Attachment dependency (low)","points":2},{"label":"Ease of use 60 × mode ease weight 0.5","points":1},{"label":"Data confidence (low)","points":-2}]}'::jsonb, '{"close":93,"mid":35,"long":8}'::jsonb, 'moderate', 'low', 'Computed by editorial-baseline v1.0.0 from editorial component estimates.', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('a37af217-c68c-4262-81ce-9d16179dcbfa', '70370d1c-84db-4397-808b-239370665d53', 'dbs', 'ultimate_royale', 'D', 38.85, '{"methodology":{"slug":"editorial-baseline","version":"1.0.0"},"availabilityAdjusted":true,"breakdown":[{"label":"Close-range 93 × weight 0.3","points":27.9},{"label":"Mid-range 35 × weight 0.45","points":15.75},{"label":"Long-range 8 × weight 0.25","points":2},{"label":"Availability (airdrop) in availability-adjusted view","points":-8},{"label":"Attachment dependency (low)","points":2},{"label":"Ease of use 60 × mode ease weight 0.3","points":0.6},{"label":"Aim assist disabled × recoil difficulty 45","points":0.6000000000000001},{"label":"Data confidence (low)","points":-2}]}'::jsonb, '{"close":93,"mid":35,"long":8}'::jsonb, 'moderate', 'low', 'Computed by editorial-baseline v1.0.0 from editorial component estimates.', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('277af61a-8d69-4427-820a-632273920407', '70370d1c-84db-4397-808b-239370665d53', 'm1014', 'classic_ranked', 'D', 43.6, '{"methodology":{"slug":"editorial-baseline","version":"1.0.0"},"availabilityAdjusted":true,"breakdown":[{"label":"Close-range 90 × weight 0.3","points":27},{"label":"Mid-range 30 × weight 0.45","points":13.5},{"label":"Long-range 6 × weight 0.25","points":1.5},{"label":"Attachment dependency (low)","points":2},{"label":"Ease of use 66 × mode ease weight 0.5","points":1.6},{"label":"Data confidence (low)","points":-2}]}'::jsonb, '{"close":90,"mid":30,"long":6}'::jsonb, 'moderate', 'low', 'Computed by editorial-baseline v1.0.0 from editorial component estimates.', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('cbac503b-0065-4220-8611-09325004f0de', '70370d1c-84db-4397-808b-239370665d53', 'm1014', 'ultimate_royale', 'D', 44.16, '{"methodology":{"slug":"editorial-baseline","version":"1.0.0"},"availabilityAdjusted":true,"breakdown":[{"label":"Close-range 90 × weight 0.3","points":27},{"label":"Mid-range 30 × weight 0.45","points":13.5},{"label":"Long-range 6 × weight 0.25","points":1.5},{"label":"Attachment dependency (low)","points":2},{"label":"Ease of use 66 × mode ease weight 0.3","points":0.96},{"label":"Aim assist disabled × recoil difficulty 40","points":1.2000000000000002},{"label":"Data confidence (low)","points":-2}]}'::jsonb, '{"close":90,"mid":30,"long":6}'::jsonb, 'moderate', 'low', 'Computed by editorial-baseline v1.0.0 from editorial component estimates.', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('aea7e468-bacf-455f-870c-9e020de7fdd1', '70370d1c-84db-4397-808b-239370665d53', 's12k', 'classic_ranked', 'D', 39.15, '{"methodology":{"slug":"editorial-baseline","version":"1.0.0"},"availabilityAdjusted":true,"breakdown":[{"label":"Close-range 87 × weight 0.3","points":26.099999999999998},{"label":"Mid-range 28 × weight 0.45","points":12.6},{"label":"Long-range 5 × weight 0.25","points":1.25},{"label":"Ease of use 62 × mode ease weight 0.5","points":1.2},{"label":"Data confidence (low)","points":-2}]}'::jsonb, '{"close":87,"mid":28,"long":5}'::jsonb, 'moderate', 'low', 'Computed by editorial-baseline v1.0.0 from editorial component estimates.', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('86a41258-a185-432c-8dd7-9ed5f80c9106', '70370d1c-84db-4397-808b-239370665d53', 's12k', 'ultimate_royale', 'D', 38.91, '{"methodology":{"slug":"editorial-baseline","version":"1.0.0"},"availabilityAdjusted":true,"breakdown":[{"label":"Close-range 87 × weight 0.3","points":26.099999999999998},{"label":"Mid-range 28 × weight 0.45","points":12.6},{"label":"Long-range 5 × weight 0.25","points":1.25},{"label":"Ease of use 62 × mode ease weight 0.3","points":0.72},{"label":"Aim assist disabled × recoil difficulty 48","points":0.24},{"label":"Data confidence (low)","points":-2}]}'::jsonb, '{"close":87,"mid":28,"long":5}'::jsonb, 'moderate', 'low', 'Computed by editorial-baseline v1.0.0 from editorial component estimates.', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('01108e43-4527-45a8-84fc-2107aceb7022', '70370d1c-84db-4397-808b-239370665d53', 'mini14', 'classic_ranked', 'B', 69.5, '{"methodology":{"slug":"editorial-baseline","version":"1.0.0"},"availabilityAdjusted":true,"breakdown":[{"label":"Close-range 45 × weight 0.3","points":13.5},{"label":"Mid-range 76 × weight 0.45","points":34.2},{"label":"Long-range 84 × weight 0.25","points":21},{"label":"Ease of use 78 × mode ease weight 0.5","points":2.8000000000000003},{"label":"Data confidence (low)","points":-2}]}'::jsonb, '{"close":45,"mid":76,"long":84}'::jsonb, 'easy', 'low', 'Computed by editorial-baseline v1.0.0 from editorial component estimates.', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('d854dc53-e473-4a4e-82c1-b7fd585430ab', '70370d1c-84db-4397-808b-239370665d53', 'mini14', 'ultimate_royale', 'B', 70.18, '{"methodology":{"slug":"editorial-baseline","version":"1.0.0"},"availabilityAdjusted":true,"breakdown":[{"label":"Close-range 45 × weight 0.3","points":13.5},{"label":"Mid-range 76 × weight 0.45","points":34.2},{"label":"Long-range 84 × weight 0.25","points":21},{"label":"Ease of use 78 × mode ease weight 0.3","points":1.6800000000000002},{"label":"Aim assist disabled × recoil difficulty 35","points":1.7999999999999998},{"label":"Data confidence (low)","points":-2}]}'::jsonb, '{"close":45,"mid":76,"long":84}'::jsonb, 'easy', 'low', 'Computed by editorial-baseline v1.0.0 from editorial component estimates.', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('fb4da399-8c02-43d9-86ea-e50f08ad99a8', '70370d1c-84db-4397-808b-239370665d53', 'mk12', 'classic_ranked', 'B', 70.95, '{"methodology":{"slug":"editorial-baseline","version":"1.0.0"},"availabilityAdjusted":true,"breakdown":[{"label":"Close-range 48 × weight 0.3","points":14.399999999999999},{"label":"Mid-range 78 × weight 0.45","points":35.1},{"label":"Long-range 85 × weight 0.25","points":21.25},{"label":"Ease of use 72 × mode ease weight 0.5","points":2.2},{"label":"Data confidence (low)","points":-2}]}'::jsonb, '{"close":48,"mid":78,"long":85}'::jsonb, 'moderate', 'low', 'Computed by editorial-baseline v1.0.0 from editorial component estimates.', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('ba4f65b6-f52d-4b54-83c3-7864f48f5b46', '70370d1c-84db-4397-808b-239370665d53', 'mk12', 'ultimate_royale', 'B', 71.27, '{"methodology":{"slug":"editorial-baseline","version":"1.0.0"},"availabilityAdjusted":true,"breakdown":[{"label":"Close-range 48 × weight 0.3","points":14.399999999999999},{"label":"Mid-range 78 × weight 0.45","points":35.1},{"label":"Long-range 85 × weight 0.25","points":21.25},{"label":"Ease of use 72 × mode ease weight 0.3","points":1.32},{"label":"Aim assist disabled × recoil difficulty 40","points":1.2000000000000002},{"label":"Data confidence (low)","points":-2}]}'::jsonb, '{"close":48,"mid":78,"long":85}'::jsonb, 'moderate', 'low', 'Computed by editorial-baseline v1.0.0 from editorial component estimates.', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('264216db-b5d3-4b5a-8f4f-5ccbf809a2a1', '70370d1c-84db-4397-808b-239370665d53', 'slr', 'classic_ranked', 'B', 65.1, '{"methodology":{"slug":"editorial-baseline","version":"1.0.0"},"availabilityAdjusted":true,"breakdown":[{"label":"Close-range 42 × weight 0.3","points":12.6},{"label":"Mid-range 80 × weight 0.45","points":36},{"label":"Long-range 88 × weight 0.25","points":22},{"label":"Attachment dependency (high)","points":-4},{"label":"Ease of use 55 × mode ease weight 0.5","points":0.5},{"label":"Data confidence (low)","points":-2}]}'::jsonb, '{"close":42,"mid":80,"long":88}'::jsonb, 'hard', 'low', 'Computed by editorial-baseline v1.0.0 from editorial component estimates.', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('b65ab3ec-1a7d-45b1-8eac-443b9d5e7b83', '70370d1c-84db-4397-808b-239370665d53', 'slr', 'ultimate_royale', 'B', 62.5, '{"methodology":{"slug":"editorial-baseline","version":"1.0.0"},"availabilityAdjusted":true,"breakdown":[{"label":"Close-range 42 × weight 0.3","points":12.6},{"label":"Mid-range 80 × weight 0.45","points":36},{"label":"Long-range 88 × weight 0.25","points":22},{"label":"Attachment dependency (high)","points":-4},{"label":"Ease of use 55 × mode ease weight 0.3","points":0.3},{"label":"Aim assist disabled × recoil difficulty 70","points":-2.4000000000000004},{"label":"Data confidence (low)","points":-2}]}'::jsonb, '{"close":42,"mid":80,"long":88}'::jsonb, 'hard', 'low', 'Computed by editorial-baseline v1.0.0 from editorial component estimates.', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('2df006e6-68a3-42b1-8de7-f3670a384df8', '70370d1c-84db-4397-808b-239370665d53', 'sks', 'classic_ranked', 'C', 60.6, '{"methodology":{"slug":"editorial-baseline","version":"1.0.0"},"availabilityAdjusted":true,"breakdown":[{"label":"Close-range 40 × weight 0.3","points":12},{"label":"Mid-range 74 × weight 0.45","points":33.300000000000004},{"label":"Long-range 82 × weight 0.25","points":20.5},{"label":"Attachment dependency (high)","points":-4},{"label":"Ease of use 58 × mode ease weight 0.5","points":0.8},{"label":"Data confidence (low)","points":-2}]}'::jsonb, '{"close":40,"mid":74,"long":82}'::jsonb, 'moderate', 'low', 'Computed by editorial-baseline v1.0.0 from editorial component estimates.', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('1040b371-c801-4c5e-8596-56e9e70f7df9', '70370d1c-84db-4397-808b-239370665d53', 'sks', 'ultimate_royale', 'C', 58.84, '{"methodology":{"slug":"editorial-baseline","version":"1.0.0"},"availabilityAdjusted":true,"breakdown":[{"label":"Close-range 40 × weight 0.3","points":12},{"label":"Mid-range 74 × weight 0.45","points":33.300000000000004},{"label":"Long-range 82 × weight 0.25","points":20.5},{"label":"Attachment dependency (high)","points":-4},{"label":"Ease of use 58 × mode ease weight 0.3","points":0.48},{"label":"Aim assist disabled × recoil difficulty 62","points":-1.44},{"label":"Data confidence (low)","points":-2}]}'::jsonb, '{"close":40,"mid":74,"long":82}'::jsonb, 'moderate', 'low', 'Computed by editorial-baseline v1.0.0 from editorial component estimates.', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('949f7bed-af98-4824-8782-e5ac93aa7114', '70370d1c-84db-4397-808b-239370665d53', 'awm', 'classic_ranked', 'C', 55.4, '{"methodology":{"slug":"editorial-baseline","version":"1.0.0"},"availabilityAdjusted":true,"breakdown":[{"label":"Close-range 30 × weight 0.3","points":9},{"label":"Mid-range 72 × weight 0.45","points":32.4},{"label":"Long-range 98 × weight 0.25","points":24.5},{"label":"Availability (airdrop) in availability-adjusted view","points":-8},{"label":"Ease of use 45 × mode ease weight 0.5","points":-0.5},{"label":"Data confidence (low)","points":-2}]}'::jsonb, '{"close":30,"mid":72,"long":98}'::jsonb, 'moderate', 'low', 'Computed by editorial-baseline v1.0.0 from editorial component estimates.', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('da5bd77c-5276-4ead-870b-753019bdeb0b', '70370d1c-84db-4397-808b-239370665d53', 'awm', 'ultimate_royale', 'C', 55, '{"methodology":{"slug":"editorial-baseline","version":"1.0.0"},"availabilityAdjusted":true,"breakdown":[{"label":"Close-range 30 × weight 0.3","points":9},{"label":"Mid-range 72 × weight 0.45","points":32.4},{"label":"Long-range 98 × weight 0.25","points":24.5},{"label":"Availability (airdrop) in availability-adjusted view","points":-8},{"label":"Ease of use 45 × mode ease weight 0.3","points":-0.3},{"label":"Aim assist disabled × recoil difficulty 55","points":-0.6000000000000001},{"label":"Data confidence (low)","points":-2}]}'::jsonb, '{"close":30,"mid":72,"long":98}'::jsonb, 'moderate', 'low', 'Computed by editorial-baseline v1.0.0 from editorial component estimates.', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('098d9cb6-2f3b-487e-8773-ad7084132a57', '70370d1c-84db-4397-808b-239370665d53', 'amr', 'classic_ranked', 'C', 52.55, '{"methodology":{"slug":"editorial-baseline","version":"1.0.0"},"availabilityAdjusted":true,"breakdown":[{"label":"Close-range 26 × weight 0.3","points":7.8},{"label":"Mid-range 70 × weight 0.45","points":31.5},{"label":"Long-range 97 × weight 0.25","points":24.25},{"label":"Availability (airdrop) in availability-adjusted view","points":-8},{"label":"Ease of use 40 × mode ease weight 0.5","points":-1},{"label":"Data confidence (low)","points":-2}]}'::jsonb, '{"close":26,"mid":70,"long":97}'::jsonb, 'moderate', 'low', 'Computed by editorial-baseline v1.0.0 from editorial component estimates.', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('76d4a33a-e9c0-406b-8e04-046dea2a0c5f', '70370d1c-84db-4397-808b-239370665d53', 'amr', 'ultimate_royale', 'C', 51.75, '{"methodology":{"slug":"editorial-baseline","version":"1.0.0"},"availabilityAdjusted":true,"breakdown":[{"label":"Close-range 26 × weight 0.3","points":7.8},{"label":"Mid-range 70 × weight 0.45","points":31.5},{"label":"Long-range 97 × weight 0.25","points":24.25},{"label":"Availability (airdrop) in availability-adjusted view","points":-8},{"label":"Ease of use 40 × mode ease weight 0.3","points":-0.6},{"label":"Aim assist disabled × recoil difficulty 60","points":-1.2000000000000002},{"label":"Data confidence (low)","points":-2}]}'::jsonb, '{"close":26,"mid":70,"long":97}'::jsonb, 'moderate', 'low', 'Computed by editorial-baseline v1.0.0 from editorial component estimates.', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('a4682ac5-f854-4778-8d49-94e1b4280d0a', '70370d1c-84db-4397-808b-239370665d53', 'm24', 'classic_ranked', 'C', 60, '{"methodology":{"slug":"editorial-baseline","version":"1.0.0"},"availabilityAdjusted":true,"breakdown":[{"label":"Close-range 28 × weight 0.3","points":8.4},{"label":"Mid-range 68 × weight 0.45","points":30.6},{"label":"Long-range 92 × weight 0.25","points":23},{"label":"Data confidence (low)","points":-2}]}'::jsonb, '{"close":28,"mid":68,"long":92}'::jsonb, 'moderate', 'low', 'Computed by editorial-baseline v1.0.0 from editorial component estimates.', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('14da2aec-f9cd-4668-89bf-54c78ffb6ee4', '70370d1c-84db-4397-808b-239370665d53', 'm24', 'ultimate_royale', 'C', 60, '{"methodology":{"slug":"editorial-baseline","version":"1.0.0"},"availabilityAdjusted":true,"breakdown":[{"label":"Close-range 28 × weight 0.3","points":8.4},{"label":"Mid-range 68 × weight 0.45","points":30.6},{"label":"Long-range 92 × weight 0.25","points":23},{"label":"Data confidence (low)","points":-2}]}'::jsonb, '{"close":28,"mid":68,"long":92}'::jsonb, 'moderate', 'low', 'Computed by editorial-baseline v1.0.0 from editorial component estimates.', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('2501047f-4fc8-4e67-8bf7-d0c5522e4e69', '70370d1c-84db-4397-808b-239370665d53', 'kar98k', 'classic_ranked', 'C', 56.1, '{"methodology":{"slug":"editorial-baseline","version":"1.0.0"},"availabilityAdjusted":true,"breakdown":[{"label":"Close-range 25 × weight 0.3","points":7.5},{"label":"Mid-range 64 × weight 0.45","points":28.8},{"label":"Long-range 88 × weight 0.25","points":22},{"label":"Ease of use 48 × mode ease weight 0.5","points":-0.2},{"label":"Data confidence (low)","points":-2}]}'::jsonb, '{"close":25,"mid":64,"long":88}'::jsonb, 'moderate', 'low', 'Computed by editorial-baseline v1.0.0 from editorial component estimates.', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('6eb6eb41-8cf6-4288-897b-d4f8cc4759d4', '70370d1c-84db-4397-808b-239370665d53', 'kar98k', 'ultimate_royale', 'C', 56.42, '{"methodology":{"slug":"editorial-baseline","version":"1.0.0"},"availabilityAdjusted":true,"breakdown":[{"label":"Close-range 25 × weight 0.3","points":7.5},{"label":"Mid-range 64 × weight 0.45","points":28.8},{"label":"Long-range 88 × weight 0.25","points":22},{"label":"Ease of use 48 × mode ease weight 0.3","points":-0.12},{"label":"Aim assist disabled × recoil difficulty 48","points":0.24},{"label":"Data confidence (low)","points":-2}]}'::jsonb, '{"close":25,"mid":64,"long":88}'::jsonb, 'moderate', 'low', 'Computed by editorial-baseline v1.0.0 from editorial component estimates.', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('112bd6e8-0e89-443a-86bb-0465c71bf3d3', '70370d1c-84db-4397-808b-239370665d53', 'mg3', 'classic_ranked', 'B', 67.8, '{"methodology":{"slug":"editorial-baseline","version":"1.0.0"},"availabilityAdjusted":true,"breakdown":[{"label":"Close-range 78 × weight 0.3","points":23.4},{"label":"Mid-range 82 × weight 0.45","points":36.9},{"label":"Long-range 60 × weight 0.25","points":15},{"label":"Availability (airdrop) in availability-adjusted view","points":-8},{"label":"Attachment dependency (low)","points":2},{"label":"Ease of use 55 × mode ease weight 0.5","points":0.5},{"label":"Data confidence (low)","points":-2}]}'::jsonb, '{"close":78,"mid":82,"long":60}'::jsonb, 'hard', 'low', 'Computed by editorial-baseline v1.0.0 from editorial component estimates.', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('3f354075-c594-4a2a-8a3a-2cf9f0c6c0d8', '70370d1c-84db-4397-808b-239370665d53', 'mg3', 'ultimate_royale', 'B', 65.44, '{"methodology":{"slug":"editorial-baseline","version":"1.0.0"},"availabilityAdjusted":true,"breakdown":[{"label":"Close-range 78 × weight 0.3","points":23.4},{"label":"Mid-range 82 × weight 0.45","points":36.9},{"label":"Long-range 60 × weight 0.25","points":15},{"label":"Availability (airdrop) in availability-adjusted view","points":-8},{"label":"Attachment dependency (low)","points":2},{"label":"Ease of use 55 × mode ease weight 0.3","points":0.3},{"label":"Aim assist disabled × recoil difficulty 68","points":-2.16},{"label":"Data confidence (low)","points":-2}]}'::jsonb, '{"close":78,"mid":82,"long":60}'::jsonb, 'hard', 'low', 'Computed by editorial-baseline v1.0.0 from editorial component estimates.', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('b4385e64-782d-47b9-8c59-008669ca0017', '70370d1c-84db-4397-808b-239370665d53', 'dp28', 'classic_ranked', 'B', 67.5, '{"methodology":{"slug":"editorial-baseline","version":"1.0.0"},"availabilityAdjusted":true,"breakdown":[{"label":"Close-range 66 × weight 0.3","points":19.8},{"label":"Mid-range 74 × weight 0.45","points":33.300000000000004},{"label":"Long-range 52 × weight 0.25","points":13},{"label":"Attachment dependency (low)","points":2},{"label":"Ease of use 64 × mode ease weight 0.5","points":1.4000000000000001},{"label":"Data confidence (low)","points":-2}]}'::jsonb, '{"close":66,"mid":74,"long":52}'::jsonb, 'moderate', 'low', 'Computed by editorial-baseline v1.0.0 from editorial component estimates.', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('a1215a9a-a893-46eb-8635-cac9137004ce', '70370d1c-84db-4397-808b-239370665d53', 'dp28', 'ultimate_royale', 'B', 66.7, '{"methodology":{"slug":"editorial-baseline","version":"1.0.0"},"availabilityAdjusted":true,"breakdown":[{"label":"Close-range 66 × weight 0.3","points":19.8},{"label":"Mid-range 74 × weight 0.45","points":33.300000000000004},{"label":"Long-range 52 × weight 0.25","points":13},{"label":"Attachment dependency (low)","points":2},{"label":"Ease of use 64 × mode ease weight 0.3","points":0.8400000000000001},{"label":"Aim assist disabled × recoil difficulty 52","points":-0.24},{"label":"Data confidence (low)","points":-2}]}'::jsonb, '{"close":66,"mid":74,"long":52}'::jsonb, 'moderate', 'low', 'Computed by editorial-baseline v1.0.0 from editorial component estimates.', null, 'unverified', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21')
on conflict (snapshot_id, weapon_slug, mode_slug) do update set
    tier = excluded.tier,
    score = excluded.score,
    components = excluded.components,
    range_profile = excluded.range_profile,
    difficulty = excluded.difficulty,
    confidence = excluded.confidence,
    evidence_note = excluded.evidence_note,
    change_note = excluded.change_note,
    data_status = excluded.data_status,
    source_name = excluded.source_name,
    source_url = excluded.source_url,
    source_date = excluded.source_date;

insert into public.meta_evidence (id, weapon_tier_id, kind, summary, url, data_status) values
  ('0ca054c1-ec48-4b8d-8fb6-cb2e6d1f625f', 'a039bc19-5631-46fa-8abd-6ca7e333f515', 'editorial', 'Editorial component estimates pending verified measurements or pro-usage data.', null, 'unverified'),
  ('0a14903d-5f60-41d7-82ea-50da1b52f46d', 'a039bc19-5631-46fa-8abd-6ca7e333f515', 'community', '4.5: firing animation and recoil improved (claim C4, secondary source — retest saved profiles).', 'https://www.sportsdunia.com/gaming/pubg-mobile-4-4-beta-weapon-balance-changes', 'unverified'),
  ('d80579b2-b05b-4355-8b28-4f376ea13fe9', 'f333dbf6-37e2-41be-88ab-97cce3dc5785', 'editorial', 'Editorial component estimates pending verified measurements or pro-usage data.', null, 'unverified'),
  ('a125c8b1-e520-4846-8e4d-4e0c36668ba7', 'f333dbf6-37e2-41be-88ab-97cce3dc5785', 'community', '4.5: firing animation and recoil improved (claim C4, secondary source — retest saved profiles).', 'https://www.sportsdunia.com/gaming/pubg-mobile-4-4-beta-weapon-balance-changes', 'unverified'),
  ('185003c6-23fa-4f67-85f6-1f739f14528a', '3c1f9e6c-d77d-4fae-8206-63e618039e26', 'editorial', 'Editorial component estimates pending verified measurements or pro-usage data.', null, 'unverified'),
  ('ee5dd93d-e616-4865-81b6-41ec651c8176', '8e36c93d-ef82-4f88-81f7-a635e2fd3122', 'editorial', 'Editorial component estimates pending verified measurements or pro-usage data.', null, 'unverified'),
  ('5b55a786-c25d-40b8-81ab-7afe207c3e5c', '9d348f93-eb37-4461-819c-a2ec0101eb89', 'editorial', 'Editorial component estimates pending verified measurements or pro-usage data.', null, 'unverified'),
  ('8299b25c-a465-4893-820c-676a3f1bac98', '35d6ded8-51bb-4352-877e-f210cd470295', 'editorial', 'Editorial component estimates pending verified measurements or pro-usage data.', null, 'unverified'),
  ('0cbd20d6-036c-483a-82e6-27e546eff782', '8872000c-c4b3-463f-88f1-968113e6c5e1', 'editorial', 'Editorial component estimates pending verified measurements or pro-usage data.', null, 'unverified'),
  ('e24e3032-06e0-4876-80b8-6c54c137e0ef', '22dc0abe-97f7-469e-861f-9235e2e3f057', 'editorial', 'Editorial component estimates pending verified measurements or pro-usage data.', null, 'unverified'),
  ('e85c9634-4111-4e1d-8213-ad3c1c2ab6d4', '1a82d392-fa70-4c99-8545-6868a024f9b8', 'editorial', 'Editorial component estimates pending verified measurements or pro-usage data.', null, 'unverified'),
  ('8fec7368-33ad-4f18-81a4-abeecd3ba9d2', '31ef5a08-be76-4cfe-83f0-e3e60631f878', 'editorial', 'Editorial component estimates pending verified measurements or pro-usage data.', null, 'unverified'),
  ('716f1325-7150-4353-8a4b-dd1a68b09b16', '8c2907ee-e097-43fd-825b-a606a84a56c1', 'editorial', 'Editorial component estimates pending verified measurements or pro-usage data.', null, 'unverified'),
  ('302be046-c696-4c68-8ae8-0ba83e6c6f0f', '2f8fc06b-8ca4-40f8-8f95-3217347c7abc', 'editorial', 'Editorial component estimates pending verified measurements or pro-usage data.', null, 'unverified'),
  ('a21647fa-b03a-41a7-8974-e9ae91811578', '44d99e72-2098-4417-8c1a-33c310a862f8', 'editorial', 'Editorial component estimates pending verified measurements or pro-usage data.', null, 'unverified'),
  ('f2e8b4c7-2e03-4b3a-8e2d-100ec7bead27', 'd0063fda-e31c-49f2-88b4-3dfc352b5cf3', 'editorial', 'Editorial component estimates pending verified measurements or pro-usage data.', null, 'unverified'),
  ('4fdd57e1-55e1-4a08-8127-9ffbc3cbf7ec', '0f903d06-3e43-49b0-86b1-9d16b7ac1128', 'editorial', 'Editorial component estimates pending verified measurements or pro-usage data.', null, 'unverified'),
  ('c82c567d-a7f0-4390-8249-e335c5cc1a44', '0f903d06-3e43-49b0-86b1-9d16b7ac1128', 'community', '4.5 SMG-class mobility changes may apply (claim C5, class-level, unconfirmed per weapon).', 'https://www.sportsdunia.com/gaming/pubg-mobile-4-4-beta-weapon-balance-changes', 'unverified'),
  ('9636133a-4d26-413c-8ca3-fefd6eb0406c', '0fd10326-594a-47e9-8ec5-139eb5b0494b', 'editorial', 'Editorial component estimates pending verified measurements or pro-usage data.', null, 'unverified'),
  ('5cbe33b1-5699-4cdf-8528-b4e744347574', '0fd10326-594a-47e9-8ec5-139eb5b0494b', 'community', '4.5 SMG-class mobility changes may apply (claim C5, class-level, unconfirmed per weapon).', 'https://www.sportsdunia.com/gaming/pubg-mobile-4-4-beta-weapon-balance-changes', 'unverified'),
  ('d806678f-c3eb-4799-80d9-4a2148f255d6', '5144ae59-4f3a-4c3c-87be-431065692425', 'editorial', 'Editorial component estimates pending verified measurements or pro-usage data.', null, 'unverified'),
  ('8596abc7-5dc7-49f1-85bb-43be4ac07205', '5144ae59-4f3a-4c3c-87be-431065692425', 'community', '4.5 SMG-class mobility changes may apply (claim C5).', 'https://www.sportsdunia.com/gaming/pubg-mobile-4-4-beta-weapon-balance-changes', 'unverified'),
  ('1766460b-cfa7-4193-8b2b-cc76afe1d671', 'a3a81cc3-54b6-4cab-846e-1735c7921e42', 'editorial', 'Editorial component estimates pending verified measurements or pro-usage data.', null, 'unverified'),
  ('fed6dfd5-8e2a-4419-8736-9f4c10896c3e', 'a3a81cc3-54b6-4cab-846e-1735c7921e42', 'community', '4.5 SMG-class mobility changes may apply (claim C5).', 'https://www.sportsdunia.com/gaming/pubg-mobile-4-4-beta-weapon-balance-changes', 'unverified'),
  ('af92c6f1-99b8-44ac-8bce-86f4643c1170', 'bae11700-a3e5-4e48-8753-9d6b8b7834ce', 'editorial', 'Editorial component estimates pending verified measurements or pro-usage data.', null, 'unverified'),
  ('c75ccedc-dffa-4156-8741-14fe2632eff8', 'bae11700-a3e5-4e48-8753-9d6b8b7834ce', 'community', '4.5 SMG-class mobility changes may apply (claim C5).', 'https://www.sportsdunia.com/gaming/pubg-mobile-4-4-beta-weapon-balance-changes', 'unverified'),
  ('34ba8720-8a98-452a-8a54-4ab34607b7e7', 'a08b0bcc-c843-4d75-85aa-321fe74c5bce', 'editorial', 'Editorial component estimates pending verified measurements or pro-usage data.', null, 'unverified'),
  ('c38181dd-1466-4a77-8633-476f65cdfdf4', 'a08b0bcc-c843-4d75-85aa-321fe74c5bce', 'community', '4.5 SMG-class mobility changes may apply (claim C5).', 'https://www.sportsdunia.com/gaming/pubg-mobile-4-4-beta-weapon-balance-changes', 'unverified'),
  ('966d5a3e-8c1b-448d-8f0a-d2f99bf993f9', '0e7a0ce9-75d0-4b63-8425-b3323f6fc66b', 'editorial', 'Editorial component estimates pending verified measurements or pro-usage data.', null, 'unverified'),
  ('445dd180-b1cb-45f5-88b5-c04a250a6b7e', '0e7a0ce9-75d0-4b63-8425-b3323f6fc66b', 'community', '4.5 SMG-class mobility changes may apply (claim C5).', 'https://www.sportsdunia.com/gaming/pubg-mobile-4-4-beta-weapon-balance-changes', 'unverified'),
  ('543a2750-0653-4999-87b1-9d7c402da07f', 'b0eb7dea-8e71-4802-80be-6d8c0c272b64', 'editorial', 'Editorial component estimates pending verified measurements or pro-usage data.', null, 'unverified'),
  ('b933d983-d953-4a91-8142-1e11f4034d92', 'b0eb7dea-8e71-4802-80be-6d8c0c272b64', 'community', '4.5 SMG-class mobility changes may apply (claim C5).', 'https://www.sportsdunia.com/gaming/pubg-mobile-4-4-beta-weapon-balance-changes', 'unverified'),
  ('5fd40d95-47f6-4e29-89b0-44d0458f13d2', 'cd2754bd-b297-4efb-8e15-3c65d2c08cf0', 'editorial', 'Editorial component estimates pending verified measurements or pro-usage data.', null, 'unverified'),
  ('c3e91131-6bbb-4bef-8aed-2ec7f36587bf', 'cd2754bd-b297-4efb-8e15-3c65d2c08cf0', 'community', '4.5 SMG-class mobility changes may apply (claim C5).', 'https://www.sportsdunia.com/gaming/pubg-mobile-4-4-beta-weapon-balance-changes', 'unverified'),
  ('6c2b7136-32cb-4557-83b5-903bc08b5bc8', '558ccac2-a28a-4094-8362-92988f3ba12d', 'editorial', 'Editorial component estimates pending verified measurements or pro-usage data.', null, 'unverified'),
  ('7d74d51a-5f48-4700-800e-9d9956224f00', '558ccac2-a28a-4094-8362-92988f3ba12d', 'community', '4.5 SMG-class mobility changes may apply (claim C5).', 'https://www.sportsdunia.com/gaming/pubg-mobile-4-4-beta-weapon-balance-changes', 'unverified'),
  ('fe7fe469-2194-446a-88ae-f1b2a762576d', '6d9ff318-3630-4afc-85ef-ddcdaef39ab3', 'editorial', 'Editorial component estimates pending verified measurements or pro-usage data.', null, 'unverified'),
  ('45a43c6c-4f25-4f68-86bd-93432c96a52b', 'a37af217-c68c-4262-81ce-9d16179dcbfa', 'editorial', 'Editorial component estimates pending verified measurements or pro-usage data.', null, 'unverified'),
  ('7673e8fa-09e9-473e-8bec-e287022d2d46', '277af61a-8d69-4427-820a-632273920407', 'editorial', 'Editorial component estimates pending verified measurements or pro-usage data.', null, 'unverified'),
  ('81292216-a21b-444e-8a7f-2e01305a407d', 'cbac503b-0065-4220-8611-09325004f0de', 'editorial', 'Editorial component estimates pending verified measurements or pro-usage data.', null, 'unverified'),
  ('ce21db0a-8eda-47b3-8249-427258a77ff5', 'aea7e468-bacf-455f-870c-9e020de7fdd1', 'editorial', 'Editorial component estimates pending verified measurements or pro-usage data.', null, 'unverified'),
  ('220ca307-e03d-4092-8c9d-f87b5bfed15f', '86a41258-a185-432c-8dd7-9ed5f80c9106', 'editorial', 'Editorial component estimates pending verified measurements or pro-usage data.', null, 'unverified'),
  ('3f2416b0-f958-4a2e-8567-d199ddc6dd77', '01108e43-4527-45a8-84fc-2107aceb7022', 'editorial', 'Editorial component estimates pending verified measurements or pro-usage data.', null, 'unverified'),
  ('c0be81b6-79f2-4767-8136-471bf2b4df18', 'd854dc53-e473-4a4e-82c1-b7fd585430ab', 'editorial', 'Editorial component estimates pending verified measurements or pro-usage data.', null, 'unverified'),
  ('9b9c7a7e-757a-40f2-8c80-865c93d5c6a0', 'fb4da399-8c02-43d9-86ea-e50f08ad99a8', 'editorial', 'Editorial component estimates pending verified measurements or pro-usage data.', null, 'unverified'),
  ('29d1e8fe-6933-47a2-86c9-cbde3ba6ba0e', 'ba4f65b6-f52d-4b54-83c3-7864f48f5b46', 'editorial', 'Editorial component estimates pending verified measurements or pro-usage data.', null, 'unverified'),
  ('1e9e7235-bc1e-4b68-8e68-8d8cb0195956', '264216db-b5d3-4b5a-8f4f-5ccbf809a2a1', 'editorial', 'Editorial component estimates pending verified measurements or pro-usage data.', null, 'unverified'),
  ('d97e10c5-f55d-484b-824f-c7109963a50e', 'b65ab3ec-1a7d-45b1-8eac-443b9d5e7b83', 'editorial', 'Editorial component estimates pending verified measurements or pro-usage data.', null, 'unverified'),
  ('5f080f5f-0f98-482f-8809-06741ee00bc9', '2df006e6-68a3-42b1-8de7-f3670a384df8', 'editorial', 'Editorial component estimates pending verified measurements or pro-usage data.', null, 'unverified'),
  ('ed48716d-951b-4574-8b68-a18aaf63c60c', '1040b371-c801-4c5e-8596-56e9e70f7df9', 'editorial', 'Editorial component estimates pending verified measurements or pro-usage data.', null, 'unverified'),
  ('7308ae5a-0a94-4b44-8a0c-c6a101339d0f', '949f7bed-af98-4824-8782-e5ac93aa7114', 'editorial', 'Editorial component estimates pending verified measurements or pro-usage data.', null, 'unverified'),
  ('fa9f8eed-62cb-4e32-860e-3f770b2914bf', 'da5bd77c-5276-4ead-870b-753019bdeb0b', 'editorial', 'Editorial component estimates pending verified measurements or pro-usage data.', null, 'unverified'),
  ('8cc711f3-ab92-4fd5-8909-b7855b5fd556', '098d9cb6-2f3b-487e-8773-ad7084132a57', 'editorial', 'Editorial component estimates pending verified measurements or pro-usage data.', null, 'unverified'),
  ('dc2bccbf-8c1d-4ea1-8d5a-216580985491', '76d4a33a-e9c0-406b-8e04-046dea2a0c5f', 'editorial', 'Editorial component estimates pending verified measurements or pro-usage data.', null, 'unverified'),
  ('09215ff2-58bd-4d43-8eea-4b4e4e079c80', 'a4682ac5-f854-4778-8d49-94e1b4280d0a', 'editorial', 'Editorial component estimates pending verified measurements or pro-usage data.', null, 'unverified'),
  ('f0bedbec-1c0b-467f-8aaa-58d03fcf4200', '14da2aec-f9cd-4668-89bf-54c78ffb6ee4', 'editorial', 'Editorial component estimates pending verified measurements or pro-usage data.', null, 'unverified'),
  ('ebb67039-80a4-42ef-8888-77f4f2591340', '2501047f-4fc8-4e67-8bf7-d0c5522e4e69', 'editorial', 'Editorial component estimates pending verified measurements or pro-usage data.', null, 'unverified'),
  ('1947b788-8355-451b-8749-d89b19f2b906', '6eb6eb41-8cf6-4288-897b-d4f8cc4759d4', 'editorial', 'Editorial component estimates pending verified measurements or pro-usage data.', null, 'unverified'),
  ('dc607dec-2d5c-4f55-88a8-2e36fa8b3220', '112bd6e8-0e89-443a-86bb-0465c71bf3d3', 'editorial', 'Editorial component estimates pending verified measurements or pro-usage data.', null, 'unverified'),
  ('a5fa9b77-d0c2-450f-8ec8-e8289084aba6', '3f354075-c594-4a2a-8a3a-2cf9f0c6c0d8', 'editorial', 'Editorial component estimates pending verified measurements or pro-usage data.', null, 'unverified'),
  ('195c8dd5-e4ca-45ce-8eee-c235626f8086', 'b4385e64-782d-47b9-8c59-008669ca0017', 'editorial', 'Editorial component estimates pending verified measurements or pro-usage data.', null, 'unverified'),
  ('68a5634b-58ad-40b2-80b3-61446d7e3f49', 'a1215a9a-a893-46eb-8635-cac9137004ce', 'editorial', 'Editorial component estimates pending verified measurements or pro-usage data.', null, 'unverified')
on conflict (id) do update set
    weapon_tier_id = excluded.weapon_tier_id,
    kind = excluded.kind,
    summary = excluded.summary,
    url = excluded.url,
    data_status = excluded.data_status;

insert into public.sources (id, name, url, source_type, published_on, retrieved_on, reliability, notes) values
  ('40c1ea9c-d27e-42e5-8ce2-80f631da121e', 'vpesports — PUBG Mobile 4.5 patch schedule', 'https://vpesports.com/games/pubg/pubg-mobile-summer-2026', 'news', null, '2026-07-21', 'medium', 'Secondary source; corroborates 4.5 launch and window.'),
  ('565bfc9c-b46d-4ed1-81ca-065c64bf0a73', 'SportsDunia — PUBG Mobile 4.5 update release', 'https://www.sportsdunia.com/gaming/pubg-mobile-4-5-update-to-go-live', 'news', null, '2026-07-21', 'medium', null),
  ('140e7b8b-7d17-458a-83c7-c8736fa5dc65', 'EnjoyGM — PUBG Mobile 4.5 update walkthrough', 'https://www.enjoygm.com/blog/pubg-mobile/pubg-mobile-4-5-update', 'news', null, '2026-07-21', 'low', null),
  ('670163b7-0f68-46c8-8c76-7caed4df7033', 'TopupLive — PUBG Mobile Season 31 update', 'https://www.topuplive.com/news/pubg-mobile-season-31-update.html', 'news', null, '2026-07-21', 'medium', 'S31 Classic dates and Ultimate Royale start date.'),
  ('9174e2be-3eca-4191-87eb-d0c9708a1913', 'SportsDunia — PUBG Mobile 4.4/4.5 weapon balance changes', 'https://www.sportsdunia.com/gaming/pubg-mobile-4-4-beta-weapon-balance-changes', 'news', null, '2026-07-21', 'low', 'Beta-notes coverage of ACE32 and SMG changes; magnitudes unknown.'),
  ('e7a3d850-bcc1-47ce-8e58-08c8811a58e6', 'GamingOnPhone — Ultimate Royale mode rules', 'https://gamingonphone.com/news/pubg-mobile-ultimate-royale-mode/', 'news', null, '2026-07-21', 'medium', 'Aim assist disabled, no shop/flare, Crown-tier entry, esports zones.'),
  ('3e35d294-490a-4530-8780-ad0784f5ad02', 'GamesPress — official 4.5 press release (Naruto collaboration)', 'https://www.gamespress.com/PUBG-MOBILES-VERSION-45-UPDATE-INTRODUCES-ONE-OF-ITS-BIGGEST-EVER-COLL', 'press', null, '2026-07-21', 'medium', 'Official PR distribution channel; strongest source captured this pass.')
on conflict (id) do update set
    name = excluded.name,
    url = excluded.url,
    source_type = excluded.source_type,
    published_on = excluded.published_on,
    retrieved_on = excluded.retrieved_on,
    reliability = excluded.reliability,
    notes = excluded.notes;

insert into public.claims (id, slug, statement, verdict, confidence, game_version_id, notes, data_status) values
  ('62a837ca-1151-49d2-8332-f7d18ee4c67a', 'c1-45-launch', 'PUBG Mobile Version 4.5 launched globally on 2026-07-09 with a window to ~2026-09-07.', 'supported', 'medium', 'b4d83136-5de9-4cd9-81f6-3d547137ca90', 'Three independent secondary sources agree.', 'unverified'),
  ('c37526c6-d46f-4617-8bcf-c27d4c318fe9', 'c2-s31-classic-dates', 'S31 Classic Season runs 2026-07-16 through 2026-09-11 (UTC).', 'supported', 'medium', 'b4d83136-5de9-4cd9-81f6-3d547137ca90', null, 'unverified'),
  ('d66a2943-b241-40c1-8fca-496736bd6e93', 'c3-s31-ur-dates', 'S31 Ultimate Royale opens 2026-07-20 (UTC) and ends around 2026-09-07.', 'partial', 'low', 'b4d83136-5de9-4cd9-81f6-3d547137ca90', 'Start corroborated; end date inferred, not sourced.', 'unverified'),
  ('2e97bc2b-3a62-4548-88ab-b303f271e1a8', 'c4-ace32-recoil', 'Version 4.5 improved the ACE32''s firing animation and recoil control.', 'supported', 'low', 'b4d83136-5de9-4cd9-81f6-3d547137ca90', 'Magnitude unknown; no numeric deltas may be stored.', 'unverified'),
  ('01788413-b7e9-4bd5-8af7-88be1801e706', 'c5-smg-mobility', 'Version 4.5 SMG changes: no sprint-speed reduction while equipped and reduced moving bullet spread.', 'supported', 'low', 'b4d83136-5de9-4cd9-81f6-3d547137ca90', 'Which SMGs exactly is unconfirmed.', 'unverified'),
  ('8a8d1acd-c4ee-4f3b-8aee-9866a842d87f', 'c6-ur-ruleset', 'Ultimate Royale disables aim assist and the shop/flare guns, requires Crown tier to enter, and uses esports-standard zones.', 'supported', 'medium', 'b4d83136-5de9-4cd9-81f6-3d547137ca90', 'Long-standing mode rules; per-season diffs unverified.', 'unverified'),
  ('e2d35b47-3d5a-4880-84f7-b82f4ecce6bd', 'c7-45-content', '4.5 headline content: Naruto Shippuden themed mode, Spider-Man collaboration from 2026-07-30, and the Sea Odyssey mode return.', 'supported', 'medium', 'b4d83136-5de9-4cd9-81f6-3d547137ca90', 'GamesPress is an official PR channel.', 'unverified')
on conflict (slug) do update set
    statement = excluded.statement,
    verdict = excluded.verdict,
    confidence = excluded.confidence,
    game_version_id = excluded.game_version_id,
    notes = excluded.notes,
    data_status = excluded.data_status;

insert into public.claim_evidence (id, claim_id, source_id, supports, note) values
  ('a0cc9a8a-1ca3-453a-86cf-a2c32aa8a798', '62a837ca-1151-49d2-8332-f7d18ee4c67a', '40c1ea9c-d27e-42e5-8ce2-80f631da121e', true, null),
  ('b790055d-d6b6-4bae-8245-26849c96fe9c', '62a837ca-1151-49d2-8332-f7d18ee4c67a', '565bfc9c-b46d-4ed1-81ca-065c64bf0a73', true, null),
  ('c58d573b-e845-4a47-8ee2-bfecb1c8be9a', '62a837ca-1151-49d2-8332-f7d18ee4c67a', '140e7b8b-7d17-458a-83c7-c8736fa5dc65', true, null),
  ('7fdf5220-b4b6-4df4-88e5-5c0bd5b456c9', 'c37526c6-d46f-4617-8bcf-c27d4c318fe9', '670163b7-0f68-46c8-8c76-7caed4df7033', true, null),
  ('1b68cc6e-999f-4168-8146-07b174fc65b7', 'd66a2943-b241-40c1-8fca-496736bd6e93', '670163b7-0f68-46c8-8c76-7caed4df7033', true, 'Start date only.'),
  ('0eb51e57-2e03-4232-838c-dab80d90120e', '2e97bc2b-3a62-4548-88ab-b303f271e1a8', '9174e2be-3eca-4191-87eb-d0c9708a1913', true, null),
  ('31734255-699c-4661-8766-e78b0394ec23', '01788413-b7e9-4bd5-8af7-88be1801e706', '9174e2be-3eca-4191-87eb-d0c9708a1913', true, null),
  ('9509242d-e2ec-49b9-8f95-f061e1506832', '8a8d1acd-c4ee-4f3b-8aee-9866a842d87f', 'e7a3d850-bcc1-47ce-8e58-08c8811a58e6', true, null),
  ('e058a701-9278-4516-80f1-deec155cd39e', 'e2d35b47-3d5a-4880-84f7-b82f4ecce6bd', '3e35d294-490a-4530-8780-ad0784f5ad02', true, null),
  ('ca71e4ab-15ef-458a-8c70-942f3337edf0', 'e2d35b47-3d5a-4880-84f7-b82f4ecce6bd', '140e7b8b-7d17-458a-83c7-c8736fa5dc65', true, null)
on conflict (id) do update set
    claim_id = excluded.claim_id,
    source_id = excluded.source_id,
    supports = excluded.supports,
    note = excluded.note;

insert into public.review_tasks (id, title, detail, kind, entity_type, entity_id, status, priority) values
  ('8245ccf2-a107-479f-88f4-a224cf1e06ac', 'Capture official 4.5 patch notes', 'Snapshot the official in-game/website 4.5 patch notes and upgrade claims C1/C4/C5 sources from secondary to official.', 'verify', 'game_version', '4.5', 'open', 'high'),
  ('1abd55eb-383c-4887-82b4-a41c7f41217e', 'Confirm S31 Ultimate Royale end date', 'The 2026-09-07 end date is inferred (claim C3). Confirm from an official announcement.', 'verify', 'season', 's31-ultimate-royale', 'open', 'medium'),
  ('be0de7bd-a049-44c8-86e9-79d3e1e66357', 'Confirm the 4.5 Mobile map rotation', 'Search results conflated PC PUBG with Mobile. Verify which maps are live in 4.5 Classic (per mode) and fill map_versions.available.', 'verify', 'game_version', '4.5', 'open', 'high'),
  ('de332c78-45d8-4f67-8bbd-f66b14e3090a', 'Source per-weapon 4.5 balance details', 'Identify exactly which SMGs changed and the ACE32 adjustment scope; attach official or reproducible-measurement sources before any weapon_stats rows exist.', 'investigate', 'patch', '4.5.0', 'open', 'medium')
on conflict (id) do update set
    title = excluded.title,
    detail = excluded.detail,
    kind = excluded.kind,
    entity_type = excluded.entity_type,
    entity_id = excluded.entity_id,
    priority = excluded.priority;

insert into public.setting_definitions (slug, name, category, what_it_does, what_it_does_not, advantages, disadvantages, beginner_recommendation, competitive_recommendation, mode_notes, device_impact, retest_after_update, data_status, confidence, source_name, source_url, source_date) values
  ('aim_assist', 'Aim assist', 'aiming', 'Applies slight magnetism toward targets while ADS firing, smoothing small tracking errors.', 'It does not control recoil, flick for you, or work in Ultimate Royale where it is disabled.', 'More forgiving tracking, especially on smaller screens and lower touch precision.', 'Can drag your aim between multiple targets and hides tracking weaknesses you''ll need in UR.', 'On, until your manual tracking is consistent.', 'Train with it off if you play Ultimate Royale or tournament rules; use the A/B lab rather than guessing.', 'Disabled by rule in Ultimate Royale (unverified for the current season until officially confirmed).', null, true, 'unverified', 'low', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('gyroscope', 'Gyroscope', 'gyroscope', 'Moves your camera with physical device rotation, adding a second precise input channel.', 'It does not remove recoil — it gives you another way to counteract it manually.', 'Fine recoil control and micro-tracking without thumb travel.', 'Weeks of retraining, posture sensitivity, and drift on some devices.', 'Off or scope-on while learning fundamentals.', 'Scope-on or always-on is common at high ranks, but only with deliberate practice.', null, 'Gyro sensor quality varies by device; run the drift check in calibration.', true, 'unverified', 'low', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('ads_gyroscope', 'ADS gyroscope', 'gyroscope', 'Separate gyro sensitivity applied only while aiming down sights.', null, 'Lets you keep hip-fire gyro calm while using strong gyro control in scopes.', 'One more layer to calibrate per scope.', 'Leave matched to gyro defaults until comfortable.', 'Calibrate per scope with the spray tests — one variable at a time.', null, null, true, 'unverified', 'low', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('camera_sensitivity', 'Camera sensitivity', 'aiming', 'Controls how fast the camera turns from swipes when not aiming down sights.', 'It does not affect ADS aim — that''s ADS sensitivity.', 'Higher values turn faster for checking flanks; lower values steady your general view.', 'Too high causes overshooting on turns; too low loses fights to flanks.', 'Start near defaults; use the 90°/180° turn tests to tune.', 'Tune to consistently land 90° and 180° turns — speed you can''t stop isn''t speed.', null, 'Screen size changes effective swipe distance; recalibrate after device changes.', false, 'unverified', 'low', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('ads_sensitivity', 'ADS sensitivity', 'aiming', 'Per-scope aim speed while firing down sights — the core spray-control setting.', 'It does not change recoil magnitude, only how your corrections translate.', 'Per-scope tuning lets your 3× spray and 8× micro-adjustments both feel right.', 'Copying someone else''s values ignores your device, grip, and FPS.', 'Calibrate red dot and 3× first; they cover most fights.', 'Full per-scope calibration, retested after relevant balance patches.', null, 'Touch sampling and FPS change how corrections register.', true, 'unverified', 'low', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('free_look_sensitivity', 'Free look sensitivity', 'aiming', 'Speed of the eye-button camera that looks around without turning your character.', null, 'Fast awareness while running straight lines or gliding.', 'Very high values disorient more than they inform.', 'Defaults are fine.', 'High enough to check a full circle in one swipe.', null, null, false, 'unverified', 'low', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('camera_rotation_ads', 'Camera rotation while ADS', 'aiming', 'Allows turning the camera while holding ADS on bolt-actions and specific interactions.', null, 'Keeps awareness during slow scoping.', 'Occasional accidental camera movement during precise shots.', 'On.', 'On.', null, null, false, 'unverified', 'low', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('peek_and_fire', 'Peek & fire', 'controls', 'Adds lean buttons so you can expose only part of your body while shooting.', 'It does not make you harder to hit while fully exposed — positioning still decides that.', 'Smaller target profile in ranged fights and on ridgelines.', 'Two more buttons competing for screen space and fingers.', 'Off until your base layout is comfortable.', 'On — ridge fights and window duels demand it.', 'Essential in Ultimate Royale''s slower, cover-based fights.', null, false, 'unverified', 'low', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('peek_open_scope', 'Peek & open scope', 'controls', 'Automatically ADS when you press a lean button.', null, 'One input instead of two for the most common peek action.', 'Forces ADS when you only wanted to look.', 'Try both; keep what confuses you less.', 'Player preference — consistency matters more than the choice.', null, null, false, 'unverified', 'low', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('lean_mode', 'Lean mode (tap vs hold)', 'controls', 'Whether lean buttons toggle or require holding.', null, 'Hold gives finer control; tap frees a finger during long peeks.', 'Toggle can leave you leaning when you meant to reset.', 'Tap (toggle).', 'Hold, if your grip has a spare finger.', null, null, false, 'unverified', 'low', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('scope_mode', 'Scope mode (tap vs hold)', 'controls', 'Whether ADS toggles on tap or lasts only while held.', null, 'Hold naturally quick-scopes; tap suits long tracking sprays.', 'Hold occupies a finger through every fight.', 'Tap.', 'Many close-range specialists use hold for shotguns/SMGs — test in Arena.', 'Arena''s constant close fights are the best testbed.', null, false, 'unverified', 'low', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('quick_scope_switch', 'Quick scope switch', 'controls', 'Adds a button to swap between two scope magnifications on the fly.', null, '6× zoomed to 3× spraying without opening the backpack.', 'Another button to place; rarely used by beginners.', 'Off.', 'On for DMR/6× users.', null, null, false, 'unverified', 'low', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('bolt_action_fire_mode', 'Bolt-action firing mode', 'controls', 'Choose whether bolt-action rifles fire on release or on tap while scoped.', null, 'Release-to-fire enables drag-shot timing.', 'Release mode causes accidental shots while adjusting.', 'Tap to fire.', 'Test release mode only if you snipe a lot.', null, null, false, 'unverified', 'low', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('shotgun_fire_mode', 'Shotgun firing mode', 'controls', 'Configures tap vs release firing for shotguns.', null, 'Matches shotgun timing to your jiggle rhythm.', null, 'Default.', 'Preference; consistency wins.', null, null, false, 'unverified', 'low', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('left_side_fire_button', 'Left-side fire button', 'controls', 'Adds a mirrored fire button on the left so you can shoot while steering.', null, 'Two-finger players can fire without abandoning movement.', 'Accidental shots reveal your position.', 'On for two-finger layouts.', 'Usually off with 4+ fingers — the index finger handles fire.', null, null, false, 'unverified', 'low', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('fixed_joystick', 'Fixed vs floating joystick', 'controls', 'Whether the movement stick stays anchored or appears where your thumb lands.', null, 'Fixed builds muscle memory; floating forgives sloppy thumb placement.', 'Fixed punishes off-center presses; floating drifts your anchor mid-fight.', 'Floating.', 'Split preference among top players — commit to one.', null, 'Larger screens favor fixed placement.', false, 'unverified', 'low', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('joystick_size', 'Joystick size', 'controls', 'Scales the movement stick''s touch area.', null, 'Bigger sticks are harder to slip off during jiggles.', 'Oversized sticks crowd nearby buttons.', 'Slightly larger than default.', 'As large as your layout allows without collisions.', null, 'Tablets can afford much larger sticks.', false, 'unverified', 'low', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('sprint_activation', 'Sprint activation', 'controls', 'Configures how sprint engages from the joystick (push distance / auto-sprint zone).', null, 'Reliable sprint without over-pushing your thumb.', 'Aggressive auto-sprint can trigger during careful strafes.', 'Default.', 'Tune so jiggle strafes never accidentally sprint.', 'Critical in Arena where strafing accuracy decides fights.', null, false, 'unverified', 'low', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('healing_prompt', 'Smart healing prompt', 'gameplay', 'Suggests a context-appropriate healing item on one button.', 'It does not always pick what a human would — check before long heals.', 'Faster heals under pressure.', 'Occasionally wastes a big heal where a bandage sufficed.', 'On.', 'On, but learn manual overrides for endgame item discipline.', null, null, false, 'unverified', 'low', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('auto_open_doors', 'Auto-open doors', 'gameplay', 'Opens doors automatically when you run into them.', null, 'Smoother pushes without a button press.', 'Announces entries you wanted silent and opens doors mid-jiggle.', 'On.', 'Off — door control is information control.', 'Ultimate Royale players usually disable it.', null, false, 'unverified', 'low', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('auto_pickup', 'Auto-pickup', 'gameplay', 'Collects configured loot automatically as you walk over it.', 'It does not manage your backpack mid-fight — tune the pickup list.', 'Dramatically faster early loot phase.', 'Can swap attachments or fill your bag with unwanted ammo at the worst time.', 'On with defaults.', 'On with a curated list; disable attachment auto-swap.', null, null, true, 'unverified', 'low', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('throwables_quick_wheel', 'Throwables quick wheel', 'controls', 'Hold the grenade button to pick a specific throwable from a radial menu.', null, 'Smoke → frag → stun sequencing without the backpack.', 'Wheel time is exposure time.', 'On.', 'On — utility sequencing is a core endgame skill.', null, null, false, 'unverified', 'low', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('throwable_trajectory', 'Throwable trajectory display', 'gameplay', 'Shows the arc your grenade will follow before release.', 'It does not time your cook — that''s on you.', 'Reliable bank throws and window lobs.', 'Slight visual clutter.', 'On.', 'On.', null, null, false, 'unverified', 'low', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('canted_sight_behavior', 'Canted sight behavior', 'controls', 'Configures how you switch between primary scope and canted sight.', null, 'Instant 1× answer on a 6× DMR.', 'One more state to track mid-fight.', 'Ignore canted sights at first.', 'Practice the swap until it''s reflex for DMR builds.', null, null, false, 'unverified', 'low', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('fpp_swap', 'FPP swap button', 'controls', 'Adds a button to switch between TPP and FPP cameras mid-match where allowed.', null, 'FPP removes third-person peeking advantage checks in buildings.', 'Extra button; disorienting if rarely used.', 'Off.', 'Preference; some anchors use FPP indoors.', null, null, false, 'unverified', 'low', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('tpp_camera_view', 'TPP camera field of view', 'graphics', 'Widens or narrows the third-person camera''s field of view.', 'It does not change ADS zoom levels.', 'Wider view shows more flanks.', 'Targets appear smaller at range; some devices lose FPS.', 'Default.', 'Wider if your device holds frame rate.', null, 'FOV increases GPU load.', false, 'unverified', 'low', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('hit_marker', 'Hit markers & damage feedback', 'gameplay', 'Visual confirmation when your shots connect.', 'It does not show exact damage in most modes.', 'Confirms sprays at range and through smoke edges.', 'Minimal.', 'On.', 'On.', null, null, false, 'unverified', 'low', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('sound_quality', 'Sound quality', 'audio', 'Selects the audio processing tier for footsteps, gunshots, and vehicles.', 'It cannot overcome bad earbuds — hardware matters more.', 'Higher tiers separate footstep layers more cleanly.', 'Slight battery/CPU cost.', 'High, with any stereo earphones.', 'Highest your device sustains without thermal throttling.', null, 'Thermal throttling can cost more than the audio tier gains.', false, 'unverified', 'low', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('graphics_quality', 'Graphics quality', 'graphics', 'Overall render quality preset.', 'Higher quality does not improve visibility as much as stable FPS does.', 'Prettier matches on capable devices.', 'Blocks higher frame-rate tiers on many devices.', 'Smooth preset.', 'Smooth — always trade quality for frame rate.', null, 'The main lever for unlocking your device''s top FPS tier.', true, 'unverified', 'low', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('frame_rate', 'Frame rate', 'graphics', 'Caps the game''s target FPS from the tiers your device supports.', 'A higher cap doesn''t help if your device can''t hold it steadily.', 'Higher stable FPS improves tracking feel and input response.', 'Battery drain and heat; unstable high FPS is worse than stable lower FPS.', 'Highest tier your device holds without stutter.', 'Same — stability first; sensitivity must be recalibrated after FPS changes.', null, 'Supported tiers vary by device and version — verify per device.', true, 'unverified', 'low', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('anti_aliasing', 'Anti-aliasing', 'graphics', 'Smooths jagged edges on distant geometry.', null, 'Cleaner long-range silhouettes.', 'Meaningful FPS cost on mid-range devices.', 'Off if FPS matters.', 'Off unless your device has headroom.', null, 'One of the cheapest wins for regaining frame rate.', false, 'unverified', 'low', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('brightness', 'Brightness', 'graphics', 'In-game brightness curve on top of your device''s screen brightness.', null, 'Lifting shadows reveals players in dark interiors.', 'Washed-out contrast at extremes.', 'Slightly above default.', 'Tuned per map — brighter for Vikendi interiors, default for Miramar.', null, null, false, 'unverified', 'low', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('colorblind_modes', 'Colorblind modes', 'accessibility', 'Remaps key colors (blood, zone, markers) for common color-vision differences.', null, 'Critical information stops relying on colors you can''t separate.', 'None.', 'Use the mode matching your vision.', 'Some non-colorblind players prefer certain modes for zone clarity — legitimate to test.', null, null, false, 'unverified', 'low', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('death_replay', 'Death replay', 'gameplay', 'Records a short replay showing how you were knocked or killed.', 'It is not a cheat detector — network views differ from the killer''s screen.', 'The single best free coaching tool: see your exposure mistakes.', 'Small storage/processing cost.', 'On — watch every death.', 'On — review deaths for positioning patterns, not just aim.', null, null, false, 'unverified', 'low', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21'),
  ('haptic_feedback', 'Haptic feedback', 'controls', 'Vibrates on hits, kills, and interactions.', null, 'Physical confirmation without watching the HUD.', 'Vibration can blur gyro aim on some devices.', 'Preference.', 'Gyro players usually disable it.', null, 'Interferes with gyroscope stability on lighter phones.', false, 'unverified', 'low', 'ClutchLab editorial baseline (pending verification)', null, '2026-07-21')
on conflict (slug) do update set
    name = excluded.name,
    category = excluded.category,
    what_it_does = excluded.what_it_does,
    what_it_does_not = excluded.what_it_does_not,
    advantages = excluded.advantages,
    disadvantages = excluded.disadvantages,
    beginner_recommendation = excluded.beginner_recommendation,
    competitive_recommendation = excluded.competitive_recommendation,
    mode_notes = excluded.mode_notes,
    device_impact = excluded.device_impact,
    retest_after_update = excluded.retest_after_update,
    data_status = excluded.data_status,
    confidence = excluded.confidence,
    source_name = excluded.source_name,
    source_url = excluded.source_url,
    source_date = excluded.source_date;

insert into public.sensitivity_tests (slug, name, step_order, instructions, metric, adjusts_family, adjusts_scope, data_status) values
  ('baseline_setup', 'Baseline setup', 1, 'Enter your CURRENT in-game values first. Calibration adjusts your own numbers — it never invents a starting code.', 'setup', null, null, 'unverified'),
  ('turn_90', '90° turn test', 2, 'In Training Grounds, pick a target 90° to your right. Swipe once with your normal thumb stroke. Where did your crosshair land?', 'turn accuracy', 'camera', 'no_scope_tpp', 'unverified'),
  ('turn_180', '180° turn test', 3, 'Same drill, but turn to a target directly behind you with one swipe.', 'turn accuracy', 'camera', 'no_scope_fpp', 'unverified'),
  ('red_dot_tracking', 'Red-dot tracking test', 4, 'ADS with a red dot on a strafing target at ~15m. Track its head for 10 seconds. Does your crosshair drift ahead or behind?', 'tracking', 'ads', 'red_dot', 'unverified'),
  ('hipfire_strafe', 'Hip-fire strafe test', 5, 'Strafe left-right while hip-firing a stable AR at a 10m target. Watch the group center relative to the target.', 'hip-fire centering', 'camera', 'red_dot', 'unverified'),
  ('tracking_2x', '2× tracking test', 6, 'Repeat the tracking drill with a 2× at ~30m.', 'tracking', 'ads', 'x2', 'unverified'),
  ('spray_3x', '3× spray test', 7, 'Spray a full magazine at the 25m wall target with a 3×. Judge the horizontal spread of bullets 10–25.', 'spray group', 'ads', 'x3', 'unverified'),
  ('spray_4x', '4× spray test', 8, 'Same spray drill with a 4× at ~35m.', 'spray group', 'ads', 'x4', 'unverified'),
  ('spray_6x_reduced', '6× (zoomed to 3×) spray test', 9, 'Zoom a 6× down to 3× and repeat the spray drill.', 'spray group', 'ads', 'x6', 'unverified'),
  ('dmr_tap', 'DMR tap test', 10, 'Tap-fire a DMR with a 6× at 100m: 10 shots at your own cadence. Judge how far the reticle settles between shots.', 'reset control', 'ads', 'x6', 'unverified'),
  ('sniper_micro', 'Sniper micro-adjustment test', 11, 'With an 8×, move your crosshair between two head-size targets 5m apart at 200m. Can you stop precisely on each?', 'micro-adjustment', 'ads', 'x8', 'unverified'),
  ('gyro_drift', 'Gyroscope drift check', 12, 'Hold your aim on a 100m target for 10 seconds using gyro only, device in your normal grip. Does the reticle hold?', 'gyro stability', 'gyro', 'x3', 'unverified'),
  ('close_target_switch', 'Close-range target-switch test', 13, 'Hip-fire/red-dot between three targets in a 90° arc at 10m. Judge whether you land on each target or swing past.', 'target switching', 'camera', 'red_dot', 'unverified'),
  ('final_validation', 'Final validation', 14, 'Play one full Training Grounds circuit with the new values. If anything feels off, rerun only the affected step.', 'overall comfort', null, null, 'unverified')
on conflict (slug) do update set
    name = excluded.name,
    step_order = excluded.step_order,
    instructions = excluded.instructions,
    metric = excluded.metric,
    adjusts_family = excluded.adjusts_family,
    adjusts_scope = excluded.adjusts_scope,
    data_status = excluded.data_status;

insert into public.teams (slug, name, region, data_status, source_name) values
  ('sample-ionix', 'IONIX Esports (sample)', 'SEA', 'sample', 'ClutchLab sample data (fictional)'),
  ('sample-graviton', 'Graviton Gaming (sample)', 'EU', 'sample', 'ClutchLab sample data (fictional)'),
  ('sample-redline', 'Redline Five (sample)', 'SA', 'sample', 'ClutchLab sample data (fictional)')
on conflict (slug) do update set
    name = excluded.name,
    region = excluded.region,
    data_status = excluded.data_status,
    source_name = excluded.source_name;

insert into public.pro_profiles (slug, display_name, team_slug, region, role, device_label, fps_tier, finger_count, grip_style, gyro_mode, aim_assist, preferred_weapons, main_modes, verification, game_version_label, data_status, confidence, source_name, notes) values
  ('sample-novadrift', 'NovaDrift', 'sample-ionix', 'SEA', 'IGL / anchor', 'iPhone 15 Pro Max', '90 FPS', 4, 'claw_4', 'scope_on', 'off', '{"m416","mini14"}', '{"ultimate_royale","classic_ranked"}', 'sample', '4.5', 'sample', 'unverified', 'ClutchLab sample data (fictional)', 'Fictional sample profile for product demonstration — not a real player. Real profiles enter via the editorial verification workflow.'),
  ('sample-vex', 'VexMachina', 'sample-ionix', 'SEA', 'Entry fragger', 'ROG Phone 8 Pro', '120 FPS', 5, 'claw_5', 'always_on', 'off', '{"m762","ump45"}', '{"ultimate_royale","ranked_arena"}', 'sample', '4.5', 'sample', 'unverified', 'ClutchLab sample data (fictional)', 'Fictional sample profile for product demonstration — not a real player. Real profiles enter via the editorial verification workflow.'),
  ('sample-quietpine', 'QuietPine', 'sample-graviton', 'EU', 'Sniper / scout', 'iPad Pro 11', '120 FPS', 6, 'claw_6', 'off', 'on', '{"kar98k","mk12"}', '{"classic_ranked"}', 'sample', '4.5', 'sample', 'unverified', 'ClutchLab sample data (fictional)', 'Fictional sample profile for product demonstration — not a real player. Real profiles enter via the editorial verification workflow.'),
  ('sample-krait', 'Krait', 'sample-graviton', 'EU', 'Support', 'Galaxy S24 Ultra', '120 FPS', 4, 'claw_4', 'scope_on', 'off', '{"scarl","slr"}', '{"ultimate_royale","classic_ranked"}', 'sample', '4.5', 'sample', 'unverified', 'ClutchLab sample data (fictional)', 'Fictional sample profile for product demonstration — not a real player. Real profiles enter via the editorial verification workflow.'),
  ('sample-mirage7', 'Mirage7', 'sample-redline', 'SA', 'Entry fragger', 'POCO F5', '90 FPS', 3, 'claw_3', 'off', 'on', '{"akm","vector"}', '{"classic_ranked","arena_casual"}', 'sample', '4.5', 'sample', 'unverified', 'ClutchLab sample data (fictional)', 'Fictional sample profile for product demonstration — not a real player. Real profiles enter via the editorial verification workflow.'),
  ('sample-tundra', 'TundraOak', 'sample-redline', 'SA', 'IGL', 'iPhone 13', '60 FPS', 2, 'thumbs', 'off', 'on', '{"m416","sks"}', '{"classic_ranked"}', 'sample', '4.5', 'sample', 'unverified', 'ClutchLab sample data (fictional)', 'Fictional sample profile for product demonstration — not a real player. Real profiles enter via the editorial verification workflow.'),
  ('sample-lumen', 'LumenShot', null, 'MENA', 'Creator / coach', 'OnePlus 12', '120 FPS', 4, 'claw_4', 'always_on', 'off', '{"ace32","mk12"}', '{"ultimate_royale","wow"}', 'sample', '4.5', 'sample', 'unverified', 'ClutchLab sample data (fictional)', 'Fictional sample profile for product demonstration — not a real player. Real profiles enter via the editorial verification workflow.'),
  ('sample-hexa', 'HexaByte', null, 'NA', 'Creator', 'Pixel 8 Pro', '90 FPS', 4, 'hybrid', 'scope_on', 'on', '{"aug","mini14"}', '{"classic_casual","classic_ranked"}', 'sample', '4.5', 'sample', 'unverified', 'ClutchLab sample data (fictional)', 'Fictional sample profile for product demonstration — not a real player. Real profiles enter via the editorial verification workflow.'),
  ('sample-rushlily', 'RushLily', null, 'SEA', 'Arena specialist', 'iQOO 11', '120 FPS', 5, 'claw_5', 'off', 'on', '{"ump45","m1014"}', '{"ranked_arena","arena_casual"}', 'sample', '4.5', 'sample', 'unverified', 'ClutchLab sample data (fictional)', 'Fictional sample profile for product demonstration — not a real player. Real profiles enter via the editorial verification workflow.'),
  ('sample-stoneveil', 'StoneVeil', null, 'KR/JP', 'Anchor', 'Sample budget device (60 Hz)', '60 FPS', 3, 'claw_3', 'off', 'on', '{"dp28","kar98k"}', '{"classic_ranked"}', 'sample', '4.5', 'sample', 'unverified', 'ClutchLab sample data (fictional)', 'Fictional sample profile for product demonstration — not a real player. Real profiles enter via the editorial verification workflow.')
on conflict (slug) do update set
    display_name = excluded.display_name,
    team_slug = excluded.team_slug,
    region = excluded.region,
    role = excluded.role,
    device_label = excluded.device_label,
    fps_tier = excluded.fps_tier,
    finger_count = excluded.finger_count,
    grip_style = excluded.grip_style,
    gyro_mode = excluded.gyro_mode,
    aim_assist = excluded.aim_assist,
    preferred_weapons = excluded.preferred_weapons,
    main_modes = excluded.main_modes,
    verification = excluded.verification,
    game_version_label = excluded.game_version_label,
    data_status = excluded.data_status,
    confidence = excluded.confidence,
    source_name = excluded.source_name,
    notes = excluded.notes;

insert into public.pro_settings (id, pro_slug, family, scope, value, data_status, source_name) values
  ('36a1b927-8d13-4953-8968-137f526910d4', 'sample-novadrift', 'camera', 'no_scope_tpp', 110, 'sample', 'ClutchLab sample data (fictional)'),
  ('b7734598-4607-4d18-8a52-5dfcab82ea88', 'sample-novadrift', 'camera', 'no_scope_fpp', 105, 'sample', 'ClutchLab sample data (fictional)'),
  ('ad81e7ca-399b-436a-84e5-28cd06584187', 'sample-novadrift', 'camera', 'red_dot', 88, 'sample', 'ClutchLab sample data (fictional)'),
  ('7b74c4b1-222c-4d74-8eb7-cfede05cbdc8', 'sample-novadrift', 'ads', 'red_dot', 64, 'sample', 'ClutchLab sample data (fictional)'),
  ('30041d63-9d92-438e-87c6-cff6d3400bec', 'sample-novadrift', 'ads', 'x2', 52, 'sample', 'ClutchLab sample data (fictional)'),
  ('51c9b181-3f2a-4f08-8663-639a365cb28e', 'sample-novadrift', 'ads', 'x3', 38, 'sample', 'ClutchLab sample data (fictional)'),
  ('77437af1-c603-464a-8aaf-851c9405f55e', 'sample-novadrift', 'ads', 'x4', 30, 'sample', 'ClutchLab sample data (fictional)'),
  ('d8b0f914-f802-4eb1-8a4b-c44c0fda12bb', 'sample-novadrift', 'ads', 'x6', 24, 'sample', 'ClutchLab sample data (fictional)'),
  ('403d9ef3-840c-42a2-8886-8a8022fe36cd', 'sample-novadrift', 'ads', 'x8', 14, 'sample', 'ClutchLab sample data (fictional)'),
  ('040455c1-87f7-495a-8b40-14c27530df8e', 'sample-novadrift', 'gyro', 'x3', 260, 'sample', 'ClutchLab sample data (fictional)'),
  ('2790275f-4a33-4144-8c5e-86a85f23726e', 'sample-novadrift', 'free_look', null, 120, 'sample', 'ClutchLab sample data (fictional)'),
  ('c629e27b-d5b9-4358-8c25-b8e4d2113007', 'sample-vex', 'camera', 'no_scope_tpp', 132, 'sample', 'ClutchLab sample data (fictional)'),
  ('483e118a-24f5-4ad7-8b3b-258f77b1b437', 'sample-vex', 'camera', 'red_dot', 102, 'sample', 'ClutchLab sample data (fictional)'),
  ('83fc96e4-df8a-4620-8f4c-a26452cf066d', 'sample-vex', 'ads', 'red_dot', 75, 'sample', 'ClutchLab sample data (fictional)'),
  ('d7879f37-a2c4-4031-8166-6f2fd5c69e05', 'sample-vex', 'ads', 'x2', 60, 'sample', 'ClutchLab sample data (fictional)'),
  ('4da8558d-01c1-4ff0-8d59-505b14d783a7', 'sample-vex', 'ads', 'x3', 45, 'sample', 'ClutchLab sample data (fictional)'),
  ('91996eb1-99c3-482b-8d5f-eae9d4725704', 'sample-vex', 'ads', 'x4', 34, 'sample', 'ClutchLab sample data (fictional)'),
  ('9442a42c-3713-441c-8a12-10ecbb3ebaad', 'sample-vex', 'ads', 'x6', 26, 'sample', 'ClutchLab sample data (fictional)'),
  ('bbb0066a-7ace-462b-8784-b00f443db0f8', 'sample-vex', 'gyro', 'x3', 300, 'sample', 'ClutchLab sample data (fictional)'),
  ('ac73ad1a-830d-429b-8866-5459bca6a641', 'sample-vex', 'ads_gyro', 'x3', 280, 'sample', 'ClutchLab sample data (fictional)'),
  ('f399b6b5-1d2a-4753-8524-72b6adcb0d85', 'sample-vex', 'free_look', null, 140, 'sample', 'ClutchLab sample data (fictional)'),
  ('8d2ae868-6d91-42ab-8933-254d7b245c72', 'sample-quietpine', 'camera', 'no_scope_tpp', 95, 'sample', 'ClutchLab sample data (fictional)'),
  ('7cd0d161-26c0-49be-89e7-cd13b6dd2821', 'sample-quietpine', 'camera', 'red_dot', 80, 'sample', 'ClutchLab sample data (fictional)'),
  ('5e62f905-c2ec-49f4-829f-7d532ae04a82', 'sample-quietpine', 'ads', 'red_dot', 58, 'sample', 'ClutchLab sample data (fictional)'),
  ('b72f79e8-4aaa-432c-8ea9-c7e25717d27b', 'sample-quietpine', 'ads', 'x2', 48, 'sample', 'ClutchLab sample data (fictional)'),
  ('5de51168-6a55-49df-81ac-c75c8d2f98c9', 'sample-quietpine', 'ads', 'x3', 36, 'sample', 'ClutchLab sample data (fictional)'),
  ('7c901910-6416-4d7b-85ed-20dc93c97f7e', 'sample-quietpine', 'ads', 'x4', 28, 'sample', 'ClutchLab sample data (fictional)'),
  ('e38a5ccd-4e6c-483b-871b-368769d2a4d5', 'sample-quietpine', 'ads', 'x6', 20, 'sample', 'ClutchLab sample data (fictional)'),
  ('b2f27195-954d-46f6-825e-d017c7244a52', 'sample-quietpine', 'ads', 'x8', 10, 'sample', 'ClutchLab sample data (fictional)'),
  ('9ae81555-0f18-47e3-8daa-8e05ccda0952', 'sample-quietpine', 'free_look', null, 110, 'sample', 'ClutchLab sample data (fictional)'),
  ('6bd339e6-c6c8-46fd-8948-b60880983b22', 'sample-krait', 'camera', 'no_scope_tpp', 118, 'sample', 'ClutchLab sample data (fictional)'),
  ('b2997d9b-c0a4-4384-8858-ed1c4231ccd3', 'sample-krait', 'camera', 'red_dot', 92, 'sample', 'ClutchLab sample data (fictional)'),
  ('cc47abba-f812-46ae-87bd-84b2a2087f52', 'sample-krait', 'ads', 'red_dot', 66, 'sample', 'ClutchLab sample data (fictional)'),
  ('c6e594af-1fed-4d4d-81c5-bb6d9972f46c', 'sample-krait', 'ads', 'x2', 54, 'sample', 'ClutchLab sample data (fictional)'),
  ('20cd204f-8d1f-4e11-8056-e9f0ca6e5eff', 'sample-krait', 'ads', 'x3', 40, 'sample', 'ClutchLab sample data (fictional)'),
  ('cf196cdb-32b4-475c-8c09-7ec74b876af6', 'sample-krait', 'ads', 'x4', 31, 'sample', 'ClutchLab sample data (fictional)'),
  ('f59c2d7a-09df-49b7-8f53-6d9c933d7b25', 'sample-krait', 'ads', 'x6', 24, 'sample', 'ClutchLab sample data (fictional)'),
  ('0129d11c-da4c-491d-8c83-005b267dcdda', 'sample-krait', 'gyro', 'x3', 240, 'sample', 'ClutchLab sample data (fictional)'),
  ('d10fe603-e460-4850-8ae4-89a34ca040d9', 'sample-krait', 'free_look', null, 130, 'sample', 'ClutchLab sample data (fictional)'),
  ('3ebf3102-318e-4b09-8e97-f8f89a0caeb3', 'sample-mirage7', 'camera', 'no_scope_tpp', 125, 'sample', 'ClutchLab sample data (fictional)'),
  ('2e752c9e-fc85-4b28-8651-ce616c96a640', 'sample-mirage7', 'camera', 'red_dot', 100, 'sample', 'ClutchLab sample data (fictional)'),
  ('a9999a7d-1581-4c54-8b2a-fe9afa0dbcb3', 'sample-mirage7', 'ads', 'red_dot', 72, 'sample', 'ClutchLab sample data (fictional)'),
  ('a4bd5fbf-0662-4344-8656-612a35ac8e44', 'sample-mirage7', 'ads', 'x2', 58, 'sample', 'ClutchLab sample data (fictional)'),
  ('42678221-10e7-4b35-8147-86f0abfb45d7', 'sample-mirage7', 'ads', 'x3', 44, 'sample', 'ClutchLab sample data (fictional)'),
  ('6842e548-553e-47f5-80e1-9f7d9d27f213', 'sample-mirage7', 'ads', 'x4', 33, 'sample', 'ClutchLab sample data (fictional)'),
  ('df652043-f404-4a82-8994-06774656c710', 'sample-mirage7', 'ads', 'x6', 25, 'sample', 'ClutchLab sample data (fictional)'),
  ('4374e543-47a7-4510-8132-627d91568432', 'sample-mirage7', 'free_look', null, 118, 'sample', 'ClutchLab sample data (fictional)'),
  ('ed196d5c-d22f-4f75-82d3-4d6d55e1e427', 'sample-tundra', 'camera', 'no_scope_tpp', 100, 'sample', 'ClutchLab sample data (fictional)'),
  ('fb4c991c-b3c0-4c07-8c0d-bd385147477e', 'sample-tundra', 'camera', 'red_dot', 85, 'sample', 'ClutchLab sample data (fictional)'),
  ('73a30d38-461f-4e41-840f-18bfd962e394', 'sample-tundra', 'ads', 'red_dot', 60, 'sample', 'ClutchLab sample data (fictional)'),
  ('dfbabee2-032a-49d4-851c-df2f1c4772f0', 'sample-tundra', 'ads', 'x2', 50, 'sample', 'ClutchLab sample data (fictional)'),
  ('f53a51b1-553c-4c19-8e82-769a7e92e8bc', 'sample-tundra', 'ads', 'x3', 37, 'sample', 'ClutchLab sample data (fictional)'),
  ('88192b39-3918-44f3-8baa-3f8425fd3d5f', 'sample-tundra', 'ads', 'x4', 29, 'sample', 'ClutchLab sample data (fictional)'),
  ('bf7ac227-6ae3-4d3d-859f-0ad49b0a2107', 'sample-tundra', 'ads', 'x6', 22, 'sample', 'ClutchLab sample data (fictional)'),
  ('28bb8830-809d-4484-87e4-4f9b2192d338', 'sample-tundra', 'free_look', null, 100, 'sample', 'ClutchLab sample data (fictional)'),
  ('6e39db48-0f2c-48a5-8e27-532153afd031', 'sample-lumen', 'camera', 'no_scope_tpp', 115, 'sample', 'ClutchLab sample data (fictional)'),
  ('ad9ce4b3-103c-49f6-8ad0-d10e7bc4f909', 'sample-lumen', 'camera', 'red_dot', 90, 'sample', 'ClutchLab sample data (fictional)'),
  ('fbef3b16-6d27-4eff-8184-c1978a38b137', 'sample-lumen', 'ads', 'red_dot', 62, 'sample', 'ClutchLab sample data (fictional)'),
  ('97290167-52ad-43eb-8545-49e0763aa2b2', 'sample-lumen', 'ads', 'x2', 51, 'sample', 'ClutchLab sample data (fictional)'),
  ('06cb6da3-891a-4400-8d5a-876da6089e56', 'sample-lumen', 'ads', 'x3', 39, 'sample', 'ClutchLab sample data (fictional)'),
  ('571b7d8d-0c9f-496d-89de-27503c1ee7ee', 'sample-lumen', 'ads', 'x4', 30, 'sample', 'ClutchLab sample data (fictional)'),
  ('f9249360-9007-4263-86f1-b89929ca9b56', 'sample-lumen', 'ads', 'x6', 23, 'sample', 'ClutchLab sample data (fictional)'),
  ('4d1dcf92-f3d8-4d3b-83b8-863d6b9caa0a', 'sample-lumen', 'gyro', 'x3', 290, 'sample', 'ClutchLab sample data (fictional)'),
  ('1d7b29d8-633c-4aad-8bd5-047bf76ddac9', 'sample-lumen', 'ads_gyro', 'x3', 270, 'sample', 'ClutchLab sample data (fictional)'),
  ('3f4d32cd-aeb9-4d5f-8445-fb78dc904c94', 'sample-lumen', 'free_look', null, 125, 'sample', 'ClutchLab sample data (fictional)'),
  ('04b326b6-1b6c-4b7d-8976-d6bec3b743e7', 'sample-hexa', 'camera', 'no_scope_tpp', 108, 'sample', 'ClutchLab sample data (fictional)'),
  ('d8cda769-8853-4d84-8dfa-d343e14d0ec9', 'sample-hexa', 'camera', 'red_dot', 86, 'sample', 'ClutchLab sample data (fictional)'),
  ('e3e1a534-0213-45d9-8b4c-9c6b0eea7174', 'sample-hexa', 'ads', 'red_dot', 63, 'sample', 'ClutchLab sample data (fictional)'),
  ('072fc7c5-3fcb-426c-8595-f06a114b5184', 'sample-hexa', 'ads', 'x2', 52, 'sample', 'ClutchLab sample data (fictional)'),
  ('66c5137f-1cfe-40ca-868c-22be86bca0c0', 'sample-hexa', 'ads', 'x3', 40, 'sample', 'ClutchLab sample data (fictional)'),
  ('f8be69d3-f69e-4b17-81ea-91137795baa2', 'sample-hexa', 'ads', 'x4', 31, 'sample', 'ClutchLab sample data (fictional)'),
  ('bc887e0a-8461-4efa-8ed8-23e2cbf71225', 'sample-hexa', 'ads', 'x6', 24, 'sample', 'ClutchLab sample data (fictional)'),
  ('c157ce1c-a377-4b80-8df4-7ceb22b52c94', 'sample-hexa', 'gyro', 'x3', 220, 'sample', 'ClutchLab sample data (fictional)'),
  ('328d47b5-6af6-4a0f-8ef5-cd5666ace9df', 'sample-hexa', 'free_look', null, 115, 'sample', 'ClutchLab sample data (fictional)'),
  ('1cc7b9f3-ab1d-4d72-83f9-9b5012d281d3', 'sample-rushlily', 'camera', 'no_scope_tpp', 140, 'sample', 'ClutchLab sample data (fictional)'),
  ('6c3f5f8f-a104-4dff-8b53-ad90d1c6ff06', 'sample-rushlily', 'camera', 'red_dot', 112, 'sample', 'ClutchLab sample data (fictional)'),
  ('926730ab-f13c-4f16-8b46-6049f2cb18db', 'sample-rushlily', 'ads', 'red_dot', 82, 'sample', 'ClutchLab sample data (fictional)'),
  ('2226b819-bc6c-419d-8cc5-da32e53d7a7d', 'sample-rushlily', 'ads', 'x2', 64, 'sample', 'ClutchLab sample data (fictional)'),
  ('25ea9adc-7e93-4b53-8806-4b3edf0a1c4f', 'sample-rushlily', 'ads', 'x3', 48, 'sample', 'ClutchLab sample data (fictional)'),
  ('30a1d10c-fa85-4b87-8ac9-e733b2db8c02', 'sample-rushlily', 'ads', 'x4', 36, 'sample', 'ClutchLab sample data (fictional)'),
  ('c726a607-2be0-4a6c-8e3d-0405d320ce64', 'sample-rushlily', 'ads', 'x6', 27, 'sample', 'ClutchLab sample data (fictional)'),
  ('3bf87ea2-ba28-494a-8d01-6a44a2116236', 'sample-rushlily', 'free_look', null, 135, 'sample', 'ClutchLab sample data (fictional)'),
  ('e38ae372-694c-48a8-843a-0aaf178a3173', 'sample-stoneveil', 'camera', 'no_scope_tpp', 92, 'sample', 'ClutchLab sample data (fictional)'),
  ('32f32c75-d032-4c46-8b1d-089f5753c88b', 'sample-stoneveil', 'camera', 'red_dot', 78, 'sample', 'ClutchLab sample data (fictional)'),
  ('224b433e-5da6-4bf0-866a-f115f2d79358', 'sample-stoneveil', 'ads', 'red_dot', 56, 'sample', 'ClutchLab sample data (fictional)'),
  ('68a74f04-3092-4555-8d43-ba20fc26eadc', 'sample-stoneveil', 'ads', 'x2', 46, 'sample', 'ClutchLab sample data (fictional)'),
  ('8c9cea6b-69d2-47ff-8ef7-7a4c90646554', 'sample-stoneveil', 'ads', 'x3', 35, 'sample', 'ClutchLab sample data (fictional)'),
  ('338eba50-ae81-4750-8f2e-e0b73c412735', 'sample-stoneveil', 'ads', 'x4', 27, 'sample', 'ClutchLab sample data (fictional)'),
  ('266817bf-4411-461f-8451-f84624ef25e5', 'sample-stoneveil', 'ads', 'x6', 21, 'sample', 'ClutchLab sample data (fictional)'),
  ('482baf0f-e8bf-4778-8ae4-4f084870c4e7', 'sample-stoneveil', 'free_look', null, 105, 'sample', 'ClutchLab sample data (fictional)')
on conflict (id) do update set
    pro_slug = excluded.pro_slug,
    family = excluded.family,
    scope = excluded.scope,
    value = excluded.value,
    data_status = excluded.data_status,
    source_name = excluded.source_name;

insert into public.skills (slug, name, category, description, sort_order, data_status) values
  ('crosshair_placement', 'Crosshair placement', 'aim', 'Keeping the crosshair at head height where enemies will appear.', 10, 'unverified'),
  ('tracking', 'Tracking', 'aim', 'Holding the crosshair on a moving target.', 20, 'unverified'),
  ('flicking', 'Flicking', 'aim', 'Fast precise snaps to a new target.', 30, 'unverified'),
  ('target_switching', 'Target switching', 'aim', 'Committing kills across multiple targets without over-swinging.', 40, 'unverified'),
  ('recoil_short', 'Short-burst recoil', 'recoil', 'Controlling the first 10 bullets where fights are decided.', 10, 'unverified'),
  ('recoil_spray', 'Full-magazine sprays', 'recoil', 'Keeping long sprays on target across scopes and stances.', 20, 'unverified'),
  ('jiggle_movement', 'Jiggle movement', 'close_range', 'Strafing patterns that break enemy tracking up close.', 10, 'unverified'),
  ('entry_mechanics', 'Entry mechanics', 'close_range', 'Room entries, pre-fire angles, and crouch/jump timing.', 20, 'unverified'),
  ('hip_fire', 'Hip fire', 'close_range', 'No-ADS accuracy inside 10 meters.', 30, 'unverified'),
  ('burst_control', 'Burst control', 'mid_range', 'Grouped 3–5 round bursts at mid range.', 10, 'unverified'),
  ('spray_transfer', 'Spray transfers', 'mid_range', 'Moving a controlled spray between targets.', 20, 'unverified'),
  ('peek_discipline', 'Peek discipline', 'mid_range', 'Short exposure windows and re-peek variation.', 30, 'unverified'),
  ('dmr_cadence', 'DMR cadence', 'long_range', 'Sustainable accurate fire rate with marksman rifles.', 10, 'unverified'),
  ('sniper_precision', 'Sniper precision', 'long_range', 'Bolt-action micro-adjustments, drop, and lead.', 20, 'unverified'),
  ('joystick_control', 'Joystick control', 'movement', 'Clean strafes, sprint management, and camera separation.', 10, 'unverified'),
  ('cover_movement', 'Cover movement', 'movement', 'Cover-to-cover routes that minimize exposure.', 20, 'unverified'),
  ('footstep_reading', 'Footstep reading', 'audio', 'Direction, floor, and distance from sound alone.', 10, 'unverified'),
  ('utility_throws', 'Utility throws', 'throwables', 'Frag timing, cooking, banks, and smoke placement.', 10, 'unverified'),
  ('rotation_planning', 'Rotation planning', 'br_intelligence', 'When and how to move between zones and compounds.', 10, 'unverified'),
  ('trade_discipline', 'Trade discipline', 'team_play', 'Spacing and refrag timing so knocks convert to kills.', 10, 'unverified')
on conflict (slug) do update set
    name = excluded.name,
    category = excluded.category,
    description = excluded.description,
    sort_order = excluded.sort_order,
    data_status = excluded.data_status;

insert into public.drills (slug, name, skill_slug, objective, difficulty, prerequisites, required_mode, weapon_note, scope_note, distance_note, stance_note, duration_minutes, repetitions, passing_score, advanced_score, common_mistakes, coaching_cues, applicable_modes, aim_assist_variant, data_status, source_name, source_date) values
  ('head_height_walls', 'Head-height wall trace', 'crosshair_placement', 'Trace head height along walls while moving through a compound.', 'beginner', null, 'classic_casual', 'Any AR', 'Red dot', 'Indoors', 'Standing', 5, '3 compounds', 'Crosshair stays within a head of door frames on 8 of 10 entries.', '10 of 10 with no vertical correction on first shot.', 'Drifting to floor level while sprinting.', 'Aim where the head will be, not where the door is.', '{"classic_casual","wow"}', null, 'unverified', 'ClutchLab editorial drill design', '2026-07-21'),
  ('prefire_corners', 'Pre-fire common angles', 'crosshair_placement', 'Pre-aim and pre-fire the five most common angles of a compound.', 'intermediate', 'head_height_walls', 'classic_casual', 'Any AR', 'Red dot', '5–15m', 'Standing', 6, '5 angles × 4 loops', 'First bullet lands on the head box in 6 of 10 pre-fires.', '8 of 10 while strafing into the angle.', 'Opening fire before the crosshair settles.', 'Slice the angle; shoot as the shoulder appears.', '{"classic_casual","wow"}', null, 'unverified', 'ClutchLab editorial drill design', '2026-07-21'),
  ('strafe_tracking_aa_on', 'Strafe tracking — aim assist ON', 'tracking', 'Track a strafing target at 15m for full magazines with aim assist on.', 'beginner', null, 'wow', 'UMP45', 'Red dot', '15m', 'Standing', 5, '5 magazines', '60% of shots hit across 5 magazines.', '75% with half the misses in the first 3 bullets only.', 'Letting assist drag you between two targets.', 'Move WITH the target, don''t chase it.', '{"wow","arena_casual"}', 'on', 'unverified', 'ClutchLab editorial drill design', '2026-07-21'),
  ('strafe_tracking_aa_off', 'Strafe tracking — aim assist OFF', 'tracking', 'Repeat the identical tracking drill with aim assist disabled and compare hit rates.', 'intermediate', 'strafe_tracking_aa_on', 'wow', 'UMP45', 'Red dot', '15m', 'Standing', 5, '5 magazines', 'Within 15% of your aim-assist-on hit rate.', 'Match your aim-assist-on hit rate.', 'Overcorrecting the moment the target reverses.', 'Smooth thumb, small corrections — this is the Ultimate Royale baseline.', '{"wow","ultimate_royale"}', 'off', 'unverified', 'ClutchLab editorial drill design', '2026-07-21'),
  ('vertical_tracking', 'Vertical tracking on ramps', 'tracking', 'Hold the crosshair on a target moving up and down ramps and stairs.', 'intermediate', null, 'wow', 'M416', 'Red dot', '10–20m', 'Standing', 5, '4 passes', 'Stay on the torso for 70% of each pass.', 'Stay on the head for 50% of each pass.', 'Forgetting vertical input entirely while strafing.', 'Think in arcs, not lines.', '{"wow"}', null, 'unverified', 'ClutchLab editorial drill design', '2026-07-21'),
  ('two_target_flick', 'Two-target flick', 'flicking', 'Alternate single shots between two targets 30° apart.', 'beginner', null, 'wow', 'Any DMR', 'Red dot', '20m', 'Standing', 4, '20 pairs', '14 of 20 pairs both hit.', '18 of 20 with under a second per pair.', 'Flicking past and dragging back slowly.', 'Flick, stop, confirm, fire.', '{"wow"}', null, 'unverified', 'ClutchLab editorial drill design', '2026-07-21'),
  ('target_switch_aa_on', 'Triple switch — aim assist ON', 'target_switching', 'Clear three targets in a 90° arc, one burst each, aim assist on.', 'intermediate', null, 'wow', 'SCAR-L', 'Red dot', '12m', 'Standing', 5, '10 arcs', 'All three down within 6 seconds in 6 of 10 arcs.', 'Under 4.5 seconds in 6 of 10.', 'Spraying between targets while swinging.', 'Release the trigger during every swing.', '{"wow","arena_casual"}', 'on', 'unverified', 'ClutchLab editorial drill design', '2026-07-21'),
  ('target_switch_aa_off', 'Triple switch — aim assist OFF', 'target_switching', 'The identical arc with aim assist disabled; log both times in your results.', 'advanced', 'target_switch_aa_on', 'wow', 'SCAR-L', 'Red dot', '12m', 'Standing', 5, '10 arcs', 'Within 1.5s of your aim-assist-on time.', 'Match your aim-assist-on time.', 'Swinging past the second target.', 'Eyes lead, thumb follows.', '{"wow","ultimate_royale"}', 'off', 'unverified', 'ClutchLab editorial drill design', '2026-07-21'),
  ('reaction_peek', 'Reaction peek duel', 'flicking', 'React and fire at a randomly appearing target from behind cover.', 'intermediate', null, 'wow', 'AKM', 'Red dot', '15m', 'Standing', 5, '20 peeks', 'First hit within 0.8s on 12 of 20 peeks.', 'Within 0.6s on 12 of 20.', 'Peeking the same shoulder rhythm every time.', 'Vary timing; commit fully when you go.', '{"wow"}', null, 'unverified', 'ClutchLab editorial drill design', '2026-07-21'),
  ('first_ten_reddot', 'First 10 — red dot', 'recoil_short', 'Land the first 10 bullets in a head-sized circle at 20m.', 'beginner', null, 'wow', 'M416, then your main AR', 'Red dot', '20m', 'Standing', 5, '10 bursts', '7 of 10 bursts fully inside the circle.', '9 of 10, then repeat while crouched.', 'Pulling down before recoil actually starts.', 'Match the pull to the kick, don''t predict it.', '{"wow"}', null, 'unverified', 'ClutchLab editorial drill design', '2026-07-21'),
  ('first_ten_3x', 'First 10 — 3×', 'recoil_short', 'The same first-10 discipline through a 3× at 35m.', 'intermediate', 'first_ten_reddot', 'wow', 'Your main AR', '3×', '35m', 'Standing', 5, '10 bursts', '6 of 10 bursts inside a torso box.', '8 of 10 inside a head-and-shoulders box.', 'Gripping tighter as magnification grows.', 'Same pull, smaller picture.', '{"wow"}', null, 'unverified', 'ClutchLab editorial drill design', '2026-07-21'),
  ('full_mag_reddot', 'Full magazine — red dot', 'recoil_spray', 'Keep an entire magazine on a torso target at 20m.', 'beginner', 'first_ten_reddot', 'wow', 'M416', 'Red dot', '20m', 'Standing', 5, '6 magazines', '70% of each magazine on the torso.', '85% with bullets 20+ still grouped.', 'Giving up on the last third of the spray.', 'The end of the mag is where sprays are won.', '{"wow"}', null, 'unverified', 'ClutchLab editorial drill design', '2026-07-21'),
  ('full_mag_3x', 'Full magazine — 3×', 'recoil_spray', 'Full-mag control through a 3× at 35m, tracking horizontal drift.', 'advanced', 'full_mag_reddot', 'wow', 'Your main AR', '3×', '35m', 'Standing, then crouched', 6, '6 magazines', '60% on torso; note WHERE the spray escapes (left/right/late).', '75% with symmetrical horizontal spread.', 'Blaming sensitivity for what is a grip problem.', 'If spread is one-sided, your thumb anchor is tilted.', '{"wow"}', null, 'unverified', 'ClutchLab editorial drill design', '2026-07-21'),
  ('crouch_spray_transition', 'Stand-to-crouch spray', 'recoil_spray', 'Crouch mid-magazine without losing the target.', 'intermediate', 'full_mag_reddot', 'wow', 'Beryl M762 for punishment', 'Red dot', '20m', 'Stand → crouch at bullet ~12', 5, '8 magazines', 'No more than 3 lost bullets during the transition.', 'Zero lost bullets on 6 of 8.', 'Crouching and pausing the pull simultaneously.', 'The crouch cancels recoil for one beat — keep pulling anyway.', '{"wow"}', null, 'unverified', 'ClutchLab editorial drill design', '2026-07-21'),
  ('moving_spray', 'Strafing spray', 'recoil_spray', 'Spray accurately while jiggle-strafing at close range.', 'advanced', 'crouch_spray_transition', 'wow', 'Vector or UMP45', 'Red dot', '10m', 'Strafing', 5, '8 magazines', '65% hits while never standing still.', '80% while switching strafe direction twice per mag.', 'Stopping to shoot — that''s the habit this kills.', 'Feet and thumb are independent instruments.', '{"wow","arena_casual"}', null, 'unverified', 'ClutchLab editorial drill design', '2026-07-21'),
  ('jiggle_basics', 'Jiggle strafe basics', 'jiggle_movement', 'Learn A-D jiggle rhythm that desyncs enemy tracking.', 'beginner', null, 'arena_casual', 'Any SMG', 'None', '5–10m', 'Strafing', 4, '10 fights', 'Win 4 of 10 close fights you would normally take 50/50.', 'Survive first contact in 8 of 10.', 'Even, predictable left-right timing.', 'Stutter the rhythm: short-short-long.', '{"arena_casual","wow"}', null, 'unverified', 'ClutchLab editorial drill design', '2026-07-21'),
  ('jiggle_peek_duel', 'Jiggle peek duels', 'jiggle_movement', 'Win repeated duels using edge jiggles to bait shots.', 'intermediate', 'jiggle_basics', 'arena_casual', 'AR or SMG', 'Red dot', '10–15m', 'Cover edge', 6, '10 duels', 'Bait a miss before committing in 6 of 10 duels.', '8 of 10 with a first-bullet headshot on commit.', 'Full-body peeks on the bait.', 'Show a shoulder, never a chest.', '{"arena_casual"}', null, 'unverified', 'ClutchLab editorial drill design', '2026-07-21'),
  ('hipfire_circle', 'Hip-fire circle', 'hip_fire', 'Circle-strafe a target at 6m landing hip-fire without ADS.', 'beginner', null, 'wow', 'UZI', 'None', '6m', 'Circling', 4, '6 magazines', '60% hits over 6 magazines.', '75% while reversing circle direction each mag.', 'Screen-watching the enemy instead of the crosshair.', 'Keep the dot pinned; your feet do the aiming.', '{"wow","arena_casual"}', null, 'unverified', 'ClutchLab editorial drill design', '2026-07-21'),
  ('room_entry_pairs', 'Room entry pairs', 'entry_mechanics', 'Enter rooms in the two-angle sequence: deep angle first, then near corner.', 'intermediate', 'prefire_corners', 'classic_casual', 'SMG preferred', 'Red dot', 'Indoors', 'Standing', 6, '10 entries', 'Correct sequence on 8 of 10 entries.', 'Add a crouch on the second angle in under 0.5s.', 'Checking the near corner first and dying to the deep angle.', 'Deep kills you; near only surprises you.', '{"classic_casual"}', null, 'unverified', 'ClutchLab editorial drill design', '2026-07-21'),
  ('drop_shot_timing', 'Drop-shot timing', 'entry_mechanics', 'Prone-drop mid-fight only when cover and range justify it.', 'advanced', 'jiggle_basics', 'arena_casual', 'AR', 'Red dot', '8–12m', 'Stand → prone', 5, '10 fights', 'Win 5 of 10 fights where you drop; note the 5 where dropping was wrong.', 'Call correctly (drop or not) in 8 of 10 before engaging.', 'Dropping in the open where prone means dead.', 'Drop-shot is a corner tool, not a reflex.', '{"arena_casual"}', null, 'unverified', 'ClutchLab editorial drill design', '2026-07-21'),
  ('burst_grouping', 'Burst grouping ladder', 'burst_control', '4-round bursts at 50m, walking hits up from torso to head.', 'beginner', 'first_ten_reddot', 'wow', 'M416 or SCAR-L', '2×', '50m', 'Crouched', 5, '12 bursts', '8 of 12 bursts with 3+ hits.', 'First bullet on head level in 8 of 12.', 'Bursting faster than the reset.', 'Let the gun settle; cadence beats speed.', '{"wow"}', null, 'unverified', 'ClutchLab editorial drill design', '2026-07-21'),
  ('spray_transfer_pairs', 'Spray transfer pairs', 'spray_transfer', 'Down two targets 10° apart with one continuous magazine.', 'advanced', 'full_mag_3x', 'wow', 'Your main AR', '3×', '30m', 'Crouched', 6, '8 magazines', 'Both targets down in 6 of 8 magazines.', 'Transfer without any recovery pause in 6 of 8.', 'Lifting the pull during the transfer swing.', 'The transfer is sideways, the pull never stops.', '{"wow"}', null, 'unverified', 'ClutchLab editorial drill design', '2026-07-21'),
  ('peek_timer', 'Three-second peek budget', 'peek_discipline', 'Take mid-range fights with a hard 3-second exposure budget.', 'intermediate', null, 'classic_casual', 'Any AR + 3×', '3×', '50–150m', 'Cover', 8, '10 engagements', 'Break contact within budget in 8 of 10 engagements.', 'Land damage in 6 of 10 while never exceeding budget.', 'Re-peeking the same head position.', 'One angle, one look; move a body-width between peeks.', '{"classic_casual","classic_ranked"}', null, 'unverified', 'ClutchLab editorial drill design', '2026-07-21'),
  ('dmr_cadence_100', 'DMR cadence at 100m', 'dmr_cadence', 'Find your fastest cadence that keeps 8 of 10 shots on a torso at 100m.', 'intermediate', 'burst_grouping', 'wow', 'Mini14 → SLR', '6× at 3–4 zoom', '100m', 'Crouched', 6, '5 strings of 10', '8/10 hits at a cadence you can hold for a full string.', 'Same accuracy with the SLR.', 'Machine-gunning the trigger and spraying the reset.', 'Shoot the settle, not the click.', '{"wow"}', null, 'unverified', 'ClutchLab editorial drill design', '2026-07-21'),
  ('bolt_micro_adjust', 'Bolt-action micro-adjust', 'sniper_precision', 'Move between two head targets 5m apart at 200m and stop precisely.', 'advanced', null, 'wow', 'Kar98k or M24', '8×', '200m', 'Prone', 6, '20 swaps', 'Clean stop on the head in 12 of 20 swaps.', '16 of 20 with under 1s per swap.', 'Two corrections per swap instead of one.', 'One motion, one stop — retrain until it''s singular.', '{"wow"}', null, 'unverified', 'ClutchLab editorial drill design', '2026-07-21'),
  ('moving_target_lead', 'Moving target lead', 'sniper_precision', 'Hit strafing targets at 150m by learning consistent lead.', 'advanced', 'bolt_micro_adjust', 'wow', 'Kar98k', '8×', '150m', 'Crouched', 6, '20 shots', '8 of 20 hits on constant-strafe targets.', '12 of 20; log your lead in body-widths for your notes.', 'Tracking through the shot instead of holding the lead point.', 'Pick the intercept, hold, fire as they arrive.', '{"wow"}', null, 'unverified', 'ClutchLab editorial drill design', '2026-07-21'),
  ('camera_separation', 'Camera-movement separation', 'joystick_control', 'Run one direction while sweeping the camera through 360° checks.', 'beginner', null, 'classic_casual', null, null, 'Open field', 'Sprinting', 4, '5 laps', 'Straight-line path deviates less than 5m during full checks.', 'Do it during a zigzag route without rhythm breaks.', 'Slowing down every time the camera moves.', 'The left thumb has no idea what the right is doing.', '{"classic_casual"}', null, 'unverified', 'ClutchLab editorial drill design', '2026-07-21'),
  ('cover_route', 'Cover-to-cover routes', 'cover_movement', 'Cross a compound touching only positions with escape cover.', 'intermediate', 'camera_separation', 'classic_casual', null, null, 'Compound scale', 'Mixed', 6, '4 crossings', 'Never more than 3s without reachable cover in 3 of 4 crossings.', 'Add a simulated angle-check at every stop.', 'Straight-lining because the compound looks empty.', 'Move like someone is always watching the longest sightline.', '{"classic_casual","classic_ranked"}', null, 'unverified', 'ClutchLab editorial drill design', '2026-07-21'),
  ('vault_chain', 'Vault chains', 'joystick_control', 'Chain vaults over fences and windows without breaking sprint.', 'beginner', null, 'classic_casual', null, null, 'Compound scale', 'Sprinting', 4, '10 chains', '8 of 10 chains without a stall.', 'Add a 180° check mid-chain.', 'Jumping too early into window frames.', 'Vault late, at full speed, dead-center.', '{"classic_casual"}', null, 'unverified', 'ClutchLab editorial drill design', '2026-07-21'),
  ('blind_direction_calls', 'Blind direction calls', 'footstep_reading', 'With eyes off the screen edge, call footstep direction before looking.', 'beginner', null, 'classic_casual', null, null, 'Hot drop area', 'Any', 8, '10 contacts', 'Correct initial direction on 7 of 10 contacts.', 'Correct floor (above/below/same) on 7 of 10 too.', 'Turning before deciding — the turn erases the cue.', 'Decide, commit, then turn.', '{"classic_casual"}', null, 'unverified', 'ClutchLab editorial drill design', '2026-07-21'),
  ('distance_bracketing', 'Distance bracketing', 'footstep_reading', 'Bracket footsteps into near/mid/far before visual confirmation.', 'intermediate', 'blind_direction_calls', 'classic_casual', null, null, 'Buildings', 'Any', 8, '10 contacts', 'Correct bracket on 6 of 10.', '8 of 10 including through-floor contacts.', 'Treating loudness alone as distance (occlusion lies).', 'Muffled-loud is a floor away; crisp-quiet is far.', '{"classic_casual"}', null, 'unverified', 'ClutchLab editorial drill design', '2026-07-21'),
  ('frag_cook_windows', 'Cooked frags through windows', 'utility_throws', 'Cook frags to detonate 0.5s after entering a window at 15m.', 'intermediate', null, 'wow', 'Frag grenades', null, '15m', 'Standing', 5, '10 throws', '6 of 10 detonate inside without bounce-back.', '8 of 10 with varied approach angles.', 'Full-arm throws at close windows.', 'Cook to 2.5, lob soft, step off the angle.', '{"wow","classic_casual"}', null, 'unverified', 'ClutchLab editorial drill design', '2026-07-21'),
  ('smoke_walls', 'Smoke wall placement', 'utility_throws', 'Build a 3-smoke wall that actually blocks the sightline you intend.', 'intermediate', null, 'classic_casual', 'Smokes', null, 'Open field', 'Any', 6, '5 walls', '4 of 5 walls fully break the chosen sightline.', 'Place while moving, first bounce intentional.', 'Smoking AT the enemy instead of on your own path.', 'Smoke covers the runner, not the shooter.', '{"classic_casual","classic_ranked"}', null, 'unverified', 'ClutchLab editorial drill design', '2026-07-21'),
  ('bank_throws', 'Bank throws', 'utility_throws', 'Bounce frags around corners you cannot see past.', 'advanced', 'frag_cook_windows', 'wow', 'Frags', null, 'Indoors', 'Standing', 5, '10 banks', '5 of 10 land in the target room.', '7 of 10 cooked to deny the exit.', 'Full-strength banks that skip through the room.', 'The wall eats speed — throw one notch harder than feels right.', '{"wow"}', null, 'unverified', 'ClutchLab editorial drill design', '2026-07-21'),
  ('rotation_timer', 'Rotation timing ladder', 'rotation_planning', 'Leave for zone at the timer mark you planned before looting.', 'beginner', null, 'classic_casual', null, null, 'Full map', null, 20, '3 matches', 'Arrive with 30s+ spare in 2 of 3 zones per match.', 'Never take zone damage across 3 matches.', 'One more crate syndrome.', 'Set the leave time BEFORE you land.', '{"classic_casual"}', null, 'unverified', 'ClutchLab editorial drill design', '2026-07-21'),
  ('edge_rotation', 'Zone-edge rotations', 'rotation_planning', 'Rotate along the zone edge clearing one flank by geometry.', 'intermediate', 'rotation_timer', 'classic_casual', null, null, 'Full map', null, 20, '3 matches', 'Complete 2 of 3 matches never fighting on two fronts.', 'Top-10 in all 3 with zero zone damage.', 'Cutting through center to save time.', 'The edge is slower and safer — banked time buys fights.', '{"classic_casual","classic_ranked"}', null, 'unverified', 'ClutchLab editorial drill design', '2026-07-21'),
  ('loot_speedrun', 'Two-minute loot standard', 'rotation_planning', 'Reach AR + scope + 2 heals + vest within 2 minutes of landing.', 'beginner', null, 'classic_casual', null, null, 'Medium-risk drop', null, 10, '4 drops', 'Standard met in 3 of 4 drops.', '90 seconds in 3 of 4.', 'Opening every door in a compound you''ve already outgrown.', 'Loot a route, not a building.', '{"classic_casual"}', null, 'unverified', 'ClutchLab editorial drill design', '2026-07-21'),
  ('trade_spacing', 'Trade spacing pairs', 'trade_discipline', 'With a duo partner, hold 10–20m spacing so every knock is traded.', 'intermediate', null, 'classic_casual', null, null, '10–20m spacing', null, 20, '3 duo matches', 'Trade or cover 6 of 8 partner engagements.', 'Zero double-knocks from one spray across 3 matches.', 'Stacking through the same door.', 'Same fight, different angle — always.', '{"classic_casual","classic_ranked"}', null, 'unverified', 'ClutchLab editorial drill design', '2026-07-21'),
  ('focus_fire_calls', 'Focus-fire calls', 'trade_discipline', 'Call one target and drop it together before switching.', 'intermediate', null, 'classic_casual', null, null, 'Squad fights', null, 20, '3 squad matches', 'First called target drops first in 5 of 8 fights.', '7 of 8 with sub-3s calls.', 'Calling colors nobody bound to compass directions.', 'Direction + landmark + target, nothing else.', '{"classic_casual","classic_ranked"}', null, 'unverified', 'ClutchLab editorial drill design', '2026-07-21'),
  ('ads_transition_speed', 'ADS transition reps', 'crosshair_placement', 'Snap from hip to ADS onto a fixed head target.', 'beginner', null, 'wow', 'Your main AR', 'Red dot', '15m', 'Standing', 4, '20 reps', 'Sight opens on the head in 12 of 20 reps.', '16 of 20 with a first-shot hit.', 'ADS first, then dragging to the target.', 'Place the crosshair before the scope opens.', '{"wow"}', null, 'unverified', 'ClutchLab editorial drill design', '2026-07-21'),
  ('gyro_stability_hold', 'Gyro stability hold', 'tracking', 'Hold a 3× reticle on a 100m target using gyro only for 10 seconds.', 'intermediate', null, 'wow', 'Any AR', '3×', '100m', 'Standing', 4, '8 holds', '6 of 8 holds keep the reticle on the torso throughout.', 'On the head for 5 of 8.', 'Death-gripping the phone as the timer runs.', 'Loose hands, elbows anchored.', '{"wow"}', null, 'unverified', 'ClutchLab editorial drill design', '2026-07-21'),
  ('sixty_zoom_spray', '6× zoomed-out spray', 'recoil_spray', 'Use the 6× at 3× zoom for mid-range sprays.', 'advanced', 'full_mag_3x', 'wow', 'ACE32', '6× at 3', '40m', 'Crouched', 5, '6 magazines', '55% torso hits per magazine.', '70% and note the ACE32 4.5 recoil feel in results.', 'Leaving the scope at 6× and fighting the sway.', 'Zoom down before the fight, not during.', '{"wow"}', null, 'unverified', 'ClutchLab editorial drill design', '2026-07-21'),
  ('heal_cancel_pressure', 'Heal-cancel pressure', 'entry_mechanics', 'Practice canceling heals the instant a push starts.', 'beginner', null, 'arena_casual', null, null, 'Cover', null, 4, '10 reps', 'Cancel-and-fire within 0.5s in 7 of 10 reps.', '9 of 10 while repositioning.', 'Finishing the bandage out of stubbornness.', 'The heal is sunk cost the moment footsteps close.', '{"arena_casual"}', null, 'unverified', 'ClutchLab editorial drill design', '2026-07-21'),
  ('vehicle_knock_cadence', 'Vehicle knock cadence', 'dmr_cadence', 'Tap moving vehicles at 100–150m with a DMR for consistent chip damage.', 'intermediate', 'dmr_cadence_100', 'wow', 'SLR', '4×', '100–150m', 'Crouched', 5, '5 vehicle passes', '6+ hits per pass on 3 of 5 passes.', '10+ hits with early-lead first shots.', 'Tracking the driver instead of leading the hood.', 'Shoot where the vehicle will be at bullet arrival.', '{"wow"}', null, 'unverified', 'ClutchLab editorial drill design', '2026-07-21')
on conflict (slug) do update set
    name = excluded.name,
    skill_slug = excluded.skill_slug,
    objective = excluded.objective,
    difficulty = excluded.difficulty,
    prerequisites = excluded.prerequisites,
    required_mode = excluded.required_mode,
    weapon_note = excluded.weapon_note,
    scope_note = excluded.scope_note,
    distance_note = excluded.distance_note,
    stance_note = excluded.stance_note,
    duration_minutes = excluded.duration_minutes,
    repetitions = excluded.repetitions,
    passing_score = excluded.passing_score,
    advanced_score = excluded.advanced_score,
    common_mistakes = excluded.common_mistakes,
    coaching_cues = excluded.coaching_cues,
    applicable_modes = excluded.applicable_modes,
    aim_assist_variant = excluded.aim_assist_variant,
    data_status = excluded.data_status,
    source_name = excluded.source_name,
    source_date = excluded.source_date;

update public.drills set progression_slug = 'prefire_corners' where slug = 'head_height_walls';
update public.drills set progression_slug = 'strafe_tracking_aa_off' where slug = 'strafe_tracking_aa_on';
update public.drills set progression_slug = 'target_switch_aa_off' where slug = 'two_target_flick';
update public.drills set progression_slug = 'target_switch_aa_off' where slug = 'target_switch_aa_on';
update public.drills set progression_slug = 'first_ten_3x' where slug = 'first_ten_reddot';
update public.drills set progression_slug = 'full_mag_3x' where slug = 'first_ten_3x';
update public.drills set progression_slug = 'full_mag_3x' where slug = 'full_mag_reddot';
update public.drills set progression_slug = 'jiggle_peek_duel' where slug = 'jiggle_basics';
update public.drills set progression_slug = 'spray_transfer_pairs' where slug = 'burst_grouping';
update public.drills set progression_slug = 'cover_route' where slug = 'camera_separation';
update public.drills set progression_slug = 'distance_bracketing' where slug = 'blind_direction_calls';
update public.drills set progression_slug = 'smoke_walls' where slug = 'frag_cook_windows';
update public.drills set progression_slug = 'edge_rotation' where slug = 'rotation_timer';

insert into public.benchmarks (id, drill_slug, level, description, data_status) values
  ('c6b7bf2e-8cfa-421a-8e24-8491328762b7', 'head_height_walls', 'pass', 'Crosshair stays within a head of door frames on 8 of 10 entries.', 'unverified'),
  ('eae6cf4f-37d3-492e-823c-a7ea6a5b20a7', 'head_height_walls', 'advanced', '10 of 10 with no vertical correction on first shot.', 'unverified'),
  ('e0f0d782-469f-4819-8349-2ac5cde61a2b', 'prefire_corners', 'pass', 'First bullet lands on the head box in 6 of 10 pre-fires.', 'unverified'),
  ('b26d0485-61eb-4085-84ed-e72e583a106d', 'prefire_corners', 'advanced', '8 of 10 while strafing into the angle.', 'unverified'),
  ('da44f4c3-fc0f-4dae-8c8e-84c66282b90b', 'strafe_tracking_aa_on', 'pass', '60% of shots hit across 5 magazines.', 'unverified'),
  ('d4d134b5-8512-4ce1-8965-d822b3f218dd', 'strafe_tracking_aa_on', 'advanced', '75% with half the misses in the first 3 bullets only.', 'unverified'),
  ('17b5bb0f-067d-4cfc-8c5a-a3dfe3bab394', 'strafe_tracking_aa_off', 'pass', 'Within 15% of your aim-assist-on hit rate.', 'unverified'),
  ('372786a7-098b-4614-82a3-f659929578cc', 'strafe_tracking_aa_off', 'advanced', 'Match your aim-assist-on hit rate.', 'unverified'),
  ('6fbe83a4-6e36-4086-82ad-22f81dcf41d4', 'vertical_tracking', 'pass', 'Stay on the torso for 70% of each pass.', 'unverified'),
  ('ea473d1d-c402-4bb1-83ad-1adbf336d4f3', 'vertical_tracking', 'advanced', 'Stay on the head for 50% of each pass.', 'unverified'),
  ('0ab988d8-9af4-4cac-894d-ed76967b4fb4', 'two_target_flick', 'pass', '14 of 20 pairs both hit.', 'unverified'),
  ('c4771432-bc4b-4928-8f5a-ddff8b52d002', 'two_target_flick', 'advanced', '18 of 20 with under a second per pair.', 'unverified'),
  ('9c5bb203-4bbd-4675-8ae5-f01e284a0f86', 'target_switch_aa_on', 'pass', 'All three down within 6 seconds in 6 of 10 arcs.', 'unverified'),
  ('bcdbb3ac-3e09-487e-8b6b-77bcc30babc5', 'target_switch_aa_on', 'advanced', 'Under 4.5 seconds in 6 of 10.', 'unverified'),
  ('88e195fc-f5af-457a-847d-834d37f3c2ad', 'target_switch_aa_off', 'pass', 'Within 1.5s of your aim-assist-on time.', 'unverified'),
  ('731b94bf-23bc-4673-8462-d9a0864630e0', 'target_switch_aa_off', 'advanced', 'Match your aim-assist-on time.', 'unverified'),
  ('0a47ad34-4710-47bf-8a1a-bde39b5be1a7', 'reaction_peek', 'pass', 'First hit within 0.8s on 12 of 20 peeks.', 'unverified'),
  ('d6a40ff2-91da-491d-8770-3428bcdaf7d1', 'reaction_peek', 'advanced', 'Within 0.6s on 12 of 20.', 'unverified'),
  ('863320a3-cb2c-4bd0-8ee6-2b2527b8b8b8', 'first_ten_reddot', 'pass', '7 of 10 bursts fully inside the circle.', 'unverified'),
  ('b3d85a05-3066-40fa-8fa2-65fa614d6959', 'first_ten_reddot', 'advanced', '9 of 10, then repeat while crouched.', 'unverified'),
  ('486e2cf5-9bb3-4bcd-882c-69cd9d81e78c', 'first_ten_3x', 'pass', '6 of 10 bursts inside a torso box.', 'unverified'),
  ('2227721d-bedb-44e3-8c6e-1d66dfd7e5ca', 'first_ten_3x', 'advanced', '8 of 10 inside a head-and-shoulders box.', 'unverified'),
  ('4666179d-8dc5-4e86-8bde-b11f5e1568d0', 'full_mag_reddot', 'pass', '70% of each magazine on the torso.', 'unverified'),
  ('975abffa-c0e8-42b2-8e6e-6b568759125e', 'full_mag_reddot', 'advanced', '85% with bullets 20+ still grouped.', 'unverified'),
  ('d0448b1e-fd59-49f2-8a87-e9050bd7ec97', 'full_mag_3x', 'pass', '60% on torso; note WHERE the spray escapes (left/right/late).', 'unverified'),
  ('0a949315-6ed6-4fcb-86dd-36668d86631b', 'full_mag_3x', 'advanced', '75% with symmetrical horizontal spread.', 'unverified'),
  ('ac395556-14bb-4dd8-835e-4ee57ada1291', 'crouch_spray_transition', 'pass', 'No more than 3 lost bullets during the transition.', 'unverified'),
  ('287cb056-fd6b-4d4e-86e6-a7848dea3cc0', 'crouch_spray_transition', 'advanced', 'Zero lost bullets on 6 of 8.', 'unverified'),
  ('d50b314e-c468-40d3-8741-89de98d0c8c0', 'moving_spray', 'pass', '65% hits while never standing still.', 'unverified'),
  ('c044f9df-3ae3-48e7-8f12-60c28abdf7b4', 'moving_spray', 'advanced', '80% while switching strafe direction twice per mag.', 'unverified'),
  ('5a0f27b3-cafd-4990-877b-3f69e351b87f', 'jiggle_basics', 'pass', 'Win 4 of 10 close fights you would normally take 50/50.', 'unverified'),
  ('abfca137-84b5-4c60-8b6e-817039ef3f61', 'jiggle_basics', 'advanced', 'Survive first contact in 8 of 10.', 'unverified'),
  ('1af4240f-58ff-4827-88fc-8c43f6e5d571', 'jiggle_peek_duel', 'pass', 'Bait a miss before committing in 6 of 10 duels.', 'unverified'),
  ('99828a7c-6461-47f2-8a60-1cc4405461da', 'jiggle_peek_duel', 'advanced', '8 of 10 with a first-bullet headshot on commit.', 'unverified'),
  ('7a74c294-0514-4984-86b8-079fe482b982', 'hipfire_circle', 'pass', '60% hits over 6 magazines.', 'unverified'),
  ('70b6cf99-4009-49b3-8d39-7e354bfc0cd2', 'hipfire_circle', 'advanced', '75% while reversing circle direction each mag.', 'unverified'),
  ('c9effec6-ed3c-48fd-8a0f-54e743dbd513', 'room_entry_pairs', 'pass', 'Correct sequence on 8 of 10 entries.', 'unverified'),
  ('a6a5b3bb-4e7d-42a7-8c34-4447192c9a5f', 'room_entry_pairs', 'advanced', 'Add a crouch on the second angle in under 0.5s.', 'unverified'),
  ('c5eba886-3d96-4864-8281-8a18a9ba3b8f', 'drop_shot_timing', 'pass', 'Win 5 of 10 fights where you drop; note the 5 where dropping was wrong.', 'unverified'),
  ('2cf91295-1f31-4bde-8185-f80092cbd554', 'drop_shot_timing', 'advanced', 'Call correctly (drop or not) in 8 of 10 before engaging.', 'unverified'),
  ('902e4757-c893-4218-8502-b3bc1114e32f', 'burst_grouping', 'pass', '8 of 12 bursts with 3+ hits.', 'unverified'),
  ('5439fcd7-3f4d-4d83-8ff4-11c744ce5a73', 'burst_grouping', 'advanced', 'First bullet on head level in 8 of 12.', 'unverified'),
  ('f8033612-a1d2-4789-8575-be9f6c46fc6b', 'spray_transfer_pairs', 'pass', 'Both targets down in 6 of 8 magazines.', 'unverified'),
  ('e066f912-26b0-41eb-8d08-a5604370a9ff', 'spray_transfer_pairs', 'advanced', 'Transfer without any recovery pause in 6 of 8.', 'unverified'),
  ('0550a1ab-0db4-473f-84d8-0c50fc88200e', 'peek_timer', 'pass', 'Break contact within budget in 8 of 10 engagements.', 'unverified'),
  ('6a45fd88-fea8-4f7a-8aec-2f5241794d7a', 'peek_timer', 'advanced', 'Land damage in 6 of 10 while never exceeding budget.', 'unverified'),
  ('3b75e5b2-33af-45ee-88e0-3d267a23cd60', 'dmr_cadence_100', 'pass', '8/10 hits at a cadence you can hold for a full string.', 'unverified'),
  ('88d47d64-669a-4dbe-89eb-88031fb16d67', 'dmr_cadence_100', 'advanced', 'Same accuracy with the SLR.', 'unverified'),
  ('df9bc329-0ff4-4ba7-8f42-05fc5929cf0d', 'bolt_micro_adjust', 'pass', 'Clean stop on the head in 12 of 20 swaps.', 'unverified'),
  ('7764ceff-088b-4d3b-8a96-a5be861f2632', 'bolt_micro_adjust', 'advanced', '16 of 20 with under 1s per swap.', 'unverified'),
  ('92914016-980c-42ae-8b66-58161cb1f1f5', 'moving_target_lead', 'pass', '8 of 20 hits on constant-strafe targets.', 'unverified'),
  ('8614bdb3-eab0-4fbf-81d8-29bb9d0b2d8e', 'moving_target_lead', 'advanced', '12 of 20; log your lead in body-widths for your notes.', 'unverified'),
  ('20a58ac5-b261-4e55-812f-b0be6ed52bd4', 'camera_separation', 'pass', 'Straight-line path deviates less than 5m during full checks.', 'unverified'),
  ('d133dd1f-804e-4c43-8b18-a0986f0914e2', 'camera_separation', 'advanced', 'Do it during a zigzag route without rhythm breaks.', 'unverified'),
  ('eee76858-12b8-42f4-8b11-559f688401d4', 'cover_route', 'pass', 'Never more than 3s without reachable cover in 3 of 4 crossings.', 'unverified'),
  ('dc423c0c-98e2-40cc-8b1a-8e603fdbecb9', 'cover_route', 'advanced', 'Add a simulated angle-check at every stop.', 'unverified'),
  ('3fc9a5f3-c171-48b8-8e30-0cc0daf4a03d', 'vault_chain', 'pass', '8 of 10 chains without a stall.', 'unverified'),
  ('2f9e598c-bcdc-4849-8906-73d650053ee7', 'vault_chain', 'advanced', 'Add a 180° check mid-chain.', 'unverified'),
  ('c05bb0c5-d10f-48fa-83c4-86154788ee49', 'blind_direction_calls', 'pass', 'Correct initial direction on 7 of 10 contacts.', 'unverified'),
  ('bd63aeb7-a857-4e5c-8bda-5748b3edf18d', 'blind_direction_calls', 'advanced', 'Correct floor (above/below/same) on 7 of 10 too.', 'unverified'),
  ('06a1eb47-2267-4e4a-8bc2-a1958aaf8846', 'distance_bracketing', 'pass', 'Correct bracket on 6 of 10.', 'unverified'),
  ('5bc47cd7-02d9-4350-8cf6-e15e9946e4ec', 'distance_bracketing', 'advanced', '8 of 10 including through-floor contacts.', 'unverified'),
  ('254e4489-adcd-48d3-89d8-ab302a2608d4', 'frag_cook_windows', 'pass', '6 of 10 detonate inside without bounce-back.', 'unverified'),
  ('0b35aecb-d0d3-4cb4-8592-8251bba5a3c2', 'frag_cook_windows', 'advanced', '8 of 10 with varied approach angles.', 'unverified'),
  ('d350a9fd-c94b-465d-8735-123c08b94984', 'smoke_walls', 'pass', '4 of 5 walls fully break the chosen sightline.', 'unverified'),
  ('5b0c2f6b-328f-4adf-85e0-8cf52a16c4fe', 'smoke_walls', 'advanced', 'Place while moving, first bounce intentional.', 'unverified'),
  ('8550743e-4621-4822-893b-f7d725835f3c', 'bank_throws', 'pass', '5 of 10 land in the target room.', 'unverified'),
  ('fa5d9fce-20b6-4033-8642-32a2e62ac40e', 'bank_throws', 'advanced', '7 of 10 cooked to deny the exit.', 'unverified'),
  ('7da8cb72-61ae-4472-8338-6a0e40237474', 'rotation_timer', 'pass', 'Arrive with 30s+ spare in 2 of 3 zones per match.', 'unverified'),
  ('d7f81c5f-8e67-4a69-84bf-f5e2047b48a7', 'rotation_timer', 'advanced', 'Never take zone damage across 3 matches.', 'unverified'),
  ('1bf20de1-a485-453c-8bb0-be7f344484a2', 'edge_rotation', 'pass', 'Complete 2 of 3 matches never fighting on two fronts.', 'unverified'),
  ('4d8d464a-4c93-4589-84ee-0a5e971bac30', 'edge_rotation', 'advanced', 'Top-10 in all 3 with zero zone damage.', 'unverified'),
  ('6fac18bc-6418-44f6-8433-6ef9d3f9e4c8', 'loot_speedrun', 'pass', 'Standard met in 3 of 4 drops.', 'unverified'),
  ('b7b9b0dc-bee9-40e1-8869-536ae62cac65', 'loot_speedrun', 'advanced', '90 seconds in 3 of 4.', 'unverified'),
  ('51c25ef9-6384-4f45-893f-40f130243585', 'trade_spacing', 'pass', 'Trade or cover 6 of 8 partner engagements.', 'unverified'),
  ('7b62d148-a0a4-4fcf-88d3-8bfe80f96a4b', 'trade_spacing', 'advanced', 'Zero double-knocks from one spray across 3 matches.', 'unverified'),
  ('6b346605-89d7-4283-8d3e-0009558b1fc6', 'focus_fire_calls', 'pass', 'First called target drops first in 5 of 8 fights.', 'unverified'),
  ('cd7fdd48-513f-468c-8742-c4e348ffa763', 'focus_fire_calls', 'advanced', '7 of 8 with sub-3s calls.', 'unverified'),
  ('285217b5-7313-4ca4-8f9b-7572d14676f1', 'ads_transition_speed', 'pass', 'Sight opens on the head in 12 of 20 reps.', 'unverified'),
  ('a9289b62-23ab-45a1-8757-d825d769e4e5', 'ads_transition_speed', 'advanced', '16 of 20 with a first-shot hit.', 'unverified'),
  ('c53d9bc4-431c-4441-8c26-42b68a84a050', 'gyro_stability_hold', 'pass', '6 of 8 holds keep the reticle on the torso throughout.', 'unverified'),
  ('8af325c9-2ee3-4d3c-87a8-d44266a3d21e', 'gyro_stability_hold', 'advanced', 'On the head for 5 of 8.', 'unverified'),
  ('02737323-c88b-46a7-8906-55b073212f16', 'sixty_zoom_spray', 'pass', '55% torso hits per magazine.', 'unverified'),
  ('3c3cbc9c-8152-41e7-8c67-352ef14ac600', 'sixty_zoom_spray', 'advanced', '70% and note the ACE32 4.5 recoil feel in results.', 'unverified'),
  ('94b76ae3-35f4-41da-83a9-9a8c2a7a7982', 'heal_cancel_pressure', 'pass', 'Cancel-and-fire within 0.5s in 7 of 10 reps.', 'unverified'),
  ('6898b504-fe0a-4c6b-85c2-eaaf1411ba34', 'heal_cancel_pressure', 'advanced', '9 of 10 while repositioning.', 'unverified'),
  ('eb374d9c-abb4-4ca6-8b86-7c46d3091a4b', 'vehicle_knock_cadence', 'pass', '6+ hits per pass on 3 of 5 passes.', 'unverified'),
  ('fc303ad2-e606-4171-83b2-86a5e65eed62', 'vehicle_knock_cadence', 'advanced', '10+ hits with early-lead first shots.', 'unverified')
on conflict (drill_slug, level) do update set
    description = excluded.description,
    data_status = excluded.data_status;

insert into public.training_plans (slug, name, description, minutes, focus_categories, aim_assist_focus, data_status) values
  ('warmup_5', '5-minute warmup', 'The pre-ranked ritual: placement, one spray check.', 5, '{"aim","recoil"}', null, 'unverified'),
  ('aim_10', '10-minute aim tune', 'Placement and tracking basics.', 10, '{"aim"}', null, 'unverified'),
  ('recoil_15', '15-minute recoil block', 'First-10 discipline into full magazines.', 15, '{"recoil"}', null, 'unverified'),
  ('audio_10', '10-minute audio reps', 'Direction and distance from sound.', 10, '{"audio"}', null, 'unverified'),
  ('movement_15', '15-minute movement flow', 'Camera separation, vaults, cover routes.', 15, '{"movement"}', null, 'unverified'),
  ('close_30', '30-minute close-range block', 'Jiggle, hip fire, and entries for hot drops and Arena.', 30, '{"close_range","aim"}', null, 'unverified'),
  ('dmr_30', '30-minute DMR clinic', 'Cadence, micro-adjust, and moving leads.', 30, '{"long_range"}', null, 'unverified'),
  ('ur_prep_45', '45-minute Ultimate Royale prep', 'The aim-assist-off program: manual tracking, switches, discipline (spec §5.6 readiness).', 45, '{"aim","recoil","mid_range"}', 'off', 'unverified'),
  ('utility_15', '15-minute utility block', 'Frags, cooks, and smoke walls.', 15, '{"throwables"}', null, 'unverified'),
  ('full_60', '60-minute full session', 'The complete daily: aim, recoil, movement, game sense.', 60, '{"aim","recoil","movement","br_intelligence"}', 'mixed', 'unverified')
on conflict (slug) do update set
    name = excluded.name,
    description = excluded.description,
    minutes = excluded.minutes,
    focus_categories = excluded.focus_categories,
    aim_assist_focus = excluded.aim_assist_focus,
    data_status = excluded.data_status;

insert into public.training_plan_items (id, plan_slug, drill_slug, item_order, minutes, note) values
  ('dee765e5-b0fe-4db7-85d5-18967ecb2d0d', 'warmup_5', 'ads_transition_speed', 1, 2, null),
  ('aa539645-0b1e-44f5-8614-a4e5efdadbe0', 'warmup_5', 'first_ten_reddot', 2, 3, null),
  ('462eff44-ce27-4d13-8e03-779bc668b678', 'aim_10', 'head_height_walls', 1, 5, null),
  ('50d4594d-89a8-48a7-8a79-1173b8dd11f8', 'aim_10', 'strafe_tracking_aa_on', 2, 5, null),
  ('b687801e-dd96-43da-8961-0a7cab666d7b', 'recoil_15', 'first_ten_reddot', 1, 5, null),
  ('847955b2-de0e-4145-8456-a426385d098a', 'recoil_15', 'full_mag_reddot', 2, 5, null),
  ('a5f8bddd-af4d-46dd-8dba-68e29f9a21ab', 'recoil_15', 'crouch_spray_transition', 3, 5, null),
  ('68163e04-aa78-4d32-81fe-3c518b2a310a', 'audio_10', 'blind_direction_calls', 1, 5, 'Casual match segment'),
  ('8e3d16d4-e73f-48f9-87f4-7f522e4145c8', 'audio_10', 'distance_bracketing', 2, 5, null),
  ('2424a9da-0b03-4244-8706-e2615355956a', 'movement_15', 'camera_separation', 1, 4, null),
  ('a011a752-313a-4cb1-848b-06fd6bab284a', 'movement_15', 'vault_chain', 2, 4, null),
  ('198b9c02-8bfa-4f2e-8519-c3ca81dbf519', 'movement_15', 'cover_route', 3, 7, null),
  ('f20d1910-a9c7-4b45-8d51-81fbffadd620', 'close_30', 'jiggle_basics', 1, 5, null),
  ('69ad858b-9c77-4366-8023-f2508755d96d', 'close_30', 'hipfire_circle', 2, 5, null),
  ('bfd0a2bc-8b40-40b2-830a-13b1afe89eb8', 'close_30', 'moving_spray', 3, 6, null),
  ('c9dee84a-3a6d-4c57-888d-0755277c7855', 'close_30', 'room_entry_pairs', 4, 7, null),
  ('d522b96d-c3cd-4f5d-8a8d-99d3e82f4d13', 'close_30', 'jiggle_peek_duel', 5, 7, null),
  ('a8b5fb92-91fa-47ec-8c63-c0b8e8708237', 'dmr_30', 'burst_grouping', 1, 6, 'Warm the reset'),
  ('0150fc3a-f3bd-451a-8ec0-55abf6516c1b', 'dmr_30', 'dmr_cadence_100', 2, 8, null),
  ('caf1600c-1b26-4865-8427-95041b235ba6', 'dmr_30', 'bolt_micro_adjust', 3, 8, null),
  ('cb30edf1-78bc-46b3-8245-b32f6a938c52', 'dmr_30', 'moving_target_lead', 4, 8, null),
  ('0234e6c4-e7a4-4aa4-8672-456ad715ddbc', 'ur_prep_45', 'strafe_tracking_aa_off', 1, 8, 'Log vs your AA-on rate'),
  ('b3186364-eb60-45bc-8255-cb7530e15845', 'ur_prep_45', 'target_switch_aa_off', 2, 8, null),
  ('a9c0f2bb-18a3-4e67-8464-8af20416deba', 'ur_prep_45', 'first_ten_3x', 3, 7, null),
  ('efdf1354-2e9b-4d8c-85d9-669ec0a7061c', 'ur_prep_45', 'full_mag_3x', 4, 8, null),
  ('72afefd6-94fc-4908-8851-4edb58d9dac8', 'ur_prep_45', 'peek_timer', 5, 14, 'Ranked-pace engagements'),
  ('f054dd3f-2c29-4e4f-8311-ffadecc8d252', 'utility_15', 'frag_cook_windows', 1, 5, null),
  ('04cc164d-aa2e-42c5-8b70-6d830890b2f6', 'utility_15', 'smoke_walls', 2, 6, null),
  ('4af02238-0434-429d-82c4-8970c534aa58', 'utility_15', 'bank_throws', 3, 4, null),
  ('0affc9fe-1e60-4204-87ef-729e84c7d72e', 'full_60', 'ads_transition_speed', 1, 4, null),
  ('1e974cb4-3c42-43dc-80f7-4fcfda38caa4', 'full_60', 'strafe_tracking_aa_on', 2, 6, null),
  ('2b786d44-18a8-4da5-8d7d-79c2ec6880ab', 'full_60', 'first_ten_3x', 3, 6, null),
  ('e97595c3-45f9-4272-8950-97dce5b5612d', 'full_60', 'full_mag_3x', 4, 7, null),
  ('961e8b68-8a31-4c5c-8920-d13ddfe73d3c', 'full_60', 'spray_transfer_pairs', 5, 7, null),
  ('a67716dd-bfdf-418c-8793-2bc88893d5cd', 'full_60', 'cover_route', 6, 6, null),
  ('da423a88-b569-4924-8bf5-8ea9fcf88d2d', 'full_60', 'frag_cook_windows', 7, 4, null),
  ('44081acb-e9f4-4259-8c14-d13cce3c7f7c', 'full_60', 'rotation_timer', 8, 20, 'One deliberate casual match')
on conflict (plan_slug, item_order) do update set
    drill_slug = excluded.drill_slug,
    minutes = excluded.minutes,
    note = excluded.note;

insert into public.wow_maps (slug, name, creator_label, map_code, category, player_count, rules, status, data_status, source_name) values
  ('sample-aim-arena', 'Aim Arena (directory placeholder)', null, null, 'aim', '1', 'Static and strafing bots at 10–50m.', 'unverified', 'sample', 'ClutchLab directory placeholder — real community maps enter via editorial verification'),
  ('sample-recoil-range', 'Recoil Range (directory placeholder)', null, null, 'recoil', '1', 'Wall targets at 20/35/50m with magazine refills.', 'unverified', 'sample', 'ClutchLab directory placeholder — real community maps enter via editorial verification'),
  ('sample-track-gym', 'Tracking Gym (directory placeholder)', null, null, 'tracking', '1', 'Constant-strafe bots with speed tiers.', 'unverified', 'sample', 'ClutchLab directory placeholder — real community maps enter via editorial verification'),
  ('sample-switch-yard', 'Switch Yard (directory placeholder)', null, null, 'target_switching', '1-2', 'Timed 3-target arcs.', 'unverified', 'sample', 'ClutchLab directory placeholder — real community maps enter via editorial verification'),
  ('sample-duel-box', 'Duel Box (directory placeholder)', null, null, 'duels', '2-8', 'Round-based 1v1 with loadout resets.', 'unverified', 'sample', 'ClutchLab directory placeholder — real community maps enter via editorial verification'),
  ('sample-movement-course', 'Movement Course (directory placeholder)', null, null, 'movement', '1-4', 'Vault chains, drop timings, sprint lines.', 'unverified', 'sample', 'ClutchLab directory placeholder — real community maps enter via editorial verification')
on conflict (slug) do update set
    name = excluded.name,
    creator_label = excluded.creator_label,
    map_code = excluded.map_code,
    category = excluded.category,
    player_count = excluded.player_count,
    rules = excluded.rules,
    status = excluded.status,
    data_status = excluded.data_status,
    source_name = excluded.source_name;

insert into public.control_elements (slug, name, category, default_size, description, data_status) values
  ('movement_stick', 'Movement stick', 'movement', 0.26, 'Left-hand locomotion joystick.', 'unverified'),
  ('sprint', 'Sprint', 'movement', 0.07, 'Sprint lock toggle.', 'unverified'),
  ('fire_left', 'Fire (left)', 'combat', 0.11, 'Mirrored fire for index or second thumb.', 'unverified'),
  ('fire_right', 'Fire (right)', 'combat', 0.13, 'Primary fire button.', 'unverified'),
  ('scope', 'ADS / scope', 'combat', 0.09, 'Aim-down-sights toggle.', 'unverified'),
  ('peek_left', 'Peek left', 'combat', 0.07, 'Lean left.', 'unverified'),
  ('peek_right', 'Peek right', 'combat', 0.07, 'Lean right.', 'unverified'),
  ('crouch', 'Crouch', 'movement', 0.08, 'Crouch toggle.', 'unverified'),
  ('prone', 'Prone', 'movement', 0.07, 'Prone toggle.', 'unverified'),
  ('jump', 'Jump / vault', 'movement', 0.09, 'Jump and vault.', 'unverified'),
  ('reload', 'Reload', 'combat', 0.07, 'Magazine reload.', 'unverified'),
  ('weapon_slot_1', 'Weapon 1', 'combat', 0.07, 'Primary weapon slot.', 'unverified'),
  ('weapon_slot_2', 'Weapon 2', 'combat', 0.07, 'Secondary weapon slot.', 'unverified'),
  ('throwable', 'Throwable', 'utility', 0.07, 'Grenade wheel trigger.', 'unverified'),
  ('heal', 'Heal', 'utility', 0.07, 'Smart healing prompt.', 'unverified'),
  ('free_look', 'Free look', 'camera', 0.06, 'Eye camera.', 'unverified'),
  ('backpack', 'Backpack', 'misc', 0.06, 'Inventory.', 'unverified'),
  ('map_ping', 'Map / ping', 'misc', 0.06, 'Map open and pings.', 'unverified'),
  ('quick_scope_switch', 'Quick scope switch', 'combat', 0.06, 'Swap scope magnification.', 'unverified'),
  ('canted_sight', 'Canted sight', 'combat', 0.06, 'Toggle canted sight.', 'unverified'),
  ('fpp_swap', 'FPP swap', 'camera', 0.06, 'TPP/FPP camera switch.', 'unverified')
on conflict (slug) do update set
    name = excluded.name,
    category = excluded.category,
    default_size = excluded.default_size,
    description = excluded.description,
    data_status = excluded.data_status;


