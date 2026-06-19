-- Add time and meeting_url to meetings table
alter table public.meetings
  add column if not exists meeting_time time,
  add column if not exists meeting_url  text;
