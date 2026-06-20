-- ============================================================
-- TASKLANE — Complete Platform Schema
-- Safe to run on a fresh project OR an existing one;
-- every statement uses IF NOT EXISTS / ON CONFLICT.
-- ============================================================

-- ── Extensions ────────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";   -- fast text search

-- ============================================================
-- SECTION 1 · SHARED HELPERS
-- ============================================================

-- Generic updated_at trigger function (reused across many tables)
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- SECTION 2 · AUTH PROFILE
-- ============================================================

create table if not exists public.profiles (
  id           uuid        primary key references auth.users(id) on delete cascade,
  full_name    text,
  avatar_url   text,
  bio          text,
  timezone     text        not null default 'UTC',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists profiles_full_name_trgm_idx
  on public.profiles using gin(full_name gin_trgm_ops);

alter table public.profiles enable row level security;

drop policy if exists "profiles: read by authenticated" on public.profiles;
create policy "profiles: read by authenticated"
  on public.profiles for select
  using (auth.role() = 'authenticated');

drop policy if exists "profiles: insert own" on public.profiles;
create policy "profiles: insert own"
  on public.profiles for insert
  with check (id = auth.uid());

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own"
  on public.profiles for update
  using (id = auth.uid());

grant select, insert, update on public.profiles to authenticated;

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at trigger for profiles
drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ============================================================
-- SECTION 3 · ORGANIZATIONS
-- ============================================================

create table if not exists public.organizations (
  id                  uuid        primary key default gen_random_uuid(),
  name                text        not null,
  slug                text        unique,
  logo_url            text,
  plan                text        not null default 'free'
                        check (plan in ('free', 'pro', 'enterprise')),
  stripe_customer_id  text,
  stripe_subscription_id text,
  plan_expires_at     timestamptz,
  created_by          uuid        references auth.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.organizations enable row level security;

drop policy if exists "orgs: members can read" on public.organizations;
create policy "orgs: members can read"
  on public.organizations for select
  using (id in (
    select org_id from public.org_members where user_id = auth.uid()
  ));

drop policy if exists "orgs: creator can insert" on public.organizations;
create policy "orgs: creator can insert"
  on public.organizations for insert
  with check (created_by = auth.uid());

drop policy if exists "orgs: admin/owner can update" on public.organizations;
create policy "orgs: admin/owner can update"
  on public.organizations for update
  using (id in (
    select org_id from public.org_members
    where user_id = auth.uid() and role in ('owner', 'admin')
  ));

grant select, insert, update on public.organizations to authenticated;

drop trigger if exists organizations_updated_at on public.organizations;
create trigger organizations_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

-- ── Org members ───────────────────────────────────────────────

create table if not exists public.org_members (
  id         uuid        primary key default gen_random_uuid(),
  org_id     uuid        not null references public.organizations(id) on delete cascade,
  user_id    uuid        not null references auth.users(id)           on delete cascade,
  role       text        not null default 'member'
               check (role in ('owner', 'admin', 'member', 'viewer')),
  joined_at  timestamptz not null default now(),
  unique (org_id, user_id)
);

create index if not exists org_members_org_id_idx  on public.org_members(org_id);
create index if not exists org_members_user_id_idx on public.org_members(user_id);

alter table public.org_members enable row level security;

drop policy if exists "org_members: read own org" on public.org_members;
create policy "org_members: read own org"
  on public.org_members for select
  using (org_id in (
    select org_id from public.org_members where user_id = auth.uid()
  ));

drop policy if exists "org_members: insert" on public.org_members;
create policy "org_members: insert"
  on public.org_members for insert
  with check (
    user_id = auth.uid()
    or
    org_id in (
      select org_id from public.org_members
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

drop policy if exists "org_members: admin/owner can update" on public.org_members;
create policy "org_members: admin/owner can update"
  on public.org_members for update
  using (org_id in (
    select org_id from public.org_members
    where user_id = auth.uid() and role in ('owner', 'admin')
  ));

drop policy if exists "org_members: admin/owner can delete" on public.org_members;
create policy "org_members: admin/owner can delete"
  on public.org_members for delete
  using (
    user_id = auth.uid()
    or
    org_id in (
      select org_id from public.org_members
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

grant select, insert, update, delete on public.org_members to authenticated;

-- ============================================================
-- SECTION 4 · INVITES
-- ============================================================

create table if not exists public.invites (
  id          uuid        primary key default gen_random_uuid(),
  org_id      uuid        not null references public.organizations(id) on delete cascade,
  token       text        not null unique default encode(gen_random_bytes(24), 'hex'),
  created_by  uuid        references auth.users(id) on delete set null,
  role        text        not null default 'member'
                check (role in ('admin', 'member', 'viewer')),
  max_uses    integer     not null default 1,
  uses        integer     not null default 0,
  expires_at  timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists invites_token_idx  on public.invites(token);
create index if not exists invites_org_id_idx on public.invites(org_id);

alter table public.invites enable row level security;

drop policy if exists "invites: admin can manage" on public.invites;
create policy "invites: admin can manage"
  on public.invites for all
  using (org_id in (
    select org_id from public.org_members
    where user_id = auth.uid() and role in ('owner', 'admin')
  ));

-- Allow any authenticated user to read an invite by token (needed for redemption)
drop policy if exists "invites: read by token" on public.invites;
create policy "invites: read by token"
  on public.invites for select
  using (true);

grant select, insert, update, delete on public.invites to authenticated;

-- Invite redemption stored procedure
create or replace function public.redeem_invite(invite_token text, redeeming_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_invite  public.invites%rowtype;
  v_exists  boolean;
begin
  -- Lock and fetch invite
  select * into v_invite
  from public.invites
  where token = invite_token
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Invite not found');
  end if;

  if v_invite.uses >= v_invite.max_uses then
    return jsonb_build_object('success', false, 'error', 'Invite has already been used');
  end if;

  if v_invite.expires_at is not null and v_invite.expires_at < now() then
    return jsonb_build_object('success', false, 'error', 'Invite has expired');
  end if;

  -- Check if user is already a member
  select exists(
    select 1 from public.org_members
    where org_id = v_invite.org_id and user_id = redeeming_user_id
  ) into v_exists;

  if v_exists then
    return jsonb_build_object('success', true, 'org_id', v_invite.org_id, 'already_member', true);
  end if;

  -- Add to org
  insert into public.org_members (org_id, user_id, role)
  values (v_invite.org_id, redeeming_user_id, v_invite.role);

  -- Increment uses
  update public.invites set uses = uses + 1 where id = v_invite.id;

  return jsonb_build_object('success', true, 'org_id', v_invite.org_id);
end;
$$;

grant execute on function public.redeem_invite(text, uuid) to authenticated;

-- ============================================================
-- SECTION 5 · PROJECTS
-- ============================================================

create table if not exists public.projects (
  id           uuid        primary key default gen_random_uuid(),
  org_id       uuid        not null references public.organizations(id) on delete cascade,
  name         text        not null,
  description  text,
  icon         text,
  color        text,
  wip_limits   jsonb       not null default '{}',
  created_by   uuid        references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists projects_org_id_idx on public.projects(org_id);

alter table public.projects enable row level security;

drop policy if exists "projects: org members can read" on public.projects;
create policy "projects: org members can read"
  on public.projects for select
  using (org_id in (
    select org_id from public.org_members where user_id = auth.uid()
  ));

drop policy if exists "projects: org members can insert" on public.projects;
create policy "projects: org members can insert"
  on public.projects for insert
  with check (org_id in (
    select org_id from public.org_members where user_id = auth.uid()
  ));

drop policy if exists "projects: project members can update" on public.projects;
create policy "projects: project members can update"
  on public.projects for update
  using (id in (
    select project_id from public.project_members where user_id = auth.uid()
  ));

drop policy if exists "projects: creator can delete" on public.projects;
create policy "projects: creator can delete"
  on public.projects for delete
  using (created_by = auth.uid() or org_id in (
    select org_id from public.org_members
    where user_id = auth.uid() and role in ('owner', 'admin')
  ));

grant select, insert, update, delete on public.projects to authenticated;

drop trigger if exists projects_updated_at on public.projects;
create trigger projects_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- ── Project members ───────────────────────────────────────────

create table if not exists public.project_members (
  project_id uuid        not null references public.projects(id) on delete cascade,
  user_id    uuid        not null references auth.users(id)       on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index if not exists project_members_user_idx on public.project_members(user_id);

alter table public.project_members enable row level security;

drop policy if exists "project_members: read" on public.project_members;
create policy "project_members: read"
  on public.project_members for select
  using (project_id in (
    select p.id from public.projects p
    join public.org_members om on om.org_id = p.org_id
    where om.user_id = auth.uid()
  ));

drop policy if exists "project_members: insert" on public.project_members;
create policy "project_members: insert"
  on public.project_members for insert
  with check (project_id in (
    select p.id from public.projects p
    join public.org_members om on om.org_id = p.org_id
    where om.user_id = auth.uid()
  ));

drop policy if exists "project_members: delete" on public.project_members;
create policy "project_members: delete"
  on public.project_members for delete
  using (project_id in (
    select p.id from public.projects p
    join public.org_members om on om.org_id = p.org_id
    where om.user_id = auth.uid() and om.role in ('owner', 'admin')
  ) or user_id = auth.uid());

grant select, insert, delete on public.project_members to authenticated;

-- ============================================================
-- SECTION 6 · TASKS
-- ============================================================

-- sprints and versions must exist before tasks references them (added below in Sec 9/10)
-- We create the tasks table first with only self-contained columns,
-- then add FK columns after the referenced tables are created.

create table if not exists public.tasks (
  id               uuid        primary key default gen_random_uuid(),
  project_id       uuid        not null references public.projects(id) on delete cascade,
  title            text        not null,
  description      text,
  status           text        not null default 'todo'
                     check (status in ('todo', 'in_progress', 'in_review', 'done')),
  priority         text        check (priority in ('low', 'medium', 'high', 'critical')),
  issue_type       text        not null default 'task'
                     check (issue_type in ('task', 'bug', 'story', 'epic', 'subtask')),
  story_points     integer,
  position         integer     not null default 0,
  due_date         date,
  original_estimate integer,
  assignee_id      uuid        references auth.users(id) on delete set null,
  created_by       uuid        references auth.users(id) on delete set null,
  -- FK columns added after referenced tables:
  sprint_id        uuid,   -- -> sprints(id)
  parent_id        uuid,   -- -> tasks(id)   (epic hierarchy)
  parent_task_id   uuid,   -- -> tasks(id)   (subtask hierarchy)
  fix_version_id   uuid,   -- -> versions(id)
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists tasks_project_id_idx    on public.tasks(project_id);
create index if not exists tasks_assignee_id_idx   on public.tasks(assignee_id);
create index if not exists tasks_status_idx        on public.tasks(status);
create index if not exists tasks_sprint_id_idx     on public.tasks(sprint_id);
create index if not exists tasks_parent_id_idx     on public.tasks(parent_id);
create index if not exists tasks_parent_task_id_idx on public.tasks(parent_task_id);
create index if not exists tasks_issue_type_idx    on public.tasks(issue_type);
create index if not exists tasks_title_trgm_idx    on public.tasks using gin(title gin_trgm_ops);

alter table public.tasks enable row level security;

drop policy if exists "tasks: project members can read" on public.tasks;
create policy "tasks: project members can read"
  on public.tasks for select
  using (project_id in (
    select project_id from public.project_members where user_id = auth.uid()
  ));

drop policy if exists "tasks: project members can insert" on public.tasks;
create policy "tasks: project members can insert"
  on public.tasks for insert
  with check (project_id in (
    select project_id from public.project_members where user_id = auth.uid()
  ));

drop policy if exists "tasks: project members can update" on public.tasks;
create policy "tasks: project members can update"
  on public.tasks for update
  using (project_id in (
    select project_id from public.project_members where user_id = auth.uid()
  ));

drop policy if exists "tasks: project members can delete" on public.tasks;
create policy "tasks: project members can delete"
  on public.tasks for delete
  using (project_id in (
    select project_id from public.project_members where user_id = auth.uid()
  ));

grant select, insert, update, delete on public.tasks to authenticated;

drop trigger if exists tasks_updated_at on public.tasks;
create trigger tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- ── Task comments ─────────────────────────────────────────────

create table if not exists public.task_comments (
  id         uuid        primary key default gen_random_uuid(),
  task_id    uuid        not null references public.tasks(id)   on delete cascade,
  user_id    uuid        not null references auth.users(id)     on delete cascade,
  body       text        not null,
  edited_at  timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists task_comments_task_id_idx on public.task_comments(task_id);

alter table public.task_comments enable row level security;

drop policy if exists "task_comments: project members can read" on public.task_comments;
create policy "task_comments: project members can read"
  on public.task_comments for select
  using (task_id in (
    select t.id from public.tasks t
    join public.project_members pm on pm.project_id = t.project_id
    where pm.user_id = auth.uid()
  ));

drop policy if exists "task_comments: project members can insert" on public.task_comments;
create policy "task_comments: project members can insert"
  on public.task_comments for insert
  with check (
    user_id = auth.uid()
    and task_id in (
      select t.id from public.tasks t
      join public.project_members pm on pm.project_id = t.project_id
      where pm.user_id = auth.uid()
    )
  );

drop policy if exists "task_comments: owner can update/delete" on public.task_comments;
create policy "task_comments: owner can update/delete"
  on public.task_comments for all
  using (user_id = auth.uid());

grant select, insert, update, delete on public.task_comments to authenticated;

-- ── Labels ────────────────────────────────────────────────────

create table if not exists public.labels (
  id          uuid        primary key default gen_random_uuid(),
  project_id  uuid        not null references public.projects(id) on delete cascade,
  name        text        not null,
  color       text        not null default '#6E56CF',
  created_at  timestamptz not null default now(),
  unique (project_id, name)
);

create index if not exists labels_project_id_idx on public.labels(project_id);

alter table public.labels enable row level security;

drop policy if exists "labels: project members full access" on public.labels;
create policy "labels: project members full access"
  on public.labels for all
  using (project_id in (
    select project_id from public.project_members where user_id = auth.uid()
  ));

grant select, insert, update, delete on public.labels to authenticated;

-- ── Task labels ───────────────────────────────────────────────

create table if not exists public.task_labels (
  task_id    uuid not null references public.tasks(id)  on delete cascade,
  label_id   uuid not null references public.labels(id) on delete cascade,
  primary key (task_id, label_id)
);

alter table public.task_labels enable row level security;

drop policy if exists "task_labels: project members full access" on public.task_labels;
create policy "task_labels: project members full access"
  on public.task_labels for all
  using (task_id in (
    select t.id from public.tasks t
    join public.project_members pm on pm.project_id = t.project_id
    where pm.user_id = auth.uid()
  ));

grant select, insert, delete on public.task_labels to authenticated;

-- ── Task watchers ─────────────────────────────────────────────

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

-- ── Time logs ─────────────────────────────────────────────────

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

-- ============================================================
-- SECTION 7 · MESSAGES (project chat)
-- ============================================================

create table if not exists public.messages (
  id         uuid        primary key default gen_random_uuid(),
  project_id uuid        not null references public.projects(id) on delete cascade,
  user_id    uuid        not null references auth.users(id)       on delete cascade,
  body       text        not null,
  type       text        not null default 'text'
               check (type in ('text', 'system', 'file')),
  created_at timestamptz not null default now()
);

create index if not exists messages_project_id_idx     on public.messages(project_id);
create index if not exists messages_project_created_idx on public.messages(project_id, created_at desc);

alter table public.messages enable row level security;

drop policy if exists "messages: project members can read" on public.messages;
create policy "messages: project members can read"
  on public.messages for select
  using (project_id in (
    select project_id from public.project_members where user_id = auth.uid()
  ));

drop policy if exists "messages: project members can send" on public.messages;
create policy "messages: project members can send"
  on public.messages for insert
  with check (
    user_id = auth.uid()
    and project_id in (
      select project_id from public.project_members where user_id = auth.uid()
    )
  );

grant select, insert on public.messages to authenticated;

-- ============================================================
-- SECTION 8 · ACTIVITY LOG & NOTIFICATIONS
-- ============================================================

create table if not exists public.activity_log (
  id         uuid        primary key default gen_random_uuid(),
  project_id uuid        references public.projects(id) on delete cascade,
  actor_id   uuid        references auth.users(id)      on delete set null,
  action     text        not null,
  metadata   jsonb       not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists activity_log_project_id_idx on public.activity_log(project_id);
create index if not exists activity_log_actor_id_idx   on public.activity_log(actor_id);
create index if not exists activity_log_created_at_idx on public.activity_log(created_at desc);

alter table public.activity_log enable row level security;

drop policy if exists "activity_log: org members can read" on public.activity_log;
create policy "activity_log: org members can read"
  on public.activity_log for select
  using (
    project_id is null
    or project_id in (
      select p.id from public.projects p
      join public.org_members om on om.org_id = p.org_id
      where om.user_id = auth.uid()
    )
  );

drop policy if exists "activity_log: authenticated can insert" on public.activity_log;
create policy "activity_log: authenticated can insert"
  on public.activity_log for insert
  with check (actor_id = auth.uid());

grant select, insert on public.activity_log to authenticated;

-- ── Notifications ─────────────────────────────────────────────

create table if not exists public.notifications (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id)   on delete cascade,
  actor_id   uuid        references auth.users(id)            on delete set null,
  project_id uuid        references public.projects(id)       on delete cascade,
  task_id    uuid        references public.tasks(id)          on delete cascade,
  type       text        not null
               check (type in ('comment', 'mention', 'assigned', 'status_changed',
                               'due_soon', 'chat', 'meeting', 'invoice', 'system')),
  message    text        not null,
  read       boolean     not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_idx     on public.notifications(user_id);
create index if not exists notifications_user_read_idx   on public.notifications(user_id, read);
create index if not exists notifications_created_at_idx  on public.notifications(created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "notifications: read own" on public.notifications;
create policy "notifications: read own"
  on public.notifications for select
  using (user_id = auth.uid());

drop policy if exists "notifications: insert (system uses service role)" on public.notifications;
create policy "notifications: insert (system uses service role)"
  on public.notifications for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "notifications: update own" on public.notifications;
create policy "notifications: update own"
  on public.notifications for update
  using (user_id = auth.uid());

drop policy if exists "notifications: delete own" on public.notifications;
create policy "notifications: delete own"
  on public.notifications for delete
  using (user_id = auth.uid());

grant select, insert, update, delete on public.notifications to authenticated;

-- ============================================================
-- SECTION 9 · FILE ATTACHMENTS
-- ============================================================

create table if not exists public.files (
  id           uuid        primary key default gen_random_uuid(),
  task_id      uuid        references public.tasks(id)    on delete cascade,
  project_id   uuid        not null references public.projects(id) on delete cascade,
  uploaded_by  uuid        references auth.users(id)      on delete set null,
  storage_path text        not null,
  file_name    text        not null,
  file_size    bigint,
  mime_type    text,
  created_at   timestamptz not null default now()
);

create index if not exists files_task_id_idx    on public.files(task_id);
create index if not exists files_project_id_idx on public.files(project_id);

alter table public.files enable row level security;

drop policy if exists "files: project members can read" on public.files;
create policy "files: project members can read"
  on public.files for select
  using (project_id in (
    select project_id from public.project_members where user_id = auth.uid()
  ));

drop policy if exists "files: project members can upload" on public.files;
create policy "files: project members can upload"
  on public.files for insert
  with check (
    uploaded_by = auth.uid()
    and project_id in (
      select project_id from public.project_members where user_id = auth.uid()
    )
  );

drop policy if exists "files: uploader can delete" on public.files;
create policy "files: uploader can delete"
  on public.files for delete
  using (uploaded_by = auth.uid());

grant select, insert, delete on public.files to authenticated;

-- ============================================================
-- SECTION 10 · SPRINTS
-- ============================================================

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

-- Wire up tasks → sprints FK now that sprints exists
alter table public.tasks
  add column if not exists sprint_id uuid references public.sprints(id) on delete set null;

-- ============================================================
-- SECTION 11 · VERSIONS / RELEASES
-- ============================================================

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

-- Wire up tasks → versions FK
alter table public.tasks
  add column if not exists fix_version_id uuid references public.versions(id) on delete set null;

-- Wire up tasks self-referencing FKs
alter table public.tasks
  add column if not exists parent_id      uuid references public.tasks(id) on delete set null,
  add column if not exists parent_task_id uuid references public.tasks(id) on delete cascade;

-- ============================================================
-- SECTION 12 · ISSUE LINKS
-- ============================================================

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

-- ============================================================
-- SECTION 13 · COMPONENTS
-- ============================================================

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

drop policy if exists "components: project members full access" on public.components;
create policy "components: project members full access"
  on public.components for all
  using (project_id in (
    select project_id from public.project_members where user_id = auth.uid()
  ));

grant select, insert, update, delete on public.components to authenticated;

-- ── Task components ───────────────────────────────────────────

create table if not exists public.task_components (
  task_id      uuid not null references public.tasks(id)      on delete cascade,
  component_id uuid not null references public.components(id) on delete cascade,
  primary key (task_id, component_id)
);

alter table public.task_components enable row level security;

drop policy if exists "task_components: project members full access" on public.task_components;
create policy "task_components: project members full access"
  on public.task_components for all
  using (task_id in (
    select t.id from public.tasks t
    join public.project_members pm on pm.project_id = t.project_id
    where pm.user_id = auth.uid()
  ));

grant select, insert, delete on public.task_components to authenticated;

-- ============================================================
-- SECTION 14 · MEETINGS
-- ============================================================

create table if not exists public.meetings (
  id            uuid        primary key default gen_random_uuid(),
  project_id    uuid        not null references public.projects(id) on delete cascade,
  created_by    uuid        not null references auth.users(id)      on delete cascade,
  title         text        not null,
  date          date        not null default current_date,
  meeting_time  time,
  meeting_url   text,
  agenda        text,
  notes         text        not null default '',
  decisions     text        not null default '',
  attendee_ids  uuid[]      not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists meetings_project_id_idx on public.meetings(project_id);
create index if not exists meetings_date_idx       on public.meetings(date desc);

alter table public.meetings enable row level security;

drop policy if exists "meetings: project members can read" on public.meetings;
create policy "meetings: project members can read"
  on public.meetings for select
  using (project_id in (
    select project_id from public.project_members where user_id = auth.uid()
  ));

drop policy if exists "meetings: project members can insert" on public.meetings;
create policy "meetings: project members can insert"
  on public.meetings for insert
  with check (project_id in (
    select project_id from public.project_members where user_id = auth.uid()
  ));

drop policy if exists "meetings: project members can update" on public.meetings;
create policy "meetings: project members can update"
  on public.meetings for update
  using (project_id in (
    select project_id from public.project_members where user_id = auth.uid()
  ));

drop policy if exists "meetings: creator can delete" on public.meetings;
create policy "meetings: creator can delete"
  on public.meetings for delete
  using (created_by = auth.uid());

grant select, insert, update, delete on public.meetings to authenticated;

drop trigger if exists meetings_updated_at on public.meetings;
create trigger meetings_updated_at
  before update on public.meetings
  for each row execute function public.set_updated_at();

-- ── Meeting action items ──────────────────────────────────────

create table if not exists public.meeting_action_items (
  id          uuid        primary key default gen_random_uuid(),
  meeting_id  uuid        not null references public.meetings(id) on delete cascade,
  project_id  uuid        not null references public.projects(id) on delete cascade,
  created_by  uuid        not null references auth.users(id)      on delete cascade,
  assignee_id uuid        references auth.users(id) on delete set null,
  title       text        not null,
  done        boolean     not null default false,
  task_id     uuid        references public.tasks(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists action_items_meeting_id_idx on public.meeting_action_items(meeting_id);
create index if not exists action_items_project_id_idx on public.meeting_action_items(project_id);

alter table public.meeting_action_items enable row level security;

drop policy if exists "meeting_action_items: project members full access" on public.meeting_action_items;
create policy "meeting_action_items: project members full access"
  on public.meeting_action_items for all
  using (project_id in (
    select project_id from public.project_members where user_id = auth.uid()
  ));

grant select, insert, update, delete on public.meeting_action_items to authenticated;

-- ============================================================
-- SECTION 15 · TEAM PULSE
-- ============================================================

create table if not exists public.team_pulse (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id)   on delete cascade,
  project_id  uuid        not null references public.projects(id) on delete cascade,
  score       smallint    not null check (score between 1 and 5),
  date        date        not null default current_date,
  created_at  timestamptz not null default now(),
  unique (user_id, project_id, date)
);

create index if not exists team_pulse_project_date_idx on public.team_pulse(project_id, date);

alter table public.team_pulse enable row level security;

drop policy if exists "team_pulse: project members can read" on public.team_pulse;
create policy "team_pulse: project members can read"
  on public.team_pulse for select
  using (project_id in (
    select project_id from public.project_members where user_id = auth.uid()
  ));

drop policy if exists "team_pulse: insert own" on public.team_pulse;
create policy "team_pulse: insert own"
  on public.team_pulse for insert
  with check (user_id = auth.uid());

drop policy if exists "team_pulse: update own" on public.team_pulse;
create policy "team_pulse: update own"
  on public.team_pulse for update
  using (user_id = auth.uid());

grant select, insert, update on public.team_pulse to authenticated;

-- ============================================================
-- SECTION 16 · FINANCES
-- ============================================================

-- ── Invoices ──────────────────────────────────────────────────

create table if not exists public.invoices (
  id               uuid        primary key default gen_random_uuid(),
  org_id           uuid        not null references public.organizations(id) on delete cascade,
  invoice_number   text        not null,
  client_name      text        not null,
  client_email     text,
  client_address   text,
  client_city      text,
  client_country   text,
  -- line items stored as jsonb: [{description, qty, rate}]
  items            jsonb       not null default '[]',
  currency         text        not null default 'USD',
  tax_rate         numeric(5,2) not null default 0,
  discount         numeric(5,2) not null default 0,
  subtotal         numeric(12,2) not null default 0,
  tax_amount       numeric(12,2) not null default 0,
  discount_amount  numeric(12,2) not null default 0,
  total            numeric(12,2) not null default 0,
  status           text        not null default 'draft'
                     check (status in ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  notes            text,
  issue_date       date        not null default current_date,
  due_date         date,
  paid_at          timestamptz,
  sent_at          timestamptz,
  created_by       uuid        references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (org_id, invoice_number)
);

create index if not exists invoices_org_id_idx    on public.invoices(org_id);
create index if not exists invoices_status_idx    on public.invoices(status);
create index if not exists invoices_due_date_idx  on public.invoices(due_date);

alter table public.invoices enable row level security;

drop policy if exists "invoices: org members can read" on public.invoices;
create policy "invoices: org members can read"
  on public.invoices for select
  using (org_id in (
    select org_id from public.org_members where user_id = auth.uid()
  ));

drop policy if exists "invoices: org members can insert" on public.invoices;
create policy "invoices: org members can insert"
  on public.invoices for insert
  with check (org_id in (
    select org_id from public.org_members where user_id = auth.uid()
  ));

drop policy if exists "invoices: org members can update" on public.invoices;
create policy "invoices: org members can update"
  on public.invoices for update
  using (org_id in (
    select org_id from public.org_members where user_id = auth.uid()
  ));

drop policy if exists "invoices: admin can delete" on public.invoices;
create policy "invoices: admin can delete"
  on public.invoices for delete
  using (org_id in (
    select org_id from public.org_members
    where user_id = auth.uid() and role in ('owner', 'admin')
  ));

grant select, insert, update, delete on public.invoices to authenticated;

drop trigger if exists invoices_updated_at on public.invoices;
create trigger invoices_updated_at
  before update on public.invoices
  for each row execute function public.set_updated_at();

-- Auto-mark overdue invoices (called by a cron job or on-read)
create or replace function public.refresh_overdue_invoices()
returns void language sql security definer as $$
  update public.invoices
  set status = 'overdue'
  where status = 'sent'
    and due_date < current_date;
$$;

grant execute on function public.refresh_overdue_invoices() to authenticated;

-- ── Expenses ──────────────────────────────────────────────────

create table if not exists public.expenses (
  id           uuid        primary key default gen_random_uuid(),
  org_id       uuid        not null references public.organizations(id) on delete cascade,
  category     text        not null
                 check (category in (
                   'payroll', 'infrastructure', 'marketing',
                   'tools_saas', 'travel', 'office', 'legal',
                   'contractor', 'miscellaneous'
                 )),
  description  text        not null,
  amount       numeric(12,2) not null check (amount > 0),
  currency     text        not null default 'USD',
  vendor       text,
  receipt_url  text,
  date         date        not null default current_date,
  approved_by  uuid        references auth.users(id) on delete set null,
  approved_at  timestamptz,
  created_by   uuid        references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists expenses_org_id_idx  on public.expenses(org_id);
create index if not exists expenses_date_idx    on public.expenses(date desc);
create index if not exists expenses_category_idx on public.expenses(category);

alter table public.expenses enable row level security;

drop policy if exists "expenses: org members can read" on public.expenses;
create policy "expenses: org members can read"
  on public.expenses for select
  using (org_id in (
    select org_id from public.org_members where user_id = auth.uid()
  ));

drop policy if exists "expenses: org members can insert" on public.expenses;
create policy "expenses: org members can insert"
  on public.expenses for insert
  with check (org_id in (
    select org_id from public.org_members where user_id = auth.uid()
  ));

drop policy if exists "expenses: admin can update/delete" on public.expenses;
create policy "expenses: admin can update/delete"
  on public.expenses for all
  using (org_id in (
    select org_id from public.org_members
    where user_id = auth.uid() and role in ('owner', 'admin')
  ));

grant select, insert, update, delete on public.expenses to authenticated;

drop trigger if exists expenses_updated_at on public.expenses;
create trigger expenses_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();

-- ── Revenue snapshots (for the finance dashboard charts) ──────

create table if not exists public.revenue_snapshots (
  id         uuid        primary key default gen_random_uuid(),
  org_id     uuid        not null references public.organizations(id) on delete cascade,
  month      date        not null,   -- first day of month, e.g. 2026-01-01
  revenue    numeric(12,2) not null default 0,
  expenses   numeric(12,2) not null default 0,
  notes      text,
  created_at timestamptz not null default now(),
  unique (org_id, month)
);

create index if not exists revenue_snapshots_org_month_idx on public.revenue_snapshots(org_id, month desc);

alter table public.revenue_snapshots enable row level security;

drop policy if exists "revenue_snapshots: org members can read" on public.revenue_snapshots;
create policy "revenue_snapshots: org members can read"
  on public.revenue_snapshots for select
  using (org_id in (
    select org_id from public.org_members where user_id = auth.uid()
  ));

drop policy if exists "revenue_snapshots: admin can write" on public.revenue_snapshots;
create policy "revenue_snapshots: admin can write"
  on public.revenue_snapshots for all
  using (org_id in (
    select org_id from public.org_members
    where user_id = auth.uid() and role in ('owner', 'admin')
  ));

grant select, insert, update, delete on public.revenue_snapshots to authenticated;

-- ============================================================
-- SECTION 17 · STORAGE BUCKETS & POLICIES
-- ============================================================

-- avatars — public bucket (profile pictures)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars', 'avatars', true,
  5242880,  -- 5 MB
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880;

drop policy if exists "avatars: public read" on storage.objects;
create policy "avatars: public read"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "avatars: authenticated upload own" on storage.objects;
create policy "avatars: authenticated upload own"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars: owner can update" on storage.objects;
create policy "avatars: owner can update"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars: owner can delete" on storage.objects;
create policy "avatars: owner can delete"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- task-files — private bucket (task attachments)
insert into storage.buckets (id, name, public, file_size_limit)
values (
  'task-files', 'task-files', false,
  52428800  -- 50 MB
)
on conflict (id) do update set
  public = false,
  file_size_limit = 52428800;

drop policy if exists "task-files: project members can read" on storage.objects;
create policy "task-files: project members can read"
  on storage.objects for select
  using (
    bucket_id = 'task-files'
    and auth.role() = 'authenticated'
  );

drop policy if exists "task-files: project members can upload" on storage.objects;
create policy "task-files: project members can upload"
  on storage.objects for insert
  with check (
    bucket_id = 'task-files'
    and auth.role() = 'authenticated'
  );

drop policy if exists "task-files: uploader can delete" on storage.objects;
create policy "task-files: uploader can delete"
  on storage.objects for delete
  using (
    bucket_id = 'task-files'
    and owner = auth.uid()
  );

-- org-assets — public bucket (org logos, banners)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'org-assets', 'org-assets', true,
  10485760,  -- 10 MB
  array['image/jpeg','image/png','image/webp','image/svg+xml']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 10485760;

drop policy if exists "org-assets: public read" on storage.objects;
create policy "org-assets: public read"
  on storage.objects for select
  using (bucket_id = 'org-assets');

drop policy if exists "org-assets: admin can write" on storage.objects;
create policy "org-assets: admin can write"
  on storage.objects for insert
  with check (
    bucket_id = 'org-assets'
    and auth.role() = 'authenticated'
  );

drop policy if exists "org-assets: admin can delete" on storage.objects;
create policy "org-assets: admin can delete"
  on storage.objects for delete
  using (
    bucket_id = 'org-assets'
    and owner = auth.uid()
  );

-- invoice-attachments — private bucket (invoice PDFs / supporting docs)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'invoice-attachments', 'invoice-attachments', false,
  20971520,  -- 20 MB
  array['application/pdf','image/jpeg','image/png','application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 20971520;

drop policy if exists "invoice-attachments: org members can read" on storage.objects;
create policy "invoice-attachments: org members can read"
  on storage.objects for select
  using (
    bucket_id = 'invoice-attachments'
    and auth.role() = 'authenticated'
  );

drop policy if exists "invoice-attachments: org members can upload" on storage.objects;
create policy "invoice-attachments: org members can upload"
  on storage.objects for insert
  with check (
    bucket_id = 'invoice-attachments'
    and auth.role() = 'authenticated'
  );

drop policy if exists "invoice-attachments: uploader can delete" on storage.objects;
create policy "invoice-attachments: uploader can delete"
  on storage.objects for delete
  using (
    bucket_id = 'invoice-attachments'
    and owner = auth.uid()
  );

-- expense-receipts — private bucket (expense receipt images)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'expense-receipts', 'expense-receipts', false,
  10485760,  -- 10 MB
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 10485760;

drop policy if exists "expense-receipts: org members can read" on storage.objects;
create policy "expense-receipts: org members can read"
  on storage.objects for select
  using (
    bucket_id = 'expense-receipts'
    and auth.role() = 'authenticated'
  );

drop policy if exists "expense-receipts: org members can upload" on storage.objects;
create policy "expense-receipts: org members can upload"
  on storage.objects for insert
  with check (
    bucket_id = 'expense-receipts'
    and auth.role() = 'authenticated'
  );

drop policy if exists "expense-receipts: uploader can delete" on storage.objects;
create policy "expense-receipts: uploader can delete"
  on storage.objects for delete
  using (
    bucket_id = 'expense-receipts'
    and owner = auth.uid()
  );

-- ============================================================
-- SECTION 18 · REALTIME PUBLICATIONS
-- ============================================================

do $$ begin
  -- tasks
  if not exists (select 1 from pg_publication_tables
    where pubname='supabase_realtime' and tablename='tasks') then
    alter publication supabase_realtime add table public.tasks; end if;
  -- messages
  if not exists (select 1 from pg_publication_tables
    where pubname='supabase_realtime' and tablename='messages') then
    alter publication supabase_realtime add table public.messages; end if;
  -- notifications
  if not exists (select 1 from pg_publication_tables
    where pubname='supabase_realtime' and tablename='notifications') then
    alter publication supabase_realtime add table public.notifications; end if;
  -- task_comments
  if not exists (select 1 from pg_publication_tables
    where pubname='supabase_realtime' and tablename='task_comments') then
    alter publication supabase_realtime add table public.task_comments; end if;
  -- activity_log
  if not exists (select 1 from pg_publication_tables
    where pubname='supabase_realtime' and tablename='activity_log') then
    alter publication supabase_realtime add table public.activity_log; end if;
  -- meetings
  if not exists (select 1 from pg_publication_tables
    where pubname='supabase_realtime' and tablename='meetings') then
    alter publication supabase_realtime add table public.meetings; end if;
  -- meeting_action_items
  if not exists (select 1 from pg_publication_tables
    where pubname='supabase_realtime' and tablename='meeting_action_items') then
    alter publication supabase_realtime add table public.meeting_action_items; end if;
  -- team_pulse
  if not exists (select 1 from pg_publication_tables
    where pubname='supabase_realtime' and tablename='team_pulse') then
    alter publication supabase_realtime add table public.team_pulse; end if;
  -- invoices
  if not exists (select 1 from pg_publication_tables
    where pubname='supabase_realtime' and tablename='invoices') then
    alter publication supabase_realtime add table public.invoices; end if;
  -- sprints
  if not exists (select 1 from pg_publication_tables
    where pubname='supabase_realtime' and tablename='sprints') then
    alter publication supabase_realtime add table public.sprints; end if;
  -- time_logs
  if not exists (select 1 from pg_publication_tables
    where pubname='supabase_realtime' and tablename='time_logs') then
    alter publication supabase_realtime add table public.time_logs; end if;
  -- task_watchers
  if not exists (select 1 from pg_publication_tables
    where pubname='supabase_realtime' and tablename='task_watchers') then
    alter publication supabase_realtime add table public.task_watchers; end if;
end $$;

-- ============================================================
-- SECTION 19 · USEFUL VIEWS
-- ============================================================

-- Project stats (used by getProjectsWithStats)
create or replace view public.project_stats as
select
  p.id,
  p.org_id,
  p.name,
  p.description,
  p.created_at,
  count(t.id)                                                     as total_tasks,
  count(t.id) filter (where t.status = 'done')                   as done_tasks,
  count(t.id) filter (where t.status = 'in_progress')            as in_progress_tasks,
  count(t.id) filter (where t.status = 'todo')                   as todo_tasks,
  count(t.id) filter (where t.status = 'in_review')              as in_review_tasks,
  count(distinct pm.user_id)                                      as member_count
from public.projects p
left join public.tasks t on t.project_id = p.id
left join public.project_members pm on pm.project_id = p.id
group by p.id;

-- Org invoice summary
create or replace view public.org_invoice_summary as
select
  org_id,
  count(*)                                          as total_invoices,
  count(*) filter (where status = 'paid')           as paid_count,
  count(*) filter (where status = 'pending' or status = 'sent') as pending_count,
  count(*) filter (where status = 'overdue')        as overdue_count,
  coalesce(sum(total) filter (where status = 'paid'), 0)    as total_collected,
  coalesce(sum(total) filter (where status in ('sent','pending')), 0) as total_pending,
  coalesce(sum(total) filter (where status = 'overdue'), 0) as total_overdue
from public.invoices
group by org_id;
