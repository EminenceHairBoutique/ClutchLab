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
