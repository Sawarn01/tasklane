-- ============================================================
-- Tasklane — Meeting recordings bucket + meetings columns
-- Run this in Supabase SQL Editor if you haven't already.
-- Safe to re-run (idempotent).
-- ============================================================

-- 1. Add status / recording / transcript columns to meetings
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS status           text NOT NULL DEFAULT 'upcoming'
    CHECK (status IN ('upcoming', 'completed')),
  ADD COLUMN IF NOT EXISTS duration_seconds integer,
  ADD COLUMN IF NOT EXISTS recording_url    text,
  ADD COLUMN IF NOT EXISTS completed_at     timestamptz,
  ADD COLUMN IF NOT EXISTS transcript       text;

CREATE INDEX IF NOT EXISTS meetings_status_idx ON public.meetings (status);

-- 2. Storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'meeting-recordings', 'meeting-recordings', false, 524288000,
  ARRAY['video/webm', 'video/mp4', 'audio/webm', 'audio/mp4']
)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage RLS (drop first so this is idempotent)
DROP POLICY IF EXISTS "meeting_rec_insert" ON storage.objects;
CREATE POLICY "meeting_rec_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'meeting-recordings');

DROP POLICY IF EXISTS "meeting_rec_select" ON storage.objects;
CREATE POLICY "meeting_rec_select" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'meeting-recordings');

DROP POLICY IF EXISTS "meeting_rec_update" ON storage.objects;
CREATE POLICY "meeting_rec_update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'meeting-recordings');

DROP POLICY IF EXISTS "meeting_rec_delete" ON storage.objects;
CREATE POLICY "meeting_rec_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'meeting-recordings');
