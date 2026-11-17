-- Permit ONE public review link while preserving contact verification and review integrity.
-- Website-only applicants must have a verified signup email. This verifies the
-- applicant's contact channel; it does NOT prove ownership of the website.
BEGIN;
CREATE OR REPLACE FUNCTION public.ether_require_application_links()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_social text;
  v_site text;
  v_url text;
  v_host text;
BEGIN
  IF NEW.onboarding_completed IS NOT TRUE
     OR NEW.access_status IS DISTINCT FROM 'pending'
     OR (OLD.onboarding_completed IS TRUE AND NEW.social_links IS NOT DISTINCT FROM OLD.social_links) THEN
    RETURN NEW;
  END IF;

  v_social := NULLIF(btrim(NEW.social_links->>'social_profile'), '');
  v_site := NULLIF(btrim(NEW.social_links->>'website'), '');

  IF v_social IS NULL AND v_site IS NULL THEN
    RAISE EXCEPTION 'A public social profile OR website/portfolio URL is required for review.'
      USING ERRCODE = '23514';
  END IF;

  FOREACH v_url IN ARRAY ARRAY[v_social, v_site] LOOP
    IF v_url IS NULL THEN CONTINUE; END IF;
    IF length(v_url) > 500 OR v_url !~* '^https?://[a-z0-9][a-z0-9.-]*[.][a-z]{2,}(:[0-9]+)?([/?#][^[:space:]]*)?$' THEN
      RAISE EXCEPTION 'Provide a valid public URL for each supplied application link.'
        USING ERRCODE = '23514';
    END IF;
    v_host := lower(split_part(regexp_replace(v_url, '^https?://', '', 'i'), '/', 1));
    IF v_host ~ '^(localhost|127[.]|0[.]|10[.]|192[.]168[.]|172[.](1[6-9]|2[0-9]|3[01])[.])' THEN
      RAISE EXCEPTION 'Provide a publicly accessible URL for review.'
        USING ERRCODE = '23514';
    END IF;
  END LOOP;

  IF v_social IS NULL AND NOT EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id=NEW.user_id AND u.email IS NOT NULL AND u.email_confirmed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Verify your account email before submitting a website-only application.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS ether_require_application_links ON public.profiles;
CREATE TRIGGER ether_require_application_links
  BEFORE UPDATE OF onboarding_completed, social_links ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.ether_require_application_links();
REVOKE ALL ON FUNCTION public.ether_require_application_links() FROM PUBLIC, anon, authenticated;
COMMIT;
