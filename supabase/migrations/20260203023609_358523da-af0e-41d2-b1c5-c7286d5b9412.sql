-- Create organizations table
CREATE TABLE public.organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  owner_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create organization members table
CREATE TABLE public.organization_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

-- Add organization_id to events table
ALTER TABLE public.events 
ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

-- Add timezone column to events if not exists
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York';

-- Add status column to events if not exists
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'cancelled', 'completed'));

-- Enable RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- Organizations policies: anyone can view, members can update
CREATE POLICY "Anyone can view organizations" 
ON public.organizations FOR SELECT USING (true);

CREATE POLICY "Owners can update their organizations" 
ON public.organizations FOR UPDATE 
USING (owner_id = auth.uid());

CREATE POLICY "Authenticated users can create organizations" 
ON public.organizations FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL AND owner_id = auth.uid());

CREATE POLICY "Owners can delete their organizations" 
ON public.organizations FOR DELETE 
USING (owner_id = auth.uid());

-- Organization members policies
CREATE POLICY "Anyone can view organization members" 
ON public.organization_members FOR SELECT USING (true);

CREATE POLICY "Org owners/admins can add members" 
ON public.organization_members FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om 
    WHERE om.organization_id = organization_id 
    AND om.user_id = auth.uid() 
    AND om.role IN ('owner', 'admin')
  )
  OR EXISTS (
    SELECT 1 FROM public.organizations o 
    WHERE o.id = organization_id 
    AND o.owner_id = auth.uid()
  )
);

CREATE POLICY "Org owners/admins can update members" 
ON public.organization_members FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om 
    WHERE om.organization_id = organization_id 
    AND om.user_id = auth.uid() 
    AND om.role IN ('owner', 'admin')
  )
  OR EXISTS (
    SELECT 1 FROM public.organizations o 
    WHERE o.id = organization_id 
    AND o.owner_id = auth.uid()
  )
);

CREATE POLICY "Org owners/admins can remove members" 
ON public.organization_members FOR DELETE 
USING (
  user_id = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM public.organization_members om 
    WHERE om.organization_id = organization_id 
    AND om.user_id = auth.uid() 
    AND om.role IN ('owner', 'admin')
  )
  OR EXISTS (
    SELECT 1 FROM public.organizations o 
    WHERE o.id = organization_id 
    AND o.owner_id = auth.uid()
  )
);

-- Function to auto-add owner as member when org is created
CREATE OR REPLACE FUNCTION public.add_org_owner_as_member()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_organization_created
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.add_org_owner_as_member();

-- Update events RLS to allow org members to create events
DROP POLICY IF EXISTS "Authenticated users can create events" ON public.events;

CREATE POLICY "Users can create events for themselves or their orgs" 
ON public.events FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND creator_id = auth.uid()
  AND (
    organization_id IS NULL 
    OR EXISTS (
      SELECT 1 FROM public.organization_members om 
      WHERE om.organization_id = events.organization_id 
      AND om.user_id = auth.uid()
    )
  )
);

-- Trigger for updated_at on organizations
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();