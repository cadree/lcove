-- ETHER approval funnel: require review links and enqueue one admin email when
-- onboarding first moves to pending. Requires pgmq transactional_emails and the
-- existing process-email-queue cron/Resend worker to actually deliver messages.
BEGIN;

CREATE OR REPLACE FUNCTION public.ether_require_application_links()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_social text;
  v_website text;
BEGIN
  -- Do not retroactively reject established accounts or ordinary profile edits.
  IF NEW.onboarding_completed IS NOT TRUE OR OLD.onboarding_completed IS TRUE
     OR NEW.access_status IS DISTINCT FROM 'pending' THEN
    RETURN NEW;
  END IF;

  v_social := NULLIF(btrim(NEW.social_links->>'social_profile'), '');
  v_website := NULLIF(btrim(NEW.social_links->>'website'), '');

  IF v_social IS NULL AND v_website IS NULL THEN
    RAISE EXCEPTION 'A public social media or website link is required for membership review.'
      USING ERRCODE = '23514';
  END IF;
  IF (v_social IS NOT NULL AND (
        char_length(v_social) > 500
        OR v_social !~* '^https?://[^[:space:]/]+[.][^[:space:]/]+'
      )) OR (v_website IS NOT NULL AND (
        char_length(v_website) > 500
        OR v_website !~* '^https?://[^[:space:]/]+[.][^[:space:]/]+'
      )) THEN
    RAISE EXCEPTION 'Provide a valid public URL for each application link.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ether_require_application_links ON public.profiles;
CREATE TRIGGER ether_require_application_links
  BEFORE UPDATE OF onboarding_completed ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.ether_require_application_links();

CREATE OR REPLACE FUNCTION public.ether_notify_pending_application()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_message_id text;
  v_body text;
BEGIN
  -- This fires only after an actual application, not on each profile edit.
  IF NEW.onboarding_completed IS DISTINCT FROM TRUE
     OR OLD.onboarding_completed IS TRUE
     OR NEW.access_status IS DISTINCT FROM 'pending' THEN
    RETURN NEW;
  END IF;

  v_message_id := 'ether-application-' || gen_random_uuid()::text;
  v_body := concat_ws(E'\n',
    'A new ETHER member application is ready for review.',
    'Applicant: ' || coalesce(NEW.display_name, 'Unnamed'),
    'City: ' || coalesce(NEW.city_display, NEW.city, 'Not provided'),
    'Social media: ' || coalesce(nullif(NEW.social_links->>'social_profile', ''), 'Not provided'),
    'Website: ' || coalesce(nullif(NEW.social_links->>'website', ''), 'Not provided'),
    'Review: https://etherbylcove.com/admin/onboarding/' || NEW.user_id::text
  );
  -- Queue atomically with onboarding. If email infrastructure is unavailable,
  -- the application remains unsubmitted so it can be retried rather than
  -- showing a success page with a silently missing approval request.
  PERFORM pgmq.send('transactional_emails', jsonb_build_object(
    'message_id', v_message_id,
    'idempotency_key', v_message_id,
    'to', 'etherbylcove@gmail.com',
    'subject', 'New ETHER application awaiting approval',
    'text', v_body,
    'label', 'ether_application_pending',
    'queued_at', clock_timestamp()
  ));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ether_notify_pending_application ON public.profiles;
CREATE TRIGGER ether_notify_pending_application
  AFTER UPDATE OF onboarding_completed ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.ether_notify_pending_application();

REVOKE ALL ON FUNCTION public.ether_require_application_links() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ether_notify_pending_application() FROM PUBLIC, anon, authenticated;
COMMIT;

-- After applying, confirm the transactional_emails queue worker's cron and
-- Resend settings, then submit a disposable staging applicant. Check
-- email_send_log (label ether_application_pending) and Gmail delivery. A prior
-- application already marked completed will not automatically enqueue again.
