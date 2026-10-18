-- Open access for finished onboarding, store exam result, and stop
-- exposing every profile (including phone) to any authenticated user.
-- This file is not applied by the app. Apply it in a review environment.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS passed_exam boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_only_to_passed_exam boolean NOT NULL DEFAULT false;

-- passed = score >= 20 of 30. Members who never scored stay false.
UPDATE public.profiles
SET passed_exam = COALESCE(onboarding_score, 0) >= 20;

-- Anyone who already finished onboarding is let in.
-- Denied rows become active. Banned stays banned.
UPDATE public.profiles
SET access_status = 'active'
WHERE onboarding_completed = true
  AND access_status IS DISTINCT FROM 'banned'
  AND access_status IS DISTINCT FROM 'active';

UPDATE public.profiles
SET access_status = 'active'
WHERE access_status = 'denied';

UPDATE public.profiles
SET show_only_to_passed_exam = false
WHERE passed_exam = false OR show_only_to_passed_exam IS NULL;

CREATE OR REPLACE FUNCTION public.sync_profile_exam_access()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- The boolean is derived. Clients cannot set it apart from the score.
  NEW.passed_exam := COALESCE(NEW.onboarding_score, 0) >= 20;

  IF NEW.passed_exam IS NOT TRUE THEN
    NEW.show_only_to_passed_exam := false;
  END IF;

  -- Quiz denial is retired. 'banned' is unchanged.
  IF NEW.access_status = 'denied' THEN
    NEW.access_status := 'active';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_profile_exam_access ON public.profiles;
CREATE TRIGGER sync_profile_exam_access
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_exam_access();

-- Own row only on the base table. The 20260302182145 policy let every
-- authenticated user read phone and the exam score.
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;

CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- profiles_public is the only way to read someone else.
-- security_invoker is off so own-row RLS does not hide every other row.
-- The WHERE clause is the visibility rule. Phone and onboarding_score
-- are not selected.
DROP VIEW IF EXISTS public.profiles_public;

CREATE VIEW public.profiles_public
WITH (security_barrier = true, security_invoker = false) AS
SELECT
  p.id,
  p.user_id,
  p.display_name,
  p.city,
  p.city_display,
  p.city_key,
  p.bio,
  p.avatar_url,
  p.passion_seriousness,
  p.access_level,
  p.onboarding_completed,
  p.created_at,
  p.updated_at,
  p.mindset_level,
  p.access_status,
  p.social_links,
  p.is_suspended,
  p.suspended_at,
  p.suspension_reason,
  p.onboarding_level
FROM public.profiles p
WHERE
  p.user_id = auth.uid()
  OR COALESCE(p.show_only_to_passed_exam, false) = false
  OR public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1
    FROM public.profiles viewer
    WHERE viewer.user_id = auth.uid()
      AND viewer.passed_exam = true
  );

GRANT SELECT ON public.profiles_public TO anon, authenticated;
