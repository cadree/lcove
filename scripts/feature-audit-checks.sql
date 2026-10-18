-- Scratch checks for the feature-audit migration.
-- Run only by scripts/feature-audit-check.sh. Never point this at a hosted database.

\set ON_ERROR_STOP on

\set tipper 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
\set host 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
\set viewer 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

INSERT INTO auth.users (id, email) VALUES
  (:'tipper', 'tipper@example.com'),
  (:'host', 'host@example.com'),
  (:'viewer', 'viewer@example.com');

-- New profiles get 100 genesis once, not 200.
DO $$
DECLARE
  v_balance numeric;
  v_genesis numeric;
  v_earned numeric;
  v_ledger numeric;
  v_match boolean;
BEGIN
  SELECT balance, genesis_balance, earned_balance
    INTO v_balance, v_genesis, v_earned
  FROM public.user_credits
  WHERE user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  SELECT COALESCE(SUM(genesis_delta + earned_delta), 0) INTO v_ledger
  FROM public.credit_ledger l
  CROSS JOIN LATERAL public.ledger_entry_deltas(
    l.credit_type, l.amount, l.genesis_amount, l.earned_amount
  ) d
  WHERE l.user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  IF v_balance IS DISTINCT FROM 100 OR v_genesis IS DISTINCT FROM 100 OR v_earned IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'FAIL: genesis grant stored balance=% genesis=% earned=%', v_balance, v_genesis, v_earned;
  END IF;
  IF v_ledger IS DISTINCT FROM 100 THEN
    RAISE EXCEPTION 'FAIL: ledger sum %', v_ledger;
  END IF;

  SELECT pools_match INTO v_match
  FROM public.user_credits_pool_check
  WHERE user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  IF v_match IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'FAIL: pool check';
  END IF;
  RAISE NOTICE 'PASS: genesis grant is 100 and matches the ledger';
END $$;

-- earned_amount 0 uses amount for an earned row.
INSERT INTO public.credit_ledger (
  user_id, amount, balance_after, type, description, credit_type, genesis_amount, earned_amount
) VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 25, 0, 'earn', 'zero earned_amount uses amount',
  'earned', 0, 0
);

-- genesis_amount 0 uses amount for a genesis spend.
INSERT INTO public.credit_ledger (
  user_id, amount, balance_after, type, description, credit_type, genesis_amount, earned_amount
) VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', -10, 0, 'spend', 'zero genesis_amount uses amount',
  'genesis', 0, 0
);

DO $$
DECLARE
  v_balance numeric;
  v_genesis numeric;
  v_earned numeric;
BEGIN
  SELECT balance, genesis_balance, earned_balance
    INTO v_balance, v_genesis, v_earned
  FROM public.user_credits
  WHERE user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  IF v_genesis IS DISTINCT FROM 90 OR v_earned IS DISTINCT FROM 25 OR v_balance IS DISTINCT FROM 115 THEN
    RAISE EXCEPTION 'FAIL: deltas genesis=% earned=% balance=%', v_genesis, v_earned, v_balance;
  END IF;
  RAISE NOTICE 'PASS: zero split columns use amount and balance equals the pools';
END $$;

-- Tip spends genesis first, sets credit_type, and is idempotent.
INSERT INTO public.live_streams (id, host_id, title, stream_type)
VALUES ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Set', 'webrtc');

SELECT public.apply_stream_tip(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  40,
  'nice',
  'tip-key-12345678'
);

SELECT public.apply_stream_tip(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  40,
  'nice',
  'tip-key-12345678'
);

DO $$
DECLARE
  v_genesis numeric;
  v_host_earned numeric;
  v_tips integer;
  v_type text;
BEGIN
  SELECT genesis_balance INTO v_genesis
  FROM public.user_credits
  WHERE user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  SELECT earned_balance INTO v_host_earned
  FROM public.user_credits
  WHERE user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  SELECT count(*) INTO v_tips FROM public.stream_tips
  WHERE idempotency_key = 'tip-key-12345678';
  SELECT credit_type INTO v_type FROM public.credit_ledger
  WHERE user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    AND reference_type = 'stream_tip'
  LIMIT 1;

  IF v_genesis IS DISTINCT FROM 50 THEN
    RAISE EXCEPTION 'FAIL: tipper genesis % (expected 50)', v_genesis;
  END IF;
  IF v_host_earned IS DISTINCT FROM 40 THEN
    RAISE EXCEPTION 'FAIL: host earned %', v_host_earned;
  END IF;
  IF v_tips IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'FAIL: tip rows %', v_tips;
  END IF;
  IF v_type IS DISTINCT FROM 'earned' THEN
    RAISE EXCEPTION 'FAIL: host credit_type %', v_type;
  END IF;
  RAISE NOTICE 'PASS: tip is genesis-first, typed, and idempotent';
END $$;

-- obs_rtmp is allowed and the key does not stay on the public row.
INSERT INTO public.live_streams (id, host_id, title, stream_type, rtmp_stream_key, rtmp_ingest_url)
VALUES (
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'OBS',
  'obs_rtmp',
  'secret-key',
  'rtmps://example/app'
);

DO $$
DECLARE
  v_public text;
  v_secret text;
BEGIN
  SELECT rtmp_stream_key INTO v_public
  FROM public.live_streams
  WHERE id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  SELECT rtmp_stream_key INTO v_secret
  FROM public.live_stream_secrets
  WHERE stream_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  IF v_public IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: public row still has a stream key';
  END IF;
  IF v_secret IS DISTINCT FROM 'secret-key' THEN
    RAISE EXCEPTION 'FAIL: secret table missing key';
  END IF;
  RAISE NOTICE 'PASS: obs_rtmp key is sealed';
END $$;

SELECT set_config('request.jwt.claim.sub', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SET ROLE authenticated;

DO $$
BEGIN
  BEGIN
    PERFORM rtmp_stream_key FROM public.live_stream_secrets
    WHERE stream_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    IF FOUND THEN
      RAISE EXCEPTION 'FAIL: other user read a stream key';
    END IF;
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  RAISE NOTICE 'PASS: other users cannot read stream keys';
END $$;

RESET ROLE;

-- Paid network hides the video URL. The owner can publish and can play.
INSERT INTO public.networks (id, owner_id, name, is_paid, is_public)
VALUES ('ffffffff-ffff-4fff-8fff-ffffffffffff', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Paid', true, true);

INSERT INTO public.network_content (
  id, network_id, creator_id, title, content_type, video_url, is_published
) VALUES (
  '12121212-1212-4121-8121-121212121212',
  'ffffffff-ffff-4fff-8fff-ffffffffffff',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Film',
  'short_film',
  'https://cdn.example/secret.mp4',
  false
);

SELECT set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SET ROLE authenticated;

UPDATE public.network_content
SET is_published = true
WHERE id = '12121212-1212-4121-8121-121212121212';

DO $$
DECLARE
  v_url text;
BEGIN
  SELECT video_url INTO v_url
  FROM public.cinema_playback('12121212-1212-4121-8121-121212121212', NULL);
  IF v_url IS DISTINCT FROM 'https://cdn.example/secret.mp4' THEN
    RAISE EXCEPTION 'FAIL: owner playback returned %', v_url;
  END IF;
  RAISE NOTICE 'PASS: network owner can publish and play';
END $$;

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SET ROLE authenticated;

DO $$
DECLARE
  v_url text;
BEGIN
  BEGIN
    PERFORM video_url FROM public.network_content
    WHERE id = '12121212-1212-4121-8121-121212121212';
    RAISE EXCEPTION 'FAIL: non-entitled user selected video_url';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  SELECT video_url INTO v_url
  FROM public.cinema_playback('12121212-1212-4121-8121-121212121212', NULL);
  IF v_url IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: playback leaked %', v_url;
  END IF;
  RAISE NOTICE 'PASS: paid video_url is not readable without a subscription';
END $$;

RESET ROLE;

-- Weekly recurrence is a stored token, not a second event row.
INSERT INTO public.events (
  creator_id, title, city, start_date, end_date, ticket_type, timezone, recurrence
) VALUES (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'Weekly',
  'Austin',
  now(),
  now() + interval '2 hours',
  'free',
  'America/Chicago',
  'FREQ=WEEKLY'
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.events WHERE title = 'Weekly' AND recurrence = 'FREQ=WEEKLY'
  ) THEN
    RAISE EXCEPTION 'FAIL: recurrence was not stored';
  END IF;
  RAISE NOTICE 'PASS: community event recurrence stored';
END $$;

-- Stream chat insert, and a block hides it from the other person.
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', false);
SET ROLE authenticated;

INSERT INTO public.stream_chat (stream_id, user_id, body)
VALUES (
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'hello'
);

RESET ROLE;

INSERT INTO public.user_blocks (blocker_id, blocked_id)
VALUES ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

SELECT set_config('request.jwt.claim.sub', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', false);
SET ROLE authenticated;

DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.stream_chat
  WHERE stream_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'FAIL: blocked viewer still sees chat (% rows)', v_count;
  END IF;
  RAISE NOTICE 'PASS: stream chat is block-aware';
END $$;

RESET ROLE;
