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
