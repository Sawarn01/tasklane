-- ============================================================
-- Tasklane — Project Docs + File Attachments (combined)
-- Paste the entire file into Supabase SQL Editor and run once.
-- Safe to re-run (all statements are idempotent).
-- ============================================================

-- 1. Ensure the updated_at trigger function exists
--    (created by the main schema migration; included here as a fallback)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- 2. project_docs table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.project_docs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title       text        NOT NULL DEFAULT 'Untitled',
  body        text        NOT NULL DEFAULT '',
  emoji       text        NOT NULL DEFAULT '📄',
  created_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_docs_project_id_idx ON public.project_docs (project_id);
CREATE INDEX IF NOT EXISTS project_docs_updated_at_idx  ON public.project_docs (updated_at DESC);

ALTER TABLE public.project_docs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "docs_select"  ON public.project_docs;
CREATE POLICY "docs_select" ON public.project_docs FOR SELECT TO authenticated
  USING (project_id IN (
    SELECT project_id FROM public.project_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "docs_insert"  ON public.project_docs;
CREATE POLICY "docs_insert" ON public.project_docs FOR INSERT TO authenticated
  WITH CHECK (project_id IN (
    SELECT project_id FROM public.project_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "docs_update"  ON public.project_docs;
CREATE POLICY "docs_update" ON public.project_docs FOR UPDATE TO authenticated
  USING (project_id IN (
    SELECT project_id FROM public.project_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "docs_delete"  ON public.project_docs;
CREATE POLICY "docs_delete" ON public.project_docs FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR project_id IN (
      SELECT pm.project_id FROM public.project_members pm
      JOIN public.org_members om ON om.user_id = pm.user_id
      WHERE pm.user_id = auth.uid() AND om.role IN ('owner', 'admin')
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_docs TO authenticated;

DROP TRIGGER IF EXISTS project_docs_updated_at ON public.project_docs;
CREATE TRIGGER project_docs_updated_at
  BEFORE UPDATE ON public.project_docs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 3. doc_files table (attachments per doc)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.doc_files (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id       uuid        NOT NULL REFERENCES public.project_docs(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  storage_path text        NOT NULL,
  mime_type    text,
  size_bytes   integer,
  uploaded_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS doc_files_doc_id_idx ON public.doc_files (doc_id);

ALTER TABLE public.doc_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "doc_files_select" ON public.doc_files;
CREATE POLICY "doc_files_select" ON public.doc_files FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "doc_files_insert" ON public.doc_files;
CREATE POLICY "doc_files_insert" ON public.doc_files FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid());

DROP POLICY IF EXISTS "doc_files_delete" ON public.doc_files;
CREATE POLICY "doc_files_delete" ON public.doc_files FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid());

GRANT SELECT, INSERT, DELETE ON public.doc_files TO authenticated;

-- ============================================================
-- 4. Storage bucket for doc attachments
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('doc-files', 'doc-files', false, 52428800)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "doc_files_storage_insert" ON storage.objects;
CREATE POLICY "doc_files_storage_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'doc-files');

DROP POLICY IF EXISTS "doc_files_storage_select" ON storage.objects;
CREATE POLICY "doc_files_storage_select" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'doc-files');

DROP POLICY IF EXISTS "doc_files_storage_delete" ON storage.objects;
CREATE POLICY "doc_files_storage_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'doc-files');
