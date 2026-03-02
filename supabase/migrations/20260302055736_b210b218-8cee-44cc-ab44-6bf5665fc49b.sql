DROP POLICY IF EXISTS "Project participants can view milestones" ON public.project_milestones;

CREATE POLICY "Authenticated users can view milestones"
  ON public.project_milestones FOR SELECT
  TO authenticated
  USING (true);