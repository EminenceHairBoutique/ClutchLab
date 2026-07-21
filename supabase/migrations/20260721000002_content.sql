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
