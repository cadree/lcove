-- Add profile_layout column to profile_customizations for storing section arrangement
ALTER TABLE public.profile_customizations 
ADD COLUMN IF NOT EXISTS profile_layout JSONB DEFAULT '[]'::jsonb;

-- Add comment explaining the structure
COMMENT ON COLUMN public.profile_customizations.profile_layout IS 'Stores profile section layout: [{id: string, visible: boolean, size: "small"|"medium"|"large", order: number}]';