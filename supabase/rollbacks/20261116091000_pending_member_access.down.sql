BEGIN;
ALTER ROLE authenticator RESET pgrst.db_pre_request;
DO $$ DECLARE v record; t record; BEGIN
 FOR v IN SELECT * FROM ether_release_private.pending_access_views LOOP
  EXECUTE format('CREATE OR REPLACE VIEW public.%I AS %s',v.name,v.definition);
 END LOOP;
 FOR t IN SELECT tablename FROM pg_policies WHERE schemaname='public' AND policyname='ether_pending_access' LOOP
  EXECUTE format('DROP POLICY ether_pending_access ON public.%I',t.tablename);
 END LOOP;
END $$;
DROP TABLE ether_release_private.pending_access_views;
DROP FUNCTION public.ether_pending_request_guard();
DROP FUNCTION public.ether_member_approved();
NOTIFY pgrst,'reload config';
NOTIFY pgrst,'reload schema';
COMMIT;
