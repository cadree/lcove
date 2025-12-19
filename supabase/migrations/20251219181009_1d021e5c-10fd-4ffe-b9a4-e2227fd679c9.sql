-- Add phone column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;

-- Add comment for clarity
COMMENT ON COLUMN public.profiles.phone IS 'User phone number collected during onboarding';