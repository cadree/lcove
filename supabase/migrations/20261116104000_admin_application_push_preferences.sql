-- Per-admin opt-in for new ETHER member application push alerts.
-- The central application email remains independent of individual preferences.
BEGIN;

ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS new_member_applications_push_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.notification_preferences.new_member_applications_push_enabled IS
  'Admin-only personal opt-in for new membership application push alerts. Off by default.';

CREATE OR REPLACE FUNCTION public.ether_guard_admin_application_push_preference()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- Non-admins cannot opt into admin application information, even via REST.
  IF NEW.new_member_applications_push_enabled IS TRUE
     AND auth.role() IS DISTINCT FROM 'service_role'
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only administrators can enable new member application push notifications.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS ether_guard_admin_application_push_preference ON public.notification_preferences;
CREATE TRIGGER ether_guard_admin_application_push_preference
  BEFORE INSERT OR UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.ether_guard_admin_application_push_preference();
REVOKE ALL ON FUNCTION public.ether_guard_admin_application_push_preference() FROM PUBLIC, anon, authenticated;

-- The existing queue cron processes this separate outbox independently of email.
DO $$ BEGIN
  PERFORM pgmq.create('member_application_pushes');
EXCEPTION WHEN duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  PERFORM pgmq.create('member_application_pushes_dlq');
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

-- A successful send is recorded per recipient, so retries do not bombard
-- admins who already received an alert.
CREATE TABLE public.application_push_deliveries (
  applicant_user_id uuid NOT NULL,
  admin_user_id uuid NOT NULL,
  delivered_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (applicant_user_id, admin_user_id)
);
ALTER TABLE public.application_push_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.application_push_deliveries FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.application_push_deliveries TO service_role;

CREATE OR REPLACE FUNCTION public.ether_enqueue_member_application_push()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NEW.onboarding_completed IS TRUE AND OLD.onboarding_completed IS DISTINCT FROM TRUE
     AND NEW.access_status = 'pending' THEN
    PERFORM pgmq.send('member_application_pushes', jsonb_build_object(
      'applicant_id', NEW.user_id,
      'queued_at', clock_timestamp()
    ));
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS ether_enqueue_member_application_push ON public.profiles;
CREATE TRIGGER ether_enqueue_member_application_push
  AFTER UPDATE OF onboarding_completed ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.ether_enqueue_member_application_push();

REVOKE ALL ON FUNCTION public.ether_enqueue_member_application_push() FROM PUBLIC, anon, authenticated;
COMMIT;
