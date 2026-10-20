-- Red-flag quiz: onboarding_score is the red-flag count (0-10) and
-- onboarding_level is 2 when that count is under 2, otherwise 1.
-- Older rows still store a 0-100 mindset score. A score above 10 keeps
-- the previous pass line (score >= 20) so a later profile edit does not
-- flip those members. This file is not applied by the app.

CREATE OR REPLACE FUNCTION public.sync_profile_exam_access()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- The boolean is derived. Clients cannot set it apart from the stored result.
  IF COALESCE(NEW.onboarding_score, 0) > 10 THEN
    NEW.passed_exam := NEW.onboarding_score >= 20;
  ELSIF NEW.onboarding_level IS NOT NULL THEN
    NEW.passed_exam := NEW.onboarding_level >= 2;
  ELSE
    NEW.passed_exam := COALESCE(NEW.onboarding_score, 0) >= 20;
  END IF;

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
