-- Prove gift-notice grants, the block filter, and the live delete guard
-- as anon and authenticated. Run it with psql against ether-staging after
-- 20261023190000 is applied. The whole script rolls back. It does not keep
-- rows. Refuse ether-prod before connecting; this file cannot see the URI.
--
--   psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f scripts/gift-notice-privilege-check.sql

\if :{?staging_project_ref}
\else
\echo 'staging_project_ref is required'
\quit 1
\endif

SELECT set_config('ether.staging_ref', :'staging_project_ref', false);

DO $guard$
BEGIN
  IF current_setting('ether.staging_ref') IS DISTINCT FROM 'vjdrihmriufkameqngfg' THEN
    RAISE EXCEPTION 'refusing privilege check: staging ref was %', current_setting('ether.staging_ref');
  END IF;
END
$guard$;

BEGIN;

INSERT INTO public.live_streams (id, host_id, title, description, stream_type, is_live, started_at, ended_at)
VALUES
  ('01999999-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Privilege check live', 'Staging privilege check', 'webrtc', true, now(), NULL),
  ('01999999-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'Privilege check ended', 'Staging privilege check', 'webrtc', false, now() - interval '1 hour', now());

INSERT INTO public.stream_gifts (id, stream_id, sender_id, host_id, gift, amount_cents, platform_fee_cents)
VALUES (
  '01999999-0000-4000-8000-000000000003',
  '01999999-0000-4000-8000-000000000002',
  '11111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111',
  'rose',
  100,
  0
);

INSERT INTO public.user_blocks (blocker_id, blocked_id)
VALUES ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111');

CREATE TEMP TABLE privilege_result (
  role_name text PRIMARY KEY,
  can_select boolean NOT NULL,
  can_insert boolean NOT NULL,
  can_update boolean NOT NULL,
  can_delete boolean NOT NULL,
  can_truncate boolean NOT NULL,
  can_references boolean NOT NULL,
  can_trigger boolean NOT NULL
);

DO $priv$
DECLARE
  role_name text;
  privs text[] := ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'];
  flags boolean[];
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    EXECUTE format('SET LOCAL ROLE %I', role_name);
    flags := ARRAY[]::boolean[];
    FOR i IN 1..array_length(privs, 1) LOOP
      flags := flags || has_table_privilege(current_user, 'public.stream_gift_notices', privs[i]);
    END LOOP;
    RESET ROLE;
    INSERT INTO privilege_result VALUES (role_name, flags[1], flags[2], flags[3], flags[4], flags[5], flags[6], flags[7]);
  END LOOP;
END
$priv$;

DO $expect$
DECLARE
  row privilege_result%ROWTYPE;
BEGIN
  FOR row IN SELECT * FROM privilege_result ORDER BY role_name LOOP
    IF NOT row.can_select
      OR row.can_insert OR row.can_update OR row.can_delete
      OR row.can_truncate OR row.can_references OR row.can_trigger THEN
      RAISE EXCEPTION 'FAIL % privileges select=% insert=% update=% delete=% truncate=% references=% trigger=%',
        row.role_name, row.can_select, row.can_insert, row.can_update, row.can_delete,
        row.can_truncate, row.can_references, row.can_trigger;
    END IF;
    RAISE NOTICE 'PASS % holds SELECT only', row.role_name;
  END LOOP;
END
$expect$;

DO $write$
DECLARE
  role_name text;
  verb text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    EXECUTE format('SET LOCAL ROLE %I', role_name);
    FOREACH verb IN ARRAY ARRAY['insert', 'update', 'delete'] LOOP
      BEGIN
        IF verb = 'insert' THEN
          INSERT INTO public.stream_gift_notices (id, stream_id, gift, created_at, sender_name)
          VALUES ('01999999-0000-4000-8000-000000000099', '01999999-0000-4000-8000-000000000002', 'rose', now(), 'Nope');
        ELSIF verb = 'update' THEN
          UPDATE public.stream_gift_notices SET gift = 'star' WHERE id = '01999999-0000-4000-8000-000000000003';
        ELSE
          DELETE FROM public.stream_gift_notices WHERE id = '01999999-0000-4000-8000-000000000003';
        END IF;
        RAISE EXCEPTION 'FAIL % % was allowed', role_name, verb;
      EXCEPTION
        WHEN insufficient_privilege THEN
          RAISE NOTICE 'PASS % % denied', role_name, verb;
        WHEN OTHERS THEN
          IF SQLSTATE = '42501' THEN
            RAISE NOTICE 'PASS % % denied', role_name, verb;
          ELSE
            RAISE;
          END IF;
      END;
    END LOOP;
    RESET ROLE;
  END LOOP;
END
$write$;

SET LOCAL ROLE anon;
DO $read_anon$
DECLARE
  seen integer;
BEGIN
  SELECT count(*) INTO seen FROM public.stream_gift_notices
  WHERE id = '01999999-0000-4000-8000-000000000003';
  IF seen <> 1 THEN
    RAISE EXCEPTION 'FAIL anon should see the notice, saw %', seen;
  END IF;
  RAISE NOTICE 'PASS anon can select the notice';
END
$read_anon$;
RESET ROLE;

-- Nico blocked Ada. Nico must not see Ada's notice. A stranger must.
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
SELECT set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $blocked$
DECLARE
  seen integer;
BEGIN
  IF auth.uid() IS DISTINCT FROM '22222222-2222-4222-8222-222222222222'::uuid THEN
    RAISE EXCEPTION 'FAIL authenticated uid is %', auth.uid();
  END IF;
  SELECT count(*) INTO seen FROM public.stream_gift_notices
  WHERE id = '01999999-0000-4000-8000-000000000003';
  IF seen <> 0 THEN
    RAISE EXCEPTION 'FAIL blocked viewer still sees the notice';
  END IF;
  RAISE NOTICE 'PASS blocked viewer does not see the notice';
END
$blocked$;
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
SELECT set_config('request.jwt.claims', '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $open$
DECLARE
  seen integer;
BEGIN
  SELECT count(*) INTO seen FROM public.stream_gift_notices
  WHERE id = '01999999-0000-4000-8000-000000000003';
  IF seen <> 1 THEN
    RAISE EXCEPTION 'FAIL unblocked viewer should see the notice, saw %', seen;
  END IF;
  RAISE NOTICE 'PASS unblocked viewer sees the notice';
END
$open$;
RESET ROLE;

-- Ada hosts both rows. A direct DELETE must leave the live row in place.
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
SELECT set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DELETE FROM public.live_streams WHERE id = '01999999-0000-4000-8000-000000000001';
DO $direct$
DECLARE
  still_there boolean;
BEGIN
  RESET ROLE;
  SELECT EXISTS (
    SELECT 1 FROM public.live_streams WHERE id = '01999999-0000-4000-8000-000000000001' AND is_live IS TRUE
  ) INTO still_there;
  IF NOT still_there THEN
    RAISE EXCEPTION 'FAIL direct delete removed the live row';
  END IF;
  RAISE NOTICE 'PASS direct delete left the live row';
END
$direct$;

SET LOCAL ROLE authenticated;
DO $rpc_live$
BEGIN
  PERFORM public.delete_own_live_stream('01999999-0000-4000-8000-000000000001');
  RAISE EXCEPTION 'FAIL delete_own_live_stream allowed a live row';
EXCEPTION
  WHEN insufficient_privilege THEN
    IF SQLERRM ILIKE '%End the live stream before deleting it%' THEN
      RAISE NOTICE 'PASS delete_own_live_stream refused the live row';
    ELSE
      RAISE;
    END IF;
END
$rpc_live$;

DO $rpc_ended$
BEGIN
  PERFORM public.delete_own_live_stream('01999999-0000-4000-8000-000000000002');
  RAISE NOTICE 'PASS delete_own_live_stream removed the ended row';
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'FAIL delete_own_live_stream on ended row: %', SQLERRM;
END
$rpc_ended$;
RESET ROLE;

DO $after$
BEGIN
  IF EXISTS (SELECT 1 FROM public.live_streams WHERE id = '01999999-0000-4000-8000-000000000002') THEN
    RAISE EXCEPTION 'FAIL ended row is still present';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.live_streams WHERE id = '01999999-0000-4000-8000-000000000001' AND is_live IS TRUE) THEN
    RAISE EXCEPTION 'FAIL live row is gone';
  END IF;
  RAISE NOTICE 'PASS live row remains and ended row is gone';
END
$after$;

ROLLBACK;
