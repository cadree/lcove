-- Role proof for the hosting migration. Run against a scratch database
-- after every migration, inside one transaction that rolls back.
-- Never point this at ether-prod.

\set ON_ERROR_STOP on

BEGIN;

DO $$
DECLARE
  v_schema text;
BEGIN
  SELECT n.nspname INTO v_schema
  FROM pg_extension e
  JOIN pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname = 'pgcrypto';
  IF v_schema IS DISTINCT FROM 'extensions' THEN
    RAISE EXCEPTION 'FAIL: pgcrypto is in %, not extensions', COALESCE(v_schema, 'nowhere');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public._ether_crypt_path_probe()
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $probe$
BEGIN
  PERFORM crypt('x', gen_salt('bf'));
END
$probe$;

DO $$
BEGIN
  BEGIN
    PERFORM public._ether_crypt_path_probe();
    RAISE EXCEPTION 'FAIL: crypt() was visible with search_path = public';
  EXCEPTION
    WHEN undefined_function THEN
      NULL;
  END;
END $$;

DROP FUNCTION public._ether_crypt_path_probe();

ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS raw_user_meta_data jsonb;

INSERT INTO auth.users (id, email)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'host@example.com');

SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}', true);
SET ROLE authenticated;

INSERT INTO public.events (creator_id, title, city, start_date, end_date, venue, is_public, status)
VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Listening night',
  'New York',
  '2026-11-01 23:00:00+00',
  '2026-11-02 02:00:00+00',
  'The loft',
  true,
  'published'
);

SELECT public.set_event_access(
  (SELECT id FROM public.events WHERE title = 'Listening night'),
  true,
  '18 Mercer Street',
  'secret-night',
  true
);

DO $$
DECLARE
  v_id uuid;
  v_address text;
BEGIN
  SELECT id INTO v_id FROM public.events WHERE title = 'Listening night';
  SELECT address INTO v_address FROM public.events WHERE id = v_id;
  IF v_address IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: hidden street stayed on the public events row';
  END IF;
  IF public.host_event_address(v_id) IS DISTINCT FROM '18 Mercer Street' THEN
    RAISE EXCEPTION 'FAIL: host cannot read the private address';
  END IF;
  IF public.event_password_ok(v_id, 'wrong') THEN
    RAISE EXCEPTION 'FAIL: wrong password was accepted';
  END IF;
  IF NOT public.event_password_ok(v_id, 'secret-night') THEN
    RAISE EXCEPTION 'FAIL: the host password was refused';
  END IF;
END $$;

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claim.role', 'anon', true);
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SET ROLE anon;

DO $$
DECLARE
  v_id uuid;
  v_preview jsonb;
BEGIN
  SELECT id INTO v_id FROM public.events WHERE title = 'Listening night';
  IF (SELECT address FROM public.events WHERE id = v_id) IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: anon can see a hidden address';
  END IF;
  IF public.public_event_location(v_id) IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: anon received the hidden address';
  END IF;
  IF public.event_password_ok(v_id, 'wrong') THEN
    RAISE EXCEPTION 'FAIL: anon passed the password check';
  END IF;
  IF NOT public.event_password_ok(v_id, 'secret-night') THEN
    RAISE EXCEPTION 'FAIL: the right password failed for anon';
  END IF;
  v_preview := public.public_event_guest_preview(v_id);
  IF v_preview::text LIKE '%@%' THEN
    RAISE EXCEPTION 'FAIL: guest preview leaked an email';
  END IF;
  BEGIN
    PERFORM 1 FROM public.event_secrets;
    RAISE EXCEPTION 'FAIL: anon can read event_secrets';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;
  RAISE NOTICE 'PASS: hidden address, password, and guest preview hold for anon';
END $$;

ROLLBACK;
