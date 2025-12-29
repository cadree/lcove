-- Add project_id to conversations table for project group chats
ALTER TABLE public.conversations 
ADD COLUMN project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE;

-- Add project_role_name to conversation_participants to show each member's role
ALTER TABLE public.conversation_participants 
ADD COLUMN project_role_name TEXT;

-- Create index for faster project conversation lookups
CREATE INDEX idx_conversations_project_id ON public.conversations(project_id) WHERE project_id IS NOT NULL;

-- Update RLS policy to allow project participants to see project conversations
CREATE POLICY "Project members can view project conversations"
ON public.conversations
FOR SELECT
USING (
  project_id IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM project_applications pa
    WHERE pa.project_id = conversations.project_id
    AND pa.applicant_id = auth.uid()
    AND pa.status = 'accepted'
  )
);

-- Allow project creators to also see their project conversations
CREATE POLICY "Project creators can view project conversations"
ON public.conversations
FOR SELECT
USING (
  project_id IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = conversations.project_id
    AND p.creator_id = auth.uid()
  )
);