-- Extend the staged review funnel: both links, all admin inboxes, and in-app review links.
BEGIN;
CREATE OR REPLACE FUNCTION public.ether_require_application_links()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE value text; host text;
BEGIN
 IF NEW.onboarding_completed IS NOT TRUE OR OLD.onboarding_completed IS TRUE
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
CREATE OR REPLACE FUNCTION public.ether_notify_pending_application()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE recipient record; review_path text; message_key text; email_body text; submission uuid:=gen_random_uuid();
BEGIN
 IF NEW.onboarding_completed IS DISTINCT FROM TRUE OR OLD.onboarding_completed IS TRUE
    OR NEW.access_status IS DISTINCT FROM 'pending' THEN RETURN NEW; END IF;
 review_path:='/admin/onboarding/'||NEW.user_id::text;
 email_body:=concat_ws(E'\n',
  'A new ETHER member application is ready for review.',
  'Applicant: '||coalesce(NEW.display_name,'Unnamed'),
  'City: '||coalesce(NEW.city_display,NEW.city,'Not provided'),
  'Social media: '||(NEW.social_links->>'social_profile'),
  'Website / portfolio: '||(NEW.social_links->>'website'),
  'Review: https://etherbylcove.com'||review_path);
 -- Keep the requested central review inbox and deduplicate admin email addresses.
 FOR recipient IN
  SELECT lower(email) AS email FROM auth.users u
   WHERE EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=u.id AND r.role='admin')
    AND u.email IS NOT NULL
  UNION SELECT 'etherbylcove@gmail.com'
 LOOP
  message_key:='ether-application-'||submission::text||'-'||md5(recipient.email);
  PERFORM pgmq.send('transactional_emails',jsonb_build_object(
   'message_id',message_key,'idempotency_key',message_key,'to',recipient.email,
   'subject','New ETHER application awaiting approval','text',email_body,
   'label','ether_application_pending','queued_at',clock_timestamp()));
 END LOOP;
 INSERT INTO public.notifications(user_id,type,title,body,data)
 SELECT DISTINCT r.user_id,'member_application','New ETHER membership application',
  coalesce(NEW.display_name,'A creator')||' is awaiting approval.',
  jsonb_build_object('applicant_id',NEW.user_id,'path',review_path)
 FROM public.user_roles r WHERE r.role='admin';
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.ether_notify_pending_application() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.ether_require_application_links() FROM PUBLIC,anon,authenticated;
COMMIT;
