-- Runs in the same session as the bundle, still SET ROLE ether_hosted.

DO $$
BEGIN
  IF current_user <> 'ether_hosted' THEN
    RAISE EXCEPTION 'FAIL: bundle session is %', current_user;
  END IF;
  IF (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) THEN
    RAISE EXCEPTION 'FAIL: ether_hosted is a superuser';
  END IF;
  IF pg_has_role(current_user, 'supabase_admin', 'MEMBER') THEN
    RAISE EXCEPTION 'FAIL: ether_hosted is a member of supabase_admin';
  END IF;
  IF pg_has_role(current_user, 'postgres', 'MEMBER') THEN
    RAISE EXCEPTION 'FAIL: ether_hosted is a member of postgres';
  END IF;

  BEGIN
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC';
    RAISE EXCEPTION 'FAIL: non-member changed supabase_admin default privileges';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'PASS: non-member cannot change supabase_admin default privileges';
  END;

  IF EXISTS (
    SELECT 1
    FROM pg_default_acl d
    JOIN pg_roles r ON r.oid = d.defaclrole
    WHERE r.rolname = 'supabase_admin'
  ) THEN
    RAISE EXCEPTION 'FAIL: supabase_admin default privileges were written';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.ether_schema_migrations
    WHERE version = '20261018211500_lock_definer_grants_and_open_inserts.sql'
  ) THEN
    RAISE EXCEPTION 'FAIL: lock migration was not recorded';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'profiles'
  ) THEN
    RAISE EXCEPTION 'FAIL: profiles is in supabase_realtime';
  END IF;

  IF (
    SELECT n.nspname
    FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'pg_net'
  ) IS DISTINCT FROM 'public' THEN
    RAISE EXCEPTION 'FAIL: pg_net was moved by a role that does not own it';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'enqueue_email', 'read_email_batch', 'delete_email', 'move_to_dlq',
        'ledger_entry_deltas', 'request_header', 'xp_level'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) cfg
        WHERE cfg LIKE 'search_path=%'
      )
  ) THEN
    RAISE EXCEPTION 'FAIL: a reported function still has no search_path';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'user_credits_pool_check'
      AND 'security_invoker=true' = ANY (c.reloptions)
  ) THEN
    RAISE EXCEPTION 'FAIL: user_credits_pool_check is not security_invoker';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'profiles_public'
      AND 'security_invoker=false' = ANY (c.reloptions)
  ) THEN
    RAISE EXCEPTION 'FAIL: profiles_public must stay security_invoker false';
  END IF;
END $$;

CREATE FUNCTION public.ether_hosted_probe()
RETURNS integer
LANGUAGE sql
AS $$ SELECT 1 $$;

DO $$
BEGIN
  IF has_function_privilege('anon', 'public.ether_hosted_probe()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.ether_hosted_probe()', 'EXECUTE')
     OR has_function_privilege('public', 'public.ether_hosted_probe()', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: the migration role still grants execute to anon, authenticated, or PUBLIC';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.ether_hosted_probe()', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: the migration role did not grant execute to service_role';
  END IF;
  RAISE NOTICE 'PASS: migration-role default privileges exclude anon and authenticated';
END $$;

DROP FUNCTION public.ether_hosted_probe();

RESET ROLE;

CREATE FUNCTION public.ether_postgres_still_open()
RETURNS integer
LANGUAGE sql
AS $$ SELECT 1 $$;

DO $$
BEGIN
  IF NOT has_function_privilege('anon', 'public.ether_postgres_still_open()', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: the non-member session changed postgres default privileges';
  END IF;
  RAISE NOTICE 'PASS: postgres default privileges stay with the postgres role';
END $$;

DROP FUNCTION public.ether_postgres_still_open();
