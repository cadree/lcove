-- Create a public view for profiles that hides sensitive fields (phone)
-- This view can be used for social features like directory, friends, etc.
CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = on) AS
SELECT 
  id,
  user_id,
  display_name,
  city,
  city_display,
  city_key,
  bio,
  avatar_url,
  passion_seriousness,
  access_level,
  onboarding_completed,
  created_at,
  updated_at,
  mindset_level,
  access_status,
  onboarding_score,
  social_links,
  is_suspended,
  suspended_at,
  suspension_reason,
  onboarding_level
FROM public.profiles;
-- Note: Excludes 'phone' field for privacy

-- Drop the old overly permissive SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;

-- Create new restricted SELECT policy - users can only see their own profile directly
-- For viewing other users, they must use the profiles_public view
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Keep admin policy as is (Admins can view all profiles already exists)