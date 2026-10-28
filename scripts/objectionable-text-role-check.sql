-- Signed-in write against reject_objectionable_text.
-- objectionable_text is revoked from authenticated, the same way the
-- function-grant lockdown leaves it. The insert runs as authenticated,
-- not service_role. Run only from scripts/objectionable-text-role-check.sh.

\set ON_ERROR_STOP on

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN NOINHERIT;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO service_role;

CREATE TABLE public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  content text
);

GRANT SELECT, INSERT, UPDATE ON public.posts TO authenticated;

CREATE OR REPLACE FUNCTION public.objectionable_text(input text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$ SELECT false $$;

REVOKE ALL ON FUNCTION public.objectionable_text(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.objectionable_text(text) TO service_role;

\ir ../supabase/migrations/20261022120000_objectionable_text_record_fields.sql

CREATE TRIGGER reject_objectionable_posts
  BEFORE INSERT OR UPDATE OF content ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.reject_objectionable_text();

\ir ../supabase/migrations/20261023040000_reject_objectionable_text_security_definer.sql

REVOKE ALL ON FUNCTION public.objectionable_text(text) FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  definer boolean;
  config text[];
BEGIN
  SELECT p.prosecdef, p.proconfig INTO definer, config
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'reject_objectionable_text';

  IF definer IS NOT TRUE THEN
    RAISE EXCEPTION 'FAIL: reject_objectionable_text is not security definer';
  END IF;
  IF NOT (config @> ARRAY['search_path=public, pg_temp']) THEN
    RAISE EXCEPTION 'FAIL: search_path is %', config;
  END IF;
END $$;

SET ROLE authenticated;

INSERT INTO public.posts (user_id, content)
VALUES ('11111111-1111-4111-8111-111111111111', 'signed-in post');

UPDATE public.posts
SET content = 'signed-in edit'
WHERE user_id = '11111111-1111-4111-8111-111111111111';

RESET ROLE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.posts
    WHERE user_id = '11111111-1111-4111-8111-111111111111'
      AND content = 'signed-in edit'
  ) THEN
    RAISE EXCEPTION 'FAIL: authenticated write did not land';
  END IF;
  RAISE NOTICE 'PASS: authenticated write ran reject_objectionable_text';
END $$;
