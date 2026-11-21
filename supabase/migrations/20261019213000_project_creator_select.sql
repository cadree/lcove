-- Project creation does insert().select(). Postgres checks SELECT policies on
-- RETURNING. can_view_project() reads projects in its own query, so it cannot
-- see the row this command is inserting, and the creator gets 403.
-- The creator check reads creator_id on the new tuple. Re-running drops and
-- recreates the same policy.

DROP POLICY IF EXISTS "Anyone can view open projects" ON public.projects;
DROP POLICY IF EXISTS "Private projects visible to creator and clients" ON public.projects;
DROP POLICY IF EXISTS "Projects are visible to the community or their members" ON public.projects;

CREATE POLICY "Projects are visible to the community or their members"
ON public.projects
FOR SELECT
USING (creator_id = auth.uid() OR public.can_view_project(id, auth.uid()));
