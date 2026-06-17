-- Add original_estimate (minutes) to tasks for time tracking
alter table public.tasks
  add column if not exists original_estimate integer;
