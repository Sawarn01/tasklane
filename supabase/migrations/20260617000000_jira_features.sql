-- ============================================================
-- Jira-feature migration for Tasklane
-- Order: sprints → versions → tasks new cols → issue_links
--        → components → task_components → task_watchers → time_logs
-- ============================================================

-- ── 1. sprints ───────────────────────────────────────────────

create table if not exists public.sprints (
  id          uuid        primary key default gen_random_uuid(),
  project_id  uuid        not null references public.projects(id) on delete cascade,
  created_by  uuid        references auth.users(id) on delete set null,
  name        text        not null,
  goal        text,
  status      text        not null default 'planning'
                check (status in ('planning', 'active', 'completed')),
  start_date  date,
  end_date    date,
  created_at  timestamptz not null default now()
);

create index if not exists sprints_project_id_idx on public.sprints(project_id);

alter table public.sprints enable row level security;

drop policy if exists "sprints: read" on public.sprints;
create policy "sprints: read"
  on public.sprints for select
  using (project_id in (
    select project_id from public.project_members where user_id = auth.uid()
  ));

drop policy if exists "sprints: insert" on public.sprints;
create policy "sprints: insert"
  on public.sprints for insert
  with check (project_id in (
    select project_id from public.project_members where user_id = auth.uid()
  ));

drop policy if exists "sprints: update" on public.sprints;
create policy "sprints: update"
  on public.sprints for update
  using (project_id in (
    select project_id from public.project_members where user_id = auth.uid()
  ));

drop policy if exists "sprints: delete" on public.sprints;
create policy "sprints: delete"
  on public.sprints for delete
  using (project_id in (
    select project_id from public.project_members where user_id = auth.uid()
  ));

grant select, insert, update, delete on public.sprints to authenticated;

-- ── 2. versions ──────────────────────────────────────────────

create table if not exists public.versions (
  id           uuid        primary key default gen_random_uuid(),
  project_id   uuid        not null references public.projects(id) on delete cascade,
  name         text        not null,
  description  text,
  status       text        not null default 'unreleased'
                 check (status in ('unreleased', 'released', 'archived')),
  release_date date,
  start_date   date,
  created_at   timestamptz not null default now()
);

create index if not exists versions_project_id_idx on public.versions(project_id);

alter table public.versions enable row level security;

drop policy if exists "versions: read" on public.versions;
create policy "versions: read"
  on public.versions for select
  using (project_id in (
    select project_id from public.project_members where user_id = auth.uid()
  ));

drop policy if exists "versions: insert" on public.versions;
create policy "versions: insert"
  on public.versions for insert
  with check (project_id in (
    select project_id from public.project_members where user_id = auth.uid()
  ));

drop policy if exists "versions: update" on public.versions;
create policy "versions: update"
  on public.versions for update
  using (project_id in (
    select project_id from public.project_members where user_id = auth.uid()
  ));

drop policy if exists "versions: delete" on public.versions;
create policy "versions: delete"
  on public.versions for delete
  using (project_id in (
    select project_id from public.project_members where user_id = auth.uid()
  ));

grant select, insert, update, delete on public.versions to authenticated;

-- ── 3. New columns on tasks ──────────────────────────────────
-- Now that sprints + versions exist, we can add FK columns safely.

alter table public.tasks
  add column if not exists issue_type     text    not null default 'task'
    check (issue_type in ('task', 'bug', 'story', 'epic', 'subtask')),
  add column if not exists story_points   integer,
  add column if not exists sprint_id      uuid    references public.sprints(id)  on delete set null,
  add column if not exists parent_id      uuid    references public.tasks(id)    on delete set null,
  add column if not exists fix_version_id uuid    references public.versions(id) on delete set null;

create index if not exists tasks_sprint_id_idx  on public.tasks(sprint_id);
create index if not exists tasks_parent_id_idx  on public.tasks(parent_id);
create index if not exists tasks_issue_type_idx on public.tasks(issue_type);

-- ── 4. issue_links ───────────────────────────────────────────

create table if not exists public.issue_links (
  id           uuid        primary key default gen_random_uuid(),
  from_task_id uuid        not null references public.tasks(id) on delete cascade,
  to_task_id   uuid        not null references public.tasks(id) on delete cascade,
  link_type    text        not null default 'relates_to'
                 check (link_type in (
                   'blocks', 'is_blocked_by',
                   'relates_to',
                   'duplicates', 'is_duplicated_by',
                   'clones', 'is_cloned_by'
                 )),
  created_at   timestamptz not null default now(),
  unique (from_task_id, to_task_id, link_type)
);

create index if not exists issue_links_from_idx on public.issue_links(from_task_id);
create index if not exists issue_links_to_idx   on public.issue_links(to_task_id);

alter table public.issue_links enable row level security;

drop policy if exists "issue_links: read" on public.issue_links;
create policy "issue_links: read"
  on public.issue_links for select
  using (from_task_id in (
    select t.id from public.tasks t
    join public.project_members pm on pm.project_id = t.project_id
    where pm.user_id = auth.uid()
  ));

drop policy if exists "issue_links: insert" on public.issue_links;
create policy "issue_links: insert"
  on public.issue_links for insert
  with check (from_task_id in (
    select t.id from public.tasks t
    join public.project_members pm on pm.project_id = t.project_id
    where pm.user_id = auth.uid()
  ));

drop policy if exists "issue_links: delete" on public.issue_links;
create policy "issue_links: delete"
  on public.issue_links for delete
  using (from_task_id in (
    select t.id from public.tasks t
    join public.project_members pm on pm.project_id = t.project_id
    where pm.user_id = auth.uid()
  ));

grant select, insert, delete on public.issue_links to authenticated;

-- ── 5. components ────────────────────────────────────────────

create table if not exists public.components (
  id          uuid        primary key default gen_random_uuid(),
  project_id  uuid        not null references public.projects(id) on delete cascade,
  name        text        not null,
  description text,
  lead_id     uuid        references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (project_id, name)
);

create index if not exists components_project_id_idx on public.components(project_id);

alter table public.components enable row level security;

drop policy if exists "components: read" on public.components;
create policy "components: read"
  on public.components for select
  using (project_id in (
    select project_id from public.project_members where user_id = auth.uid()
  ));

drop policy if exists "components: insert" on public.components;
create policy "components: insert"
  on public.components for insert
  with check (project_id in (
    select project_id from public.project_members where user_id = auth.uid()
  ));

drop policy if exists "components: update" on public.components;
create policy "components: update"
  on public.components for update
  using (project_id in (
    select project_id from public.project_members where user_id = auth.uid()
  ));

drop policy if exists "components: delete" on public.components;
create policy "components: delete"
  on public.components for delete
  using (project_id in (
    select project_id from public.project_members where user_id = auth.uid()
  ));

grant select, insert, update, delete on public.components to authenticated;

-- ── 6. task_components ───────────────────────────────────────

create table if not exists public.task_components (
  task_id      uuid not null references public.tasks(id)      on delete cascade,
  component_id uuid not null references public.components(id) on delete cascade,
  primary key (task_id, component_id)
);

alter table public.task_components enable row level security;

drop policy if exists "task_components: read" on public.task_components;
create policy "task_components: read"
  on public.task_components for select
  using (task_id in (
    select t.id from public.tasks t
    join public.project_members pm on pm.project_id = t.project_id
    where pm.user_id = auth.uid()
  ));

drop policy if exists "task_components: insert" on public.task_components;
create policy "task_components: insert"
  on public.task_components for insert
  with check (task_id in (
    select t.id from public.tasks t
    join public.project_members pm on pm.project_id = t.project_id
    where pm.user_id = auth.uid()
  ));

drop policy if exists "task_components: delete" on public.task_components;
create policy "task_components: delete"
  on public.task_components for delete
  using (task_id in (
    select t.id from public.tasks t
    join public.project_members pm on pm.project_id = t.project_id
    where pm.user_id = auth.uid()
  ));

grant select, insert, delete on public.task_components to authenticated;

-- ── 7. task_watchers ─────────────────────────────────────────

create table if not exists public.task_watchers (
  task_id    uuid        not null references public.tasks(id) on delete cascade,
  user_id    uuid        not null references auth.users(id)   on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, user_id)
);

create index if not exists task_watchers_user_idx on public.task_watchers(user_id);

alter table public.task_watchers enable row level security;

drop policy if exists "task_watchers: read" on public.task_watchers;
create policy "task_watchers: read"
  on public.task_watchers for select
  using (task_id in (
    select t.id from public.tasks t
    join public.project_members pm on pm.project_id = t.project_id
    where pm.user_id = auth.uid()
  ));

drop policy if exists "task_watchers: insert own" on public.task_watchers;
create policy "task_watchers: insert own"
  on public.task_watchers for insert
  with check (user_id = auth.uid());

drop policy if exists "task_watchers: delete own" on public.task_watchers;
create policy "task_watchers: delete own"
  on public.task_watchers for delete
  using (user_id = auth.uid());

grant select, insert, delete on public.task_watchers to authenticated;

-- ── 8. time_logs ─────────────────────────────────────────────

create table if not exists public.time_logs (
  id          uuid        primary key default gen_random_uuid(),
  task_id     uuid        not null references public.tasks(id) on delete cascade,
  user_id     uuid        not null references auth.users(id)   on delete cascade,
  minutes     integer     not null check (minutes > 0),
  description text,
  created_at  timestamptz not null default now()
);

create index if not exists time_logs_task_id_idx on public.time_logs(task_id);
create index if not exists time_logs_user_id_idx on public.time_logs(user_id);

alter table public.time_logs enable row level security;

drop policy if exists "time_logs: read" on public.time_logs;
create policy "time_logs: read"
  on public.time_logs for select
  using (task_id in (
    select t.id from public.tasks t
    join public.project_members pm on pm.project_id = t.project_id
    where pm.user_id = auth.uid()
  ));

drop policy if exists "time_logs: insert own" on public.time_logs;
create policy "time_logs: insert own"
  on public.time_logs for insert
  with check (user_id = auth.uid());

drop policy if exists "time_logs: delete own" on public.time_logs;
create policy "time_logs: delete own"
  on public.time_logs for delete
  using (user_id = auth.uid());

grant select, insert, delete on public.time_logs to authenticated;

-- ── 9. Enable realtime on new tables ─────────────────────────

do $$
begin
  perform pg_catalog.set_config('search_path', 'public', false);
  -- Add each table to the realtime publication if not already there
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'sprints'
  ) then
    alter publication supabase_realtime add table public.sprints;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'versions'
  ) then
    alter publication supabase_realtime add table public.versions;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'issue_links'
  ) then
    alter publication supabase_realtime add table public.issue_links;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'task_watchers'
  ) then
    alter publication supabase_realtime add table public.task_watchers;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'time_logs'
  ) then
    alter publication supabase_realtime add table public.time_logs;
  end if;
end $$;
