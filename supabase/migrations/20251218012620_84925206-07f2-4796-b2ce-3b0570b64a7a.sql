-- Create projects table
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  total_budget DECIMAL(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  timeline_start DATE,
  timeline_end DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'in_progress', 'completed', 'cancelled')),
  cover_image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create project roles table
CREATE TABLE public.project_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL,
  description TEXT,
  payout_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  slots_available INTEGER NOT NULL DEFAULT 1,
  slots_filled INTEGER NOT NULL DEFAULT 0,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create project applications table
CREATE TABLE public.project_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.project_roles(id) ON DELETE CASCADE,
  applicant_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID
);

-- Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_applications ENABLE ROW LEVEL SECURITY;

-- Projects policies
CREATE POLICY "Anyone can view open projects"
ON public.projects FOR SELECT
USING (status IN ('open', 'in_progress', 'completed') OR creator_id = auth.uid());

CREATE POLICY "Users can create projects"
ON public.projects FOR INSERT
WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creators can update their projects"
ON public.projects FOR UPDATE
USING (auth.uid() = creator_id);

CREATE POLICY "Creators can delete draft projects"
ON public.projects FOR DELETE
USING (auth.uid() = creator_id AND status = 'draft');

-- Project roles policies
CREATE POLICY "Anyone can view roles of visible projects"
ON public.project_roles FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.projects p 
  WHERE p.id = project_roles.project_id 
  AND (p.status IN ('open', 'in_progress', 'completed') OR p.creator_id = auth.uid())
));

CREATE POLICY "Project creators can manage roles"
ON public.project_roles FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.projects p 
  WHERE p.id = project_roles.project_id AND p.creator_id = auth.uid()
));

CREATE POLICY "Project creators can update roles"
ON public.project_roles FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.projects p 
  WHERE p.id = project_roles.project_id AND p.creator_id = auth.uid()
));

CREATE POLICY "Project creators can delete unlocked roles"
ON public.project_roles FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.projects p 
  WHERE p.id = project_roles.project_id AND p.creator_id = auth.uid()
) AND is_locked = false);

-- Applications policies
CREATE POLICY "Applicants can view own applications"
ON public.project_applications FOR SELECT
USING (applicant_id = auth.uid() OR EXISTS (
  SELECT 1 FROM public.projects p 
  WHERE p.id = project_applications.project_id AND p.creator_id = auth.uid()
));

CREATE POLICY "Users can apply to projects"
ON public.project_applications FOR INSERT
WITH CHECK (auth.uid() = applicant_id);

CREATE POLICY "Applicants can withdraw applications"
ON public.project_applications FOR UPDATE
USING (applicant_id = auth.uid() AND status = 'pending')
WITH CHECK (status = 'withdrawn');

CREATE POLICY "Creators can review applications"
ON public.project_applications FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.projects p 
  WHERE p.id = project_applications.project_id AND p.creator_id = auth.uid()
));

-- Indexes
CREATE INDEX idx_projects_creator ON public.projects(creator_id);
CREATE INDEX idx_projects_status ON public.projects(status);
CREATE INDEX idx_project_roles_project ON public.project_roles(project_id);
CREATE INDEX idx_applications_project ON public.project_applications(project_id);
CREATE INDEX idx_applications_applicant ON public.project_applications(applicant_id);
CREATE INDEX idx_applications_status ON public.project_applications(status);

-- Trigger for updated_at
CREATE TRIGGER update_projects_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to lock role and update slots when application accepted
CREATE OR REPLACE FUNCTION public.handle_application_accepted()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    UPDATE public.project_roles 
    SET slots_filled = slots_filled + 1,
        is_locked = CASE WHEN slots_filled + 1 >= slots_available THEN true ELSE is_locked END
    WHERE id = NEW.role_id;
    NEW.reviewed_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_application_accepted
BEFORE UPDATE ON public.project_applications
FOR EACH ROW
EXECUTE FUNCTION public.handle_application_accepted();