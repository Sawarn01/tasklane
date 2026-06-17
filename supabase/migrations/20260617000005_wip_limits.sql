-- Store WIP limits per column as a JSONB column on projects
-- e.g. { "in_progress": 5, "review": 3 }
alter table public.projects
  add column if not exists wip_limits jsonb default '{}'::jsonb;
