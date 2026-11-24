-- Approved applicants get a phone push ("your account was approved") that
-- opens Explore. The in-app notice and welcome email from
-- ether_notify_member_accepted are unchanged.
--
-- 1. Pending applicants may store and remove their OWN device token. Before
--    this, the pending-access policy and the API guard rejected the write, so
--    nobody had a token on file at approval time and the push had nowhere to go.
-- 2. The first acceptance event (written once per applicant by
--    ether_notify_member_accepted) queues one push on member_approval_pushes.
--    process-email-queue drains it next to member_application_pushes.
-- Rollback: supabase/rollbacks/20261123010000_member_approval_push.down.sql
BEGIN;

DROP POLICY IF EXISTS ether_pending_access ON public.push_subscriptions;
CREATE POLICY ether_pending_access ON public.push_subscriptions AS RESTRICTIVE
  FOR ALL TO authenticated
  USING ((SELECT public.ether_member_approved()) OR user_id = (SELECT auth.uid()))
  WITH CHECK ((SELECT public.ether_member_approved()) OR user_id = (SELECT auth.uid()));

-- Keep the existing guard and add only the device-token table. The row-level
-- policies above still limit a pending user to their own rows.
DO $$ DECLARE def text; BEGIN
  SELECT pg_get_functiondef('public.ether_pending_request_guard()'::regprocedure) INTO def;
  IF position('''/push_subscriptions''' in def) > 0 THEN RETURN; END IF;
  IF position('''/rpc/get_my_member_referral_code''' in def) = 0 THEN
    RAISE EXCEPTION 'Unexpected pending guard; review before migrating';
  END IF;
  EXECUTE replace(def, '''/rpc/get_my_member_referral_code''',
    '''/push_subscriptions'',''/rpc/get_my_member_referral_code''');
END $$;

DO $$ BEGIN
  PERFORM pgmq.create('member_approval_pushes');
EXCEPTION WHEN duplicate_table THEN NULL; END $$;
DO $$ BEGIN
  PERFORM pgmq.create('member_approval_pushes_dlq');
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.ether_enqueue_member_approval_push()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  PERFORM pgmq.send('member_approval_pushes', jsonb_build_object(
    'applicant_id', NEW.applicant_user_id,
    'queued_at', clock_timestamp()
  ));
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.ether_enqueue_member_approval_push() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS ether_enqueue_member_approval_push ON public.member_acceptance_events;
CREATE TRIGGER ether_enqueue_member_approval_push
  AFTER INSERT ON public.member_acceptance_events
  FOR EACH ROW EXECUTE FUNCTION public.ether_enqueue_member_approval_push();

NOTIFY pgrst, 'reload schema';
COMMIT;
