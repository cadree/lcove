-- Door check-in against a scratch database. Run only by
-- scripts/check-in-attendee-check.sh. Never point this at a hosted database.

\set ON_ERROR_STOP on

INSERT INTO auth.users (id, email) VALUES
  ('11111111-1111-4111-8111-111111111111', 'host@example.com'),
  ('22222222-2222-4222-8222-222222222222', 'cohost@example.com'),
  ('33333333-3333-4333-8333-333333333333', 'stranger@example.com'),
  ('44444444-4444-4444-8444-444444444444', 'guest@example.com'),
  ('55555555-5555-4555-8555-555555555555', 'other-org@example.com');

INSERT INTO public.organizations (id, name, owner_id) VALUES
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Host org', '11111111-1111-4111-8111-111111111111'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Other org', '55555555-5555-4555-8555-555555555555');

INSERT INTO public.organization_members (organization_id, user_id, role) VALUES
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222', 'admin');

INSERT INTO public.events (id, creator_id, organization_id, title, city, start_date, ticket_type, is_public, capacity)
VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'Night Market',
  'Los Angeles',
  now() + interval '2 days',
  'free',
  true,
  4
);

INSERT INTO public.event_attendees (
  id, event_id, attendee_user_id, attendee_name, status, qr_code, ticket_number
) VALUES
  (
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '44444444-4444-4444-8444-444444444444',
    'Maya Torres',
    'registered',
    'qr-registered',
    'T-REGISTERED'
  ),
  (
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    NULL,
    'Approved Guest',
    'approved',
    'qr-approved',
    'T-APPROVED'
  ),
  (
    'ffffffff-ffff-4fff-8fff-ffffffffffff',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    NULL,
    'Cancelled Guest',
    'cancelled',
    'qr-cancelled',
    'T-CANCELLED'
  ),
  (
    '12121212-1212-4121-8121-121212121212',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    NULL,
    'Refunded Guest',
    'refunded',
    'qr-refunded',
    'T-REFUNDED'
  );

DO $$
DECLARE
  v_result jsonb;
  v_status text;
  v_seats integer;
  v_rows integer;
  v_path text;
BEGIN
  SELECT split_part(cfg, '=', 2) INTO v_path
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  CROSS JOIN LATERAL unnest(p.proconfig) AS cfg
  WHERE n.nspname = 'public'
    AND p.proname = 'check_in_attendee'
    AND cfg LIKE 'search_path=%';
  IF v_path IS NULL OR position('public' IN v_path) = 0 OR position('extensions' IN v_path) = 0 THEN
    RAISE EXCEPTION 'FAIL: check_in_attendee search_path is %', v_path;
  END IF;
  IF split_part(v_path, ',', 1) <> 'public' THEN
    RAISE EXCEPTION 'FAIL: public is not first in search_path %', v_path;
  END IF;

  v_seats := public.event_seat_count('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  IF v_seats IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'FAIL: expected 2 seats before check-in, got %', v_seats;
  END IF;

  PERFORM set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  v_result := public.check_in_attendee('qr-registered', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'qr', NULL);
  IF v_result->>'error' IS DISTINCT FROM 'not_authorized' OR (v_result->>'success')::boolean IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'FAIL: stranger check-in %', v_result;
  END IF;

  PERFORM set_config('request.jwt.claim.sub', '55555555-5555-4555-8555-555555555555', true);
  v_result := public.check_in_attendee('qr-registered', NULL, 'qr', NULL);
  IF v_result->>'error' IS DISTINCT FROM 'not_authorized' THEN
    RAISE EXCEPTION 'FAIL: other-org member check-in %', v_result;
  END IF;

  PERFORM set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', true);
  v_result := public.check_in_attendee('qr-registered', NULL, 'qr', NULL);
  IF v_result->>'error' IS DISTINCT FROM 'not_authorized' THEN
    RAISE EXCEPTION 'FAIL: ticket holder check-in %', v_result;
  END IF;
  EXECUTE 'RESET ROLE';

  PERFORM set_config('request.jwt.claim.sub', '', true);
  v_result := public.check_in_attendee('qr-registered', NULL, 'qr', NULL);
  IF v_result->>'error' IS DISTINCT FROM 'not_authenticated' THEN
    RAISE EXCEPTION 'FAIL: signed-out check-in %', v_result;
  END IF;

  PERFORM set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  v_result := public.check_in_attendee('qr-cancelled', NULL, 'qr', NULL);
  IF v_result->>'error' IS DISTINCT FROM 'attendee_not_active' OR v_result->>'attendee_status' IS DISTINCT FROM 'cancelled' THEN
    RAISE EXCEPTION 'FAIL: cancelled ticket %', v_result;
  END IF;
  v_result := public.check_in_attendee('qr-refunded', NULL, 'qr', NULL);
  IF v_result->>'error' IS DISTINCT FROM 'attendee_not_active' OR v_result->>'attendee_status' IS DISTINCT FROM 'refunded' THEN
    RAISE EXCEPTION 'FAIL: refunded ticket %', v_result;
  END IF;

  v_result := public.check_in_attendee('qr-registered', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'qr', NULL);
  IF (v_result->>'success')::boolean IS DISTINCT FROM true OR v_result->>'check_in_id' IS NULL THEN
    RAISE EXCEPTION 'FAIL: host check-in of registered ticket %', v_result;
  END IF;
  IF v_result #>> '{attendee,name}' IS DISTINCT FROM 'Maya Torres' THEN
    RAISE EXCEPTION 'FAIL: host check-in attendee %', v_result;
  END IF;

  SELECT status INTO v_status
  FROM public.event_attendees
  WHERE qr_code = 'qr-registered';
  IF v_status IS DISTINCT FROM 'checked_in' THEN
    RAISE EXCEPTION 'FAIL: registered ticket status is %', v_status;
  END IF;

  v_result := public.check_in_attendee('qr-registered', NULL, 'qr', NULL);
  IF v_result->>'error' IS DISTINCT FROM 'already_checked_in' OR (v_result->>'success')::boolean IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'FAIL: second scan %', v_result;
  END IF;
  IF v_result->>'checked_in_at' IS NULL THEN
    RAISE EXCEPTION 'FAIL: second scan missing checked_in_at %', v_result;
  END IF;

  SELECT count(*) INTO v_rows FROM public.event_check_ins WHERE attendee_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  IF v_rows IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'FAIL: expected one check-in row, got %', v_rows;
  END IF;
  EXECUTE 'RESET ROLE';

  PERFORM set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  v_result := public.check_in_attendee('qr-registered', NULL, 'qr', NULL);
  IF v_result->>'error' IS DISTINCT FROM 'already_checked_in' THEN
    RAISE EXCEPTION 'FAIL: co-host second scan %', v_result;
  END IF;
  v_result := public.check_in_attendee('qr-approved', NULL, 'manual', NULL);
  IF (v_result->>'success')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'FAIL: co-host check-in of approved ticket %', v_result;
  END IF;
  SELECT status INTO v_status FROM public.event_attendees WHERE qr_code = 'qr-approved';
  IF v_status IS DISTINCT FROM 'checked_in' THEN
    RAISE EXCEPTION 'FAIL: approved ticket status is %', v_status;
  END IF;
  EXECUTE 'RESET ROLE';

  v_seats := public.event_seat_count('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  IF v_seats IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'FAIL: check-in freed a seat, count is %', v_seats;
  END IF;

  SELECT status INTO v_status FROM public.event_attendees WHERE qr_code = 'qr-cancelled';
  IF v_status IS DISTINCT FROM 'cancelled' THEN
    RAISE EXCEPTION 'FAIL: cancelled status changed to %', v_status;
  END IF;
  SELECT status INTO v_status FROM public.event_attendees WHERE qr_code = 'qr-refunded';
  IF v_status IS DISTINCT FROM 'refunded' THEN
    RAISE EXCEPTION 'FAIL: refunded status changed to %', v_status;
  END IF;

  RAISE NOTICE 'PASS: host and co-host can check in a real ticket; repeats, cancelled, and refunded are rejected';
END $$;
