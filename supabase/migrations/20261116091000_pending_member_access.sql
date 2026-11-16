-- Approved members retain their existing permissions. Pending applicants can
-- finish their own application, but cannot browse member data or invoke member
-- RPCs. Public guest pages stay public. No email/reviewer-specific bypass.
BEGIN;
CREATE FUNCTION public.ether_member_approved() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.has_role(auth.uid(),'admin') OR EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.user_id=auth.uid()
  AND p.access_status='active' AND p.onboarding_completed
  AND p.deleted_at IS NULL AND NOT coalesce(p.is_suspended,false)
 );
$$;
REVOKE ALL ON FUNCTION public.ether_member_approved() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ether_member_approved() TO anon,authenticated,service_role;

-- Restrictive policies also protect direct table reads and Realtime. They add
-- a condition to existing policies; they never grant new access.
DO $$ DECLARE t record; predicate text; BEGIN
 FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity
 LOOP
  predicate := '(SELECT public.ether_member_approved())';
  IF t.relname IN ('profiles','user_roles','user_passions','user_skills','user_creative_roles','questionnaire_responses') THEN
   predicate := predicate || ' OR user_id=(SELECT auth.uid())';
  ELSIF t.relname IN ('passions','skills','creative_roles') THEN
   CONTINUE; -- Read-only onboarding catalogs retain their existing policies.
  END IF;
  EXECUTE format('CREATE POLICY ether_pending_access ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (%s) WITH CHECK (%s)',t.relname,predicate,predicate);
 END LOOP;
END $$;

-- Owner-executed views bypass table RLS. Preserve their exact definitions for
-- rollback and add a viewer check. Profiles additionally hide applicants from
-- approved members while allowing applicants to see their own profile.
CREATE SCHEMA IF NOT EXISTS ether_release_private;
REVOKE ALL ON SCHEMA ether_release_private FROM PUBLIC,anon,authenticated;
CREATE TABLE ether_release_private.pending_access_views(name text PRIMARY KEY, definition text NOT NULL);
DO $$ DECLARE v record; predicate text; BEGIN
 FOR v IN SELECT viewname,definition FROM pg_views WHERE schemaname='public' LOOP
  INSERT INTO ether_release_private.pending_access_views VALUES(v.viewname,v.definition);
  predicate := '(auth.uid() IS NULL OR public.ether_member_approved())';
  IF v.viewname='profiles_public' THEN
   predicate := '(user_id=auth.uid() OR public.has_role(auth.uid(),''admin'') OR ((auth.uid() IS NULL OR public.ether_member_approved()) AND access_status=''active'' AND onboarding_completed AND NOT coalesce(is_suspended,false)))';
  END IF;
  EXECUTE format('CREATE OR REPLACE VIEW public.%I AS SELECT * FROM (%s) ether_gated_view WHERE %s',v.viewname,rtrim(v.definition,E';\n '),predicate);
 END LOOP;
END $$;

-- The REST hook covers SECURITY DEFINER RPCs too. It does not replace RLS.
-- Refuse to overwrite another hook. Reconcile explicitly if one exists.
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_db_role_setting s JOIN pg_roles r ON r.oid=s.setrole,
   unnest(s.setconfig) setting WHERE r.rolname='authenticator' AND setting LIKE 'pgrst.db_pre_request=%'
   AND setting NOT IN ('pgrst.db_pre_request=','pgrst.db_pre_request=public.ether_pending_request_guard')) THEN
  RAISE EXCEPTION 'An existing API pre-request hook must be composed before applying this migration';
 END IF;
END $$;
CREATE FUNCTION public.ether_pending_request_guard() RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE path text:=current_setting('request.path',true);
BEGIN
 IF auth.role()='service_role' OR auth.uid() IS NULL OR public.ether_member_approved() THEN RETURN; END IF;
 IF path IN ('/profiles','/profiles_public','/user_roles','/passions','/skills','/creative_roles',
  '/user_passions','/user_skills','/user_creative_roles','/questionnaire_responses','/rpc/claim_waitlist_invite') THEN RETURN; END IF;
 RAISE EXCEPTION 'Your application is awaiting approval.' USING ERRCODE='42501';
END $$;
REVOKE ALL ON FUNCTION public.ether_pending_request_guard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ether_pending_request_guard() TO anon,authenticated,service_role;
ALTER ROLE authenticator SET pgrst.db_pre_request='public.ether_pending_request_guard';
NOTIFY pgrst,'reload config';
NOTIFY pgrst,'reload schema';
COMMIT;
