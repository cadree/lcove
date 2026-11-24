-- Undo 20261123010000_member_approval_push.sql.
-- Pending applicants lose the ability to save device tokens again; tokens
-- already saved stay (they are the user's own rows and become usable on approval).
BEGIN;
DROP TRIGGER IF EXISTS ether_enqueue_member_approval_push ON public.member_acceptance_events;
DROP FUNCTION IF EXISTS public.ether_enqueue_member_approval_push();

DO $$ BEGIN PERFORM pgmq.drop_queue('member_approval_pushes'); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN PERFORM pgmq.drop_queue('member_approval_pushes_dlq'); EXCEPTION WHEN others THEN NULL; END $$;

DROP POLICY IF EXISTS ether_pending_access ON public.push_subscriptions;
CREATE POLICY ether_pending_access ON public.push_subscriptions AS RESTRICTIVE
  FOR ALL TO authenticated
  USING ((SELECT public.ether_member_approved()))
  WITH CHECK ((SELECT public.ether_member_approved()));

DO $$ DECLARE def text; BEGIN
  SELECT pg_get_functiondef('public.ether_pending_request_guard()'::regprocedure) INTO def;
  IF position('''/push_subscriptions'',' in def) = 0 THEN RETURN; END IF;
  EXECUTE replace(def, '''/push_subscriptions'',', '');
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
