-- Add transcript column to meetings
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS transcript text;
