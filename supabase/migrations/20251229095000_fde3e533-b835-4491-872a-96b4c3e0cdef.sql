-- Add social media links column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS social_links jsonb DEFAULT '{}'::jsonb;

-- Add comment explaining the structure
COMMENT ON COLUMN public.profiles.social_links IS 'JSON object containing social media links: { instagram, twitter, tiktok, youtube, linkedin, website }';