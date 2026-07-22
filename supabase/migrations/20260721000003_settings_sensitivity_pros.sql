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
