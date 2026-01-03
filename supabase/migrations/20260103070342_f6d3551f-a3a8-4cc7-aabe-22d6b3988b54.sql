-- Add a check constraint to prevent onboarding_completed = true when display_name is null
-- This is done via a trigger since CHECK constraints can't reference other columns in this way

-- Create a function to validate profile completion
CREATE OR REPLACE FUNCTION public.validate_profile_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If trying to set onboarding_completed to true, require a display_name
  IF NEW.onboarding_completed = true AND (NEW.display_name IS NULL OR TRIM(NEW.display_name) = '') THEN
    RAISE EXCEPTION 'Cannot complete onboarding without a display name';
  END IF;
  
  -- If trying to set access_status to 'active', require a display_name
  IF NEW.access_status = 'active' AND (NEW.display_name IS NULL OR TRIM(NEW.display_name) = '') THEN
    RAISE EXCEPTION 'Cannot activate account without a display name';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to enforce profile validation
DROP TRIGGER IF EXISTS validate_profile_before_update ON public.profiles;
CREATE TRIGGER validate_profile_before_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_profile_completion();

-- Also validate on insert
DROP TRIGGER IF EXISTS validate_profile_before_insert ON public.profiles;
CREATE TRIGGER validate_profile_before_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_profile_completion();