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
