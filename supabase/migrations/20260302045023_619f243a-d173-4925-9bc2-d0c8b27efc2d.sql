
-- Add new columns to projects table
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS expected_outcome text,
  ADD COLUMN IF NOT EXISTS budget_range text,
  ADD COLUMN IF NOT EXISTS equipment_needed text,
  ADD COLUMN IF NOT EXISTS location_secured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS venue text,
  ADD COLUMN IF NOT EXISTS props_needed text,
  ADD COLUMN IF NOT EXISTS sponsorship_needed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vendors_needed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS progress_percent integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_moodboard_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deliverables jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS allow_custom_roles boolean NOT NULL DEFAULT false;

-- Add phase column to project_milestones
ALTER TABLE public.project_milestones
  ADD COLUMN IF NOT EXISTS phase text;

-- Create project_attachments table
CREATE TABLE IF NOT EXISTS public.project_attachments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL DEFAULT 'image',
  file_size bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create project_updates table
CREATE TABLE IF NOT EXISTS public.project_updates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS for project_attachments
ALTER TABLE public.project_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view project attachments"
  ON public.project_attachments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own attachments"
  ON public.project_attachments FOR INSERT
  TO authenticated
  WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "Users can delete their own attachments"
  ON public.project_attachments FOR DELETE
  TO authenticated
  USING (uploaded_by = auth.uid());

-- RLS for project_updates
ALTER TABLE public.project_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view project updates"
  ON public.project_updates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own updates"
  ON public.project_updates FOR INSERT
  TO authenticated
  WITH CHECK (author_id = auth.uid());
