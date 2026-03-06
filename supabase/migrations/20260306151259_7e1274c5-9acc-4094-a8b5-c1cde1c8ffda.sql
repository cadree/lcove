
-- Add client project columns to projects
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS client_chat_in_production boolean NOT NULL DEFAULT false;

-- Add is_client_chat to conversations
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS is_client_chat boolean NOT NULL DEFAULT false;

-- Create project_clients table
CREATE TABLE public.project_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  client_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'invited',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, client_user_id)
);

-- Enable RLS
ALTER TABLE public.project_clients ENABLE ROW LEVEL SECURITY;

-- Security definer function to check if user is project creator
CREATE OR REPLACE FUNCTION public.is_project_creator(p_project_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = p_project_id AND creator_id = p_user_id
  )
$$;

-- Security definer function to check if user is a project client
CREATE OR REPLACE FUNCTION public.is_project_client(p_project_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_clients
    WHERE project_id = p_project_id AND client_user_id = p_user_id AND status = 'accepted'
  )
$$;

-- RLS: Project owners can do everything on project_clients
CREATE POLICY "Project owners can manage clients"
ON public.project_clients
FOR ALL
TO authenticated
USING (public.is_project_creator(project_id, auth.uid()))
WITH CHECK (public.is_project_creator(project_id, auth.uid()));

-- RLS: Clients can see their own rows
CREATE POLICY "Clients can view own rows"
ON public.project_clients
FOR SELECT
TO authenticated
USING (client_user_id = auth.uid());

-- RLS: Clients can update their own row (accept invite)
CREATE POLICY "Clients can accept invite"
ON public.project_clients
FOR UPDATE
TO authenticated
USING (client_user_id = auth.uid())
WITH CHECK (client_user_id = auth.uid());

-- Update projects SELECT policy to hide private projects from browse
-- First check existing policies
-- We'll add a new policy for private project visibility
CREATE POLICY "Private projects visible to creator and clients"
ON public.projects
FOR SELECT
TO authenticated
USING (
  is_private = true AND (
    creator_id = auth.uid() OR
    public.is_project_client(id, auth.uid())
  )
);

-- Trigger for updated_at on project_clients
CREATE TRIGGER set_project_clients_updated_at
  BEFORE UPDATE ON public.project_clients
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();
