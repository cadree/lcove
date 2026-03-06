
-- Guest role applications table
CREATE TABLE public.guest_role_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.project_roles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  portfolio_link TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.guest_role_applications ENABLE ROW LEVEL SECURITY;

-- Anyone (including anon) can insert
CREATE POLICY "Anyone can submit guest applications"
  ON public.guest_role_applications
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only project creators can view guest applications
CREATE POLICY "Project creators can view guest applications"
  ON public.guest_role_applications
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = guest_role_applications.project_id
        AND p.creator_id = auth.uid()
    )
  );

-- Only project creators can update status
CREATE POLICY "Project creators can update guest applications"
  ON public.guest_role_applications
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = guest_role_applications.project_id
        AND p.creator_id = auth.uid()
    )
  );

-- Security definer function to get creator profile without auth
CREATE OR REPLACE FUNCTION public.get_public_creator_profile(creator_user_id UUID)
RETURNS TABLE(display_name TEXT, avatar_url TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT p.display_name, p.avatar_url
  FROM public.profiles p
  WHERE p.user_id = creator_user_id
  LIMIT 1;
$$;
