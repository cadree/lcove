-- Add project_id and external_url columns to events table
ALTER TABLE public.events 
ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
ADD COLUMN external_url text;

-- Create index for project_id lookups
CREATE INDEX idx_events_project_id ON public.events(project_id) WHERE project_id IS NOT NULL;