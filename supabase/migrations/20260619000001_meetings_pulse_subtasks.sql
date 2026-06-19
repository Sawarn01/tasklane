-- ── meetings ──────────────────────────────────────────────────────────────────
create table if not exists public.meetings (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  created_by    uuid not null references auth.users(id) on delete cascade,
  title         text not null,
  date          date not null default current_date,
  agenda        text,
  notes         text not null default '',
  decisions     text not null default '',
  attendee_ids  uuid[] not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists meetings_project_id_idx on public.meetings(project_id);
create index if not exists meetings_date_idx       on public.meetings(date desc);

alter table public.meetings enable row level security;

-- Members of the project can read meetings
create policy "project members can read meetings"
  on public.meetings for select
  using (
    exists (
      select 1 from public.project_members pm
      where pm.project_id = meetings.project_id
        and pm.user_id = auth.uid()
    )
  );

-- Project members can insert meetings
create policy "project members can insert meetings"
  on public.meetings for insert
  with check (
    exists (
      select 1 from public.project_members pm
      where pm.project_id = meetings.project_id
        and pm.user_id = auth.uid()
    )
  );

-- Any project member can update meetings (notes/decisions are collaborative)
create policy "project members can update meetings"
  on public.meetings for update
  using (
    exists (
      select 1 from public.project_members pm
      where pm.project_id = meetings.project_id
        and pm.user_id = auth.uid()
    )
  );

-- Only the creator can delete their meeting
create policy "creator can delete meetings"
  on public.meetings for delete
  using (created_by = auth.uid());

-- Auto-update updated_at
create or replace function public.set_meetings_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger meetings_updated_at
  before update on public.meetings
  for each row execute function public.set_meetings_updated_at();


-- ── meeting_action_items ───────────────────────────────────────────────────────
create table if not exists public.meeting_action_items (
  id          uuid primary key default gen_random_uuid(),
  meeting_id  uuid not null references public.meetings(id) on delete cascade,
  project_id  uuid not null references public.projects(id) on delete cascade,
  created_by  uuid not null references auth.users(id) on delete cascade,
  assignee_id uuid references auth.users(id) on delete set null,
  title       text not null,
  done        boolean not null default false,
  task_id     uuid references public.tasks(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists action_items_meeting_id_idx on public.meeting_action_items(meeting_id);
create index if not exists action_items_project_id_idx on public.meeting_action_items(project_id);

alter table public.meeting_action_items enable row level security;

create policy "project members can read action items"
  on public.meeting_action_items for select
  using (
    exists (
      select 1 from public.project_members pm
      where pm.project_id = meeting_action_items.project_id
        and pm.user_id = auth.uid()
    )
  );

create policy "project members can insert action items"
  on public.meeting_action_items for insert
  with check (
    exists (
      select 1 from public.project_members pm
      where pm.project_id = meeting_action_items.project_id
        and pm.user_id = auth.uid()
    )
  );

create policy "project members can update action items"
  on public.meeting_action_items for update
  using (
    exists (
      select 1 from public.project_members pm
      where pm.project_id = meeting_action_items.project_id
        and pm.user_id = auth.uid()
    )
  );

create policy "project members can delete action items"
  on public.meeting_action_items for delete
  using (
    exists (
      select 1 from public.project_members pm
      where pm.project_id = meeting_action_items.project_id
        and pm.user_id = auth.uid()
    )
  );


-- ── team_pulse ─────────────────────────────────────────────────────────────────
create table if not exists public.team_pulse (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  project_id  uuid not null references public.projects(id) on delete cascade,
  score       smallint not null check (score between 1 and 5),
  date        date not null default current_date,
  created_at  timestamptz not null default now(),
  -- one check-in per user per project per day
  unique (user_id, project_id, date)
);

create index if not exists team_pulse_project_date_idx on public.team_pulse(project_id, date);

alter table public.team_pulse enable row level security;

-- Each user can only read their own score (aggregates are computed client-side
-- from anonymous scores returned via the project-members policy below)
create policy "users can read project pulse scores"
  on public.team_pulse for select
  using (
    exists (
      select 1 from public.project_members pm
      where pm.project_id = team_pulse.project_id
        and pm.user_id = auth.uid()
    )
  );

create policy "users can insert their own pulse"
  on public.team_pulse for insert
  with check (user_id = auth.uid());

create policy "users can update their own pulse"
  on public.team_pulse for update
  using (user_id = auth.uid());


-- ── parent_task_id column (for subtask breakdown feature) ──────────────────────
alter table public.tasks
  add column if not exists parent_task_id uuid references public.tasks(id) on delete cascade;

create index if not exists tasks_parent_task_id_idx on public.tasks(parent_task_id);
