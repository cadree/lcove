
-- Call sheets for projects (per-role call times, location, notes)
CREATE TABLE public.project_call_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  shoot_date date NOT NULL,
  general_location text,
  general_notes text,
  role_entries jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_call_sheets_project ON public.project_call_sheets(project_id);

-- Auto-update timestamp
CREATE TRIGGER touch_call_sheet_updated
  BEFORE UPDATE ON public.project_call_sheets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- RLS
ALTER TABLE public.project_call_sheets ENABLE ROW LEVEL SECURITY;

-- Project creator can do everything
CREATE POLICY "Creator full access on call_sheets"
  ON public.project_call_sheets FOR ALL
  TO authenticated
  USING (public.is_project_creator(project_id, auth.uid()))
  WITH CHECK (public.is_project_creator(project_id, auth.uid()));

-- Anyone authenticated can view call sheets for projects they participate in or are clients of
CREATE POLICY "Participants and clients can view call_sheets"
  ON public.project_call_sheets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.project_applications pa
      WHERE pa.project_id = project_call_sheets.project_id
        AND pa.applicant_id = auth.uid()
        AND pa.status = 'accepted'
    )
    OR public.is_project_client(project_id, auth.uid())
  );

-- Public projects: anyone can view call sheets
CREATE POLICY "Public project call_sheets viewable"
  ON public.project_call_sheets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_call_sheets.project_id
        AND p.is_private = false
    )
  );
