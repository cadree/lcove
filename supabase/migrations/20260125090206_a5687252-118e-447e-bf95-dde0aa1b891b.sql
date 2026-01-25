-- Fix DELETE policy on projects table to allow creators to delete their projects regardless of status
DROP POLICY IF EXISTS "Creators can delete draft projects" ON projects;

CREATE POLICY "Creators can delete own projects" 
ON projects FOR DELETE 
TO authenticated 
USING (auth.uid() = creator_id);

-- Add DELETE policy for project_applications so creators can delete applications when deleting projects
CREATE POLICY "Creators can delete project applications" 
ON project_applications FOR DELETE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM projects p 
    WHERE p.id = project_applications.project_id 
    AND p.creator_id = auth.uid()
  )
);