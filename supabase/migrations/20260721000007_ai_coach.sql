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
