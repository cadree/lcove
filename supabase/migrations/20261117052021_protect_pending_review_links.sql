-- Keep required review links present while an application is pending.
BEGIN;
CREATE OR REPLACE FUNCTION public.ether_require_application_links()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE value text; host text;
BEGIN
 IF NEW.onboarding_completed IS NOT TRUE OR (OLD.onboarding_completed IS TRUE AND NEW.social_links IS NOT DISTINCT FROM OLD.social_links)
    OR NEW.access_status IS DISTINCT FROM 'pending' THEN RETURN NEW; END IF;
 FOREACH value IN ARRAY ARRAY[NEW.social_links->>'social_profile',NEW.social_links->>'website'] LOOP
  IF value IS NULL OR btrim(value)='' THEN
   RAISE EXCEPTION 'A public social profile and website or portfolio link are required for review.' USING ERRCODE='23514';
  END IF;
  IF length(value)>500 OR value !~* '^https?://[a-z0-9][a-z0-9.-]*[.][a-z]{2,}(:[0-9]+)?([/?#][^[:space:]]*)?$' THEN
   RAISE EXCEPTION 'Provide a valid public URL for each application link.' USING ERRCODE='23514';
  END IF;
  host:=lower(split_part(regexp_replace(value,'^https?://','','i'),'/',1));
  IF host ~ '^(localhost|127[.]|0[.]|10[.]|192[.]168[.]|172[.](1[6-9]|2[0-9]|3[01])[.])' THEN
   RAISE EXCEPTION 'Provide a public URL for review.' USING ERRCODE='23514';
  END IF;
 END LOOP;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS ether_require_application_links ON public.profiles;
CREATE TRIGGER ether_require_application_links BEFORE UPDATE OF onboarding_completed,social_links ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.ether_require_application_links();
REVOKE ALL ON FUNCTION public.ether_require_application_links() FROM PUBLIC,anon,authenticated;
COMMIT;
