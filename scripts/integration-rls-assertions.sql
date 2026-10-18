-- Role checks for the integrated Ether migrations.
-- Run only by scripts/integration-rls-check.sh against a scratch database.
-- Assumes every file in supabase/migrations has already been applied.

\set ON_ERROR_STOP on

-- Fixed fixture identities. Not real people.
-- A passed the exam and hid their profile from people who have not.
-- B has not passed. Admin is a third account.

\set user_a '11111111-1111-4111-8111-111111111111'
\set user_b '22222222-2222-4222-8222-222222222222'
\set user_admin '33333333-3333-4333-8333-333333333333'

INSERT INTO auth.users (id, email) VALUES
  (:'user_a', 'a.passed@example.com'),
  (:'user_b', 'b.waiting@example.com'),
  (:'user_admin', 'admin@example.com');

UPDATE public.profiles
SET
  display_name = 'Member A',
  phone = '5550100001',
  onboarding_score = 25,
  onboarding_completed = true,
  show_only_to_passed_exam = true,
  access_status = 'active'
WHERE user_id = :'user_a';

UPDATE public.profiles
SET
  display_name = 'Member B',
  phone = '5550100002',
  onboarding_score = 5,
  onboarding_completed = true,
  show_only_to_passed_exam = false,
  access_status = 'active'
WHERE user_id = :'user_b';

UPDATE public.profiles
SET
  display_name = 'Admin',
  phone = '5550100003',
  onboarding_score = 25,
  onboarding_completed = true,
  access_status = 'active'
WHERE user_id = :'user_admin';

INSERT INTO public.user_roles (user_id, role)
VALUES (:'user_admin', 'admin');

INSERT INTO public.posts (id, user_id, content) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', :'user_a', 'post from A'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', :'user_b', 'post from B');

INSERT INTO public.post_comments (id, post_id, user_id, content) VALUES
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', :'user_a', 'comment from A'),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', :'user_b', 'comment from B');

INSERT INTO public.conversations (id, type, created_by)
VALUES ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'direct', :'user_a');

INSERT INTO public.conversation_participants (conversation_id, user_id) VALUES
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', :'user_a'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', :'user_b');

INSERT INTO public.messages (id, conversation_id, sender_id, content) VALUES
  ('f1111111-1111-4111-8111-111111111111', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', :'user_a', 'hello from A'),
  ('f2222222-2222-4222-8222-222222222222', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', :'user_b', 'hello from B');

INSERT INTO public.projects (id, creator_id, title)
VALUES ('abababab-abab-4aba-8aba-abababababab', :'user_a', 'Fixture project');

INSERT INTO public.payouts (id, user_id, amount)
VALUES ('01010101-0101-4101-8101-010101010101', :'user_a', 10);

INSERT INTO public.transactions (id, user_id, type, amount)
VALUES ('02020202-0202-4202-8202-020202020202', :'user_a', 'payout', 10);

INSERT INTO public.memberships (user_id, tier, status, monthly_amount)
VALUES (:'user_a', 'community', 'active', 5);

INSERT INTO public.membership_contributions (user_id, amount, period_start, period_end)
VALUES (:'user_a', 5, now() - interval '30 days', now());

INSERT INTO public.reputation_scores (user_id, overall_score)
VALUES (:'user_a', 4);

INSERT INTO public.escrow_holdings (project_id, payer_id, payee_id, amount)
VALUES ('abababab-abab-4aba-8aba-abababababab', :'user_a', :'user_b', 20);

INSERT INTO public.networks (id, owner_id, name)
VALUES ('03030303-0303-4303-8303-030303030303', :'user_a', 'Fixture network');

INSERT INTO public.network_subscriptions (network_id, user_id, status)
VALUES ('03030303-0303-4303-8303-030303030303', :'user_b', 'active');

INSERT INTO public.events (id, creator_id, title, city, start_date, ticket_type)
VALUES (
  '04040404-0404-4404-8404-040404040404',
  :'user_a',
  'Fixture event',
  'Austin',
  now() + interval '7 days',
  'credits'
);

INSERT INTO public.pipeline_stages (id, owner_user_id, name)
VALUES ('05050505-0505-4505-8505-050505050505', :'user_a', 'Inbox');

INSERT INTO public.pipeline_items (id, owner_user_id, stage_id, name)
VALUES (
  '06060606-0606-4606-8606-060606060606',
  :'user_a',
  '05050505-0505-4505-8505-050505050505',
  'Fixture client'
);

INSERT INTO public.contact_contracts (
  id, pipeline_item_id, owner_user_id, contract_number, title, status, signing_token
) VALUES (
  '07070707-0707-4707-8707-070707070707',
  '06060606-0606-4606-8606-060606060606',
  :'user_a',
  'C-1',
  'Fixture contract',
  'sent',
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
);

-- ---------------------------------------------------------------------------
-- Exam privacy
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  hidden text[];
BEGIN
  SELECT array_agg(column_name::text) INTO hidden
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'profiles_public'
    AND column_name IN ('phone', 'onboarding_score', 'passed_exam', 'show_only_to_passed_exam');
  IF hidden IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: profiles_public exposes %', hidden;
  END IF;
  RAISE NOTICE 'PASS: profiles_public has no phone, score, or exam flag';
END $$;

SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","email":"b.waiting@example.com"}', false);
SET ROLE authenticated;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.profiles_public
    WHERE user_id = '11111111-1111-4111-8111-111111111111'
  ) THEN
    RAISE EXCEPTION 'FAIL: B (not passed) can see private A in profiles_public';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = '11111111-1111-4111-8111-111111111111'
  ) THEN
    RAISE EXCEPTION 'FAIL: B can read A directly from profiles';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.profiles_public WHERE user_id = '22222222-2222-4222-8222-222222222222'
  ) THEN
    RAISE NOTICE 'PASS: B still sees their own public profile';
  ELSE
    RAISE EXCEPTION 'FAIL: B cannot see their own public profile';
  END IF;
  RAISE NOTICE 'PASS: B not-passed cannot see private A in profiles_public or profiles';
END $$;

RESET ROLE;

UPDATE public.profiles
SET onboarding_score = 25
WHERE user_id = '22222222-2222-4222-8222-222222222222';

SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","email":"b.waiting@example.com"}', false);
SET ROLE authenticated;

DO $$
DECLARE
  seen_name text;
BEGIN
  SELECT display_name INTO seen_name
  FROM public.profiles_public
  WHERE user_id = '11111111-1111-4111-8111-111111111111';
  IF seen_name IS DISTINCT FROM 'Member A' THEN
    RAISE EXCEPTION 'FAIL: B passed cannot see A in profiles_public (got %)', seen_name;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = '11111111-1111-4111-8111-111111111111'
  ) THEN
    RAISE EXCEPTION 'FAIL: B passed can read A on the base profiles table';
  END IF;
  RAISE NOTICE 'PASS: B passed can see A in profiles_public and not on profiles';
END $$;

RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","email":"a.passed@example.com"}', false);
SET ROLE authenticated;

DO $$
DECLARE
  own_phone text;
BEGIN
  SELECT phone INTO own_phone
  FROM public.profiles
  WHERE user_id = '11111111-1111-4111-8111-111111111111';
  IF own_phone IS DISTINCT FROM '5550100001' THEN
    RAISE EXCEPTION 'FAIL: A cannot read their own phone (got %)', own_phone;
  END IF;
  RAISE NOTICE 'PASS: A can read their own phone';
END $$;

RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '', false);
SELECT set_config('request.jwt.claim.role', 'anon', false);
SELECT set_config('request.jwt.claims', '{"role":"anon"}', false);
SET ROLE anon;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.profiles_public
    WHERE user_id = '11111111-1111-4111-8111-111111111111'
  ) THEN
    RAISE EXCEPTION 'FAIL: anon can see private A';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = '11111111-1111-4111-8111-111111111111'
  ) THEN
    RAISE EXCEPTION 'FAIL: anon can read A on profiles, including phone';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE phone IS NOT NULL) THEN
    RAISE EXCEPTION 'FAIL: anon can see a phone number on profiles';
  END IF;
  RAISE NOTICE 'PASS: anon cannot see private A or any phone';
END $$;

RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","email":"admin@example.com"}', false);
SET ROLE authenticated;

DO $$
DECLARE
  admin_phone text;
  public_name text;
BEGIN
  SELECT phone INTO admin_phone
  FROM public.profiles
  WHERE user_id = '11111111-1111-4111-8111-111111111111';
  IF admin_phone IS DISTINCT FROM '5550100001' THEN
    RAISE EXCEPTION 'FAIL: admin cannot read A phone on profiles (got %)', admin_phone;
  END IF;
  SELECT display_name INTO public_name
  FROM public.profiles_public
  WHERE user_id = '11111111-1111-4111-8111-111111111111';
  IF public_name IS DISTINCT FROM 'Member A' THEN
    RAISE EXCEPTION 'FAIL: admin cannot see private A in profiles_public';
  END IF;
  RAISE NOTICE 'PASS: admin can see A on profiles (including phone) and profiles_public';
END $$;

RESET ROLE;

-- ---------------------------------------------------------------------------
-- Blocks: A blocks B. The blocker stops seeing B. B cannot message or follow A.
-- ---------------------------------------------------------------------------

INSERT INTO public.user_blocks (blocker_id, blocked_id)
VALUES ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222');

SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","email":"a.passed@example.com"}', false);
SET ROLE authenticated;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.posts
    WHERE user_id = '22222222-2222-4222-8222-222222222222'
  ) THEN
    RAISE EXCEPTION 'FAIL: blocker A can still see B posts';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.post_comments
    WHERE user_id = '22222222-2222-4222-8222-222222222222'
  ) THEN
    RAISE EXCEPTION 'FAIL: blocker A can still see B comments';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.messages
    WHERE sender_id = '22222222-2222-4222-8222-222222222222'
  ) THEN
    RAISE EXCEPTION 'FAIL: blocker A can still see B messages';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.posts
    WHERE user_id = '11111111-1111-4111-8111-111111111111'
  ) THEN
    RAISE EXCEPTION 'FAIL: A cannot see their own post after blocking';
  END IF;

  INSERT INTO public.messages (conversation_id, sender_id, content)
  VALUES (
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    '11111111-1111-4111-8111-111111111111',
    'A can still write'
  );
  INSERT INTO public.favorite_friends (user_id, friend_user_id)
  VALUES (
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222'
  );
  RAISE NOTICE 'PASS: A hides B and can still message and follow B';
END $$;

RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","email":"b.waiting@example.com"}', false);
SET ROLE authenticated;

DO $$
BEGIN
  BEGIN
    INSERT INTO public.messages (conversation_id, sender_id, content)
    VALUES (
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      '22222222-2222-4222-8222-222222222222',
      'B should not send'
    );
    RAISE EXCEPTION 'FAIL: blocked B was allowed to message A';
  EXCEPTION
    WHEN insufficient_privilege OR raise_exception THEN
      IF SQLERRM ILIKE '%FAIL:%' THEN
        RAISE;
      END IF;
      RAISE NOTICE 'PASS: B cannot message A (%)', SQLERRM;
  END;

  BEGIN
    INSERT INTO public.favorite_friends (user_id, friend_user_id)
    VALUES (
      '22222222-2222-4222-8222-222222222222',
      '11111111-1111-4111-8111-111111111111'
    );
    RAISE EXCEPTION 'FAIL: blocked B was allowed to follow A';
  EXCEPTION
    WHEN insufficient_privilege OR raise_exception THEN
      IF SQLERRM ILIKE '%FAIL:%' THEN
        RAISE;
      END IF;
      RAISE NOTICE 'PASS: B cannot follow A (%)', SQLERRM;
  END;
END $$;

RESET ROLE;

-- ---------------------------------------------------------------------------
-- content_reports
-- ---------------------------------------------------------------------------

SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","email":"a.passed@example.com"}', false);
SET ROLE authenticated;

DO $$
DECLARE
  report_id uuid;
BEGIN
  INSERT INTO public.content_reports (target_type, target_id, reason, details)
  VALUES (
    'post',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'Spam',
    'fixture'
  )
  RETURNING id INTO report_id;

  IF NOT EXISTS (SELECT 1 FROM public.content_reports WHERE id = report_id AND reporter_id = '11111111-1111-4111-8111-111111111111' AND status = 'open') THEN
    RAISE EXCEPTION 'FAIL: reporter cannot read their own report';
  END IF;

  BEGIN
    INSERT INTO public.content_reports (target_type, target_id, reason)
    VALUES ('post', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Spam');
    RAISE EXCEPTION 'FAIL: duplicate open report was allowed';
  EXCEPTION
    WHEN unique_violation THEN
      RAISE NOTICE 'PASS: open report is unique per reporter and target';
  END;

  BEGIN
    UPDATE public.content_reports SET status = 'dismissed' WHERE id = report_id;
    IF EXISTS (SELECT 1 FROM public.content_reports WHERE id = report_id AND status = 'dismissed') THEN
      RAISE EXCEPTION 'FAIL: reporter updated report status';
    END IF;
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;
  IF EXISTS (SELECT 1 FROM public.content_reports WHERE id = report_id AND status <> 'open') THEN
    RAISE EXCEPTION 'FAIL: reporter changed report status';
  END IF;

  BEGIN
    DELETE FROM public.content_reports WHERE id = report_id;
    IF NOT EXISTS (SELECT 1 FROM public.content_reports WHERE id = report_id) THEN
      RAISE EXCEPTION 'FAIL: reporter deleted a report';
    END IF;
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;

  RAISE NOTICE 'PASS: reporter can insert and read own report, not update or delete';
END $$;

RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","email":"b.waiting@example.com"}', false);
SET ROLE authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.content_reports) THEN
    RAISE EXCEPTION 'FAIL: user B can read someone else''s report';
  END IF;
  RAISE NOTICE 'PASS: other authenticated user cannot read reports';
END $$;

RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '', false);
SELECT set_config('request.jwt.claim.role', 'anon', false);
SELECT set_config('request.jwt.claims', '{"role":"anon"}', false);
SET ROLE anon;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.content_reports) THEN
    RAISE EXCEPTION 'FAIL: anon read a content report';
  END IF;
  RAISE NOTICE 'PASS: anon cannot read content_reports';
  BEGIN
    INSERT INTO public.content_reports (target_type, target_id, reason)
    VALUES ('post', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Spam');
    RAISE EXCEPTION 'FAIL: anon inserted a report';
  EXCEPTION
    WHEN insufficient_privilege OR raise_exception THEN
      IF SQLERRM ILIKE '%FAIL:%' THEN
        RAISE;
      END IF;
      RAISE NOTICE 'PASS: anon cannot insert a report (%)', SQLERRM;
  END;
END $$;

RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","email":"admin@example.com"}', false);
SET ROLE authenticated;

DO $$
BEGIN
  UPDATE public.content_reports
  SET status = 'actioned'
  WHERE target_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  IF NOT EXISTS (
    SELECT 1 FROM public.content_reports
    WHERE target_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
      AND status = 'actioned'
  ) THEN
    RAISE EXCEPTION 'FAIL: admin could not mark the report actioned';
  END IF;
  RAISE NOTICE 'PASS: admin can read and update reports';
END $$;

RESET ROLE;

-- ---------------------------------------------------------------------------
-- nuance_interest
-- ---------------------------------------------------------------------------

SELECT set_config('request.jwt.claim.sub', '', false);
SELECT set_config('request.jwt.claim.role', 'anon', false);
SELECT set_config('request.jwt.claims', '{"role":"anon"}', false);
SET ROLE anon;

DO $$
BEGIN
  INSERT INTO public.nuance_interest (email, item)
  VALUES ('Guest.List@example.com', 'gold-legacy-necklace');
  BEGIN
    INSERT INTO public.nuance_interest (email, item)
    VALUES ('guest.list@example.com', 'gold-legacy-necklace');
    RAISE EXCEPTION 'FAIL: duplicate nuance interest was inserted';
  EXCEPTION
    WHEN unique_violation THEN
      RAISE NOTICE 'PASS: anon insert stored a lowercased email and unique (email, item) held';
  END;
  BEGIN
    PERFORM 1 FROM public.nuance_interest;
    RAISE EXCEPTION 'FAIL: anon read nuance_interest';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'PASS: anon cannot read nuance_interest';
  END;
END $$;

RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","email":"a.passed@example.com"}', false);
SET ROLE authenticated;

DO $$
BEGIN
  BEGIN
    INSERT INTO public.nuance_interest (email, item)
    VALUES ('someone-else@example.com', 'gold-legacy-necklace');
    RAISE EXCEPTION 'FAIL: member inserted an email that is not theirs';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'PASS: member cannot insert another email';
  END;
  INSERT INTO public.nuance_interest (email, item)
  VALUES ('A.Passed@example.com', 'gold-legacy-necklace');
  IF EXISTS (SELECT 1 FROM public.nuance_interest) THEN
    RAISE EXCEPTION 'FAIL: non-admin read nuance_interest';
  END IF;
  RAISE NOTICE 'PASS: member inserted their own email and cannot read the list';
END $$;

RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","email":"admin@example.com"}', false);
SET ROLE authenticated;

DO $$
DECLARE
  n int;
BEGIN
  SELECT count(*) INTO n FROM public.nuance_interest;
  IF n <> 2 THEN
    RAISE EXCEPTION 'FAIL: admin saw % nuance rows, expected 2', n;
  END IF;
  RAISE NOTICE 'PASS: admin can read nuance_interest (% rows)', n;
END $$;

RESET ROLE;

-- ---------------------------------------------------------------------------
-- Money tables: clients cannot write. service_role can.
-- ---------------------------------------------------------------------------

SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","email":"b.waiting@example.com"}', false);
SET ROLE authenticated;

DO $$
BEGIN
  BEGIN
    INSERT INTO public.payouts (user_id, amount)
    VALUES ('22222222-2222-4222-8222-222222222222', 9);
    RAISE EXCEPTION 'FAIL: authenticated inserted a payout';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: authenticated cannot insert payouts';
  END;
  BEGIN
    INSERT INTO public.transactions (user_id, type, amount)
    VALUES ('22222222-2222-4222-8222-222222222222', 'payout', 9);
    RAISE EXCEPTION 'FAIL: authenticated inserted a transaction';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: authenticated cannot insert transactions';
  END;
  BEGIN
    INSERT INTO public.memberships (user_id, tier)
    VALUES ('22222222-2222-4222-8222-222222222222', 'elite');
    RAISE EXCEPTION 'FAIL: authenticated inserted a membership';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: authenticated cannot insert memberships';
  END;
  BEGIN
    INSERT INTO public.membership_contributions (user_id, amount, period_start, period_end)
    VALUES ('22222222-2222-4222-8222-222222222222', 1, now(), now());
    RAISE EXCEPTION 'FAIL: authenticated inserted a contribution';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: authenticated cannot insert membership_contributions';
  END;
  BEGIN
    INSERT INTO public.reputation_scores (user_id, overall_score)
    VALUES ('22222222-2222-4222-8222-222222222222', 99);
    RAISE EXCEPTION 'FAIL: authenticated inserted a reputation score';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: authenticated cannot insert reputation_scores';
  END;
  BEGIN
    INSERT INTO public.escrow_holdings (project_id, payer_id, payee_id, amount)
    VALUES (
      'abababab-abab-4aba-8aba-abababababab',
      '22222222-2222-4222-8222-222222222222',
      '11111111-1111-4111-8111-111111111111',
      1
    );
    RAISE EXCEPTION 'FAIL: authenticated inserted escrow';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: authenticated cannot insert escrow_holdings';
  END;
  BEGIN
    INSERT INTO public.network_subscriptions (network_id, user_id)
    VALUES ('03030303-0303-4303-8303-030303030303', '11111111-1111-4111-8111-111111111111');
    RAISE EXCEPTION 'FAIL: authenticated inserted a network subscription';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: authenticated cannot insert network_subscriptions';
  END;

  UPDATE public.payouts SET amount = 999 WHERE user_id = '11111111-1111-4111-8111-111111111111';
  UPDATE public.transactions SET status = 'completed' WHERE user_id = '11111111-1111-4111-8111-111111111111';
  DELETE FROM public.payouts WHERE user_id = '11111111-1111-4111-8111-111111111111';
  RAISE NOTICE 'PASS: authenticated money updates and deletes did not raise';
END $$;

RESET ROLE;

DO $$
DECLARE
  payout_amount numeric;
  tx_status text;
BEGIN
  SELECT amount INTO payout_amount FROM public.payouts
  WHERE id = '01010101-0101-4101-8101-010101010101';
  SELECT status INTO tx_status FROM public.transactions
  WHERE id = '02020202-0202-4202-8202-020202020202';
  IF payout_amount IS DISTINCT FROM 10 OR tx_status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'FAIL: client money write stuck (payout %, tx %)', payout_amount, tx_status;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.payouts WHERE id = '01010101-0101-4101-8101-010101010101') THEN
    RAISE EXCEPTION 'FAIL: client deleted a payout';
  END IF;
  RAISE NOTICE 'PASS: client money writes did not change rows';
END $$;

SELECT set_config('request.jwt.claim.sub', '', false);
SELECT set_config('request.jwt.claim.role', 'anon', false);
SELECT set_config('request.jwt.claims', '{"role":"anon"}', false);
SET ROLE anon;

DO $$
BEGIN
  BEGIN
    INSERT INTO public.payouts (user_id, amount)
    VALUES ('22222222-2222-4222-8222-222222222222', 9);
    RAISE EXCEPTION 'FAIL: anon inserted a payout';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: anon cannot insert payouts';
  END;
  BEGIN
    INSERT INTO public.transactions (user_id, type, amount)
    VALUES ('22222222-2222-4222-8222-222222222222', 'refund', 1);
    RAISE EXCEPTION 'FAIL: anon inserted a transaction';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: anon cannot insert transactions';
  END;
END $$;

RESET ROLE;

SET ROLE service_role;

DO $$
BEGIN
  INSERT INTO public.payouts (user_id, amount)
  VALUES ('33333333-3333-4333-8333-333333333333', 4);
  RAISE NOTICE 'PASS: service_role can insert a payout';
END $$;

RESET ROLE;

-- Ticket fields stay server-owned.
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","email":"b.waiting@example.com"}', false);
SET ROLE authenticated;

DO $$
BEGIN
  BEGIN
    INSERT INTO public.event_rsvps (event_id, user_id, status, ticket_purchased)
    VALUES (
      '04040404-0404-4404-8404-040404040404',
      '22222222-2222-4222-8222-222222222222',
      'going',
      true
    );
    RAISE EXCEPTION 'FAIL: client inserted a purchased ticket';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT ILIKE '%ticket purchases are recorded by the server%' THEN
      RAISE;
    END IF;
    RAISE NOTICE 'PASS: client cannot insert ticket_purchased';
  END;
  INSERT INTO public.event_rsvps (event_id, user_id, status)
  VALUES (
    '04040404-0404-4404-8404-040404040404',
    '22222222-2222-4222-8222-222222222222',
    'going'
  );
  BEGIN
    UPDATE public.event_rsvps
    SET ticket_purchased = true, credits_spent = 5
    WHERE user_id = '22222222-2222-4222-8222-222222222222';
    RAISE EXCEPTION 'FAIL: client updated ticket fields';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT ILIKE '%ticket purchases are recorded by the server%' THEN
      RAISE;
    END IF;
  END;
  UPDATE public.event_rsvps
  SET status = 'interested'
  WHERE user_id = '22222222-2222-4222-8222-222222222222';
  RAISE NOTICE 'PASS: client can change RSVP status and not ticket fields';
END $$;

RESET ROLE;

SET ROLE service_role;

UPDATE public.event_rsvps
SET ticket_purchased = true, credits_spent = 5
WHERE user_id = '22222222-2222-4222-8222-222222222222';

RESET ROLE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.event_rsvps
    WHERE user_id = '22222222-2222-4222-8222-222222222222'
      AND ticket_purchased = true
      AND credits_spent = 5
      AND status = 'interested'
  ) THEN
    RAISE EXCEPTION 'FAIL: service_role ticket update did not stick';
  END IF;
  RAISE NOTICE 'PASS: service_role can set ticket_purchased and credits_spent';
END $$;

-- Non-admin ledger insert denied. Admin insert cannot force server_issued.
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","email":"b.waiting@example.com"}', false);
SET ROLE authenticated;

DO $$
BEGIN
  BEGIN
    INSERT INTO public.credit_ledger (user_id, amount, balance_after, type, description, server_issued)
    VALUES ('22222222-2222-4222-8222-222222222222', 10, 10, 'earn', 'self award', true);
    RAISE EXCEPTION 'FAIL: non-admin inserted credit_ledger';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: non-admin cannot insert credit_ledger';
  END;
END $$;

RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","email":"admin@example.com"}', false);
SET ROLE authenticated;

DO $$
BEGIN
  INSERT INTO public.credit_ledger (user_id, amount, balance_after, type, description, server_issued)
  VALUES ('33333333-3333-4333-8333-333333333333', 3, 3, 'earn', 'admin award', true);
  RAISE NOTICE 'PASS: admin credit_ledger insert attempted';
END $$;

RESET ROLE;

DO $$
DECLARE
  issued boolean;
BEGIN
  SELECT server_issued INTO issued
  FROM public.credit_ledger
  WHERE description = 'admin award';
  IF issued IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'FAIL: admin insert stored server_issued=%', issued;
  END IF;
  RAISE NOTICE 'PASS: admin insert cannot force server_issued';
END $$;

SET ROLE service_role;

INSERT INTO public.credit_ledger (user_id, amount, balance_after, type, description, credit_type, server_issued)
VALUES (
  '11111111-1111-4111-8111-111111111111',
  7, 7, 'earn', 'server sale', 'earned', false
);

RESET ROLE;

DO $$
DECLARE
  issued boolean;
BEGIN
  SELECT server_issued INTO issued
  FROM public.credit_ledger
  WHERE description = 'server sale';
  IF issued IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'FAIL: service_role insert stored server_issued=%', issued;
  END IF;
  RAISE NOTICE 'PASS: service_role insert is server_issued';
END $$;

-- ---------------------------------------------------------------------------
-- Contracts: token or owner. Signers cannot change the title.
-- ---------------------------------------------------------------------------

SELECT set_config('request.headers', '', false);
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT set_config('request.jwt.claim.role', 'anon', false);
SELECT set_config('request.jwt.claims', '{"role":"anon"}', false);
SET ROLE anon;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.contact_contracts) THEN
    RAISE EXCEPTION 'FAIL: anon saw a contract without a token';
  END IF;
  RAISE NOTICE 'PASS: anon without a token cannot see contracts';
END $$;

RESET ROLE;

SELECT set_config(
  'request.headers',
  '{"x-signing-token":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}',
  false
);
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT set_config('request.jwt.claim.role', 'anon', false);
SELECT set_config('request.jwt.claims', '{"role":"anon"}', false);
SET ROLE anon;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.contact_contracts
    WHERE id = '07070707-0707-4707-8707-070707070707'
  ) THEN
    RAISE EXCEPTION 'FAIL: matching token did not reveal the contract';
  END IF;
  UPDATE public.contact_contracts
  SET
    client_signature_url = 'https://example.test/sig.png',
    client_signed_at = now(),
    status = 'signed'
  WHERE id = '07070707-0707-4707-8707-070707070707';
  BEGIN
    UPDATE public.contact_contracts
    SET title = 'changed by signer'
    WHERE id = '07070707-0707-4707-8707-070707070707';
    RAISE EXCEPTION 'FAIL: signer changed the contract title';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT ILIKE '%signature fields%' THEN
      RAISE;
    END IF;
    RAISE NOTICE 'PASS: token can sign and cannot change the title';
  END;
END $$;

RESET ROLE;

SELECT set_config('request.headers', '', false);
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","email":"a.passed@example.com"}', false);
SET ROLE authenticated;

DO $$
BEGIN
  UPDATE public.contact_contracts
  SET title = 'owner retitle'
  WHERE id = '07070707-0707-4707-8707-070707070707';
  IF NOT EXISTS (
    SELECT 1 FROM public.contact_contracts
    WHERE id = '07070707-0707-4707-8707-070707070707'
      AND title = 'owner retitle'
  ) THEN
    RAISE EXCEPTION 'FAIL: owner could not retitle the contract';
  END IF;
  RAISE NOTICE 'PASS: owner can update the title without a token';
END $$;

RESET ROLE;

-- ---------------------------------------------------------------------------
-- store_secrets
-- ---------------------------------------------------------------------------

SELECT set_config('request.jwt.claim.sub', '', false);
SELECT set_config('request.jwt.claim.role', 'anon', false);
SELECT set_config('request.jwt.claims', '{"role":"anon"}', false);
SET ROLE anon;

DO $$
BEGIN
  BEGIN
    PERFORM 1 FROM public.store_secrets;
    RAISE EXCEPTION 'FAIL: anon read store_secrets';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: anon cannot read store_secrets';
  END;
END $$;

RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","email":"b.waiting@example.com"}', false);
SET ROLE authenticated;

DO $$
BEGIN
  BEGIN
    INSERT INTO public.store_secrets (store_id, shopify_access_token)
    VALUES ('08080808-0808-4808-8808-080808080808', 'should-not-land');
    RAISE EXCEPTION 'FAIL: authenticated inserted store_secrets';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: authenticated cannot write store_secrets';
  END;
  BEGIN
    PERFORM 1 FROM public.store_secrets;
    RAISE EXCEPTION 'FAIL: authenticated read store_secrets';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: authenticated cannot read store_secrets';
  END;
END $$;

RESET ROLE;

-- ---------------------------------------------------------------------------
-- Storage folder rule
-- ---------------------------------------------------------------------------

SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","email":"a.passed@example.com"}', false);
SET ROLE authenticated;

DO $$
BEGIN
  INSERT INTO storage.objects (bucket_id, name)
  VALUES ('media', '11111111-1111-4111-8111-111111111111/cover.png');
  INSERT INTO storage.objects (bucket_id, name)
  VALUES ('board-uploads', '11111111-1111-4111-8111-111111111111/board.png');
  BEGIN
    INSERT INTO storage.objects (bucket_id, name)
    VALUES ('media', '22222222-2222-4222-8222-222222222222/stolen.png');
    RAISE EXCEPTION 'FAIL: upload into another user folder was allowed';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: media upload must start with the caller id';
  END;
  BEGIN
    INSERT INTO storage.objects (bucket_id, name)
    VALUES ('board-uploads', 'collectives/nope.png');
    RAISE EXCEPTION 'FAIL: board upload outside the caller folder was allowed';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: board upload must start with the caller id';
  END;
  UPDATE storage.objects
  SET metadata = '{"ok":true}'::jsonb
  WHERE bucket_id = 'media'
    AND name = '11111111-1111-4111-8111-111111111111/cover.png';
  DELETE FROM storage.objects
  WHERE bucket_id = 'board-uploads'
    AND name = '11111111-1111-4111-8111-111111111111/board.png';
  RAISE NOTICE 'PASS: owner can update own media and delete own board upload';
END $$;

RESET ROLE;

INSERT INTO storage.objects (bucket_id, name)
VALUES ('board-uploads', '22222222-2222-4222-8222-222222222222/keep.png');

SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","email":"a.passed@example.com"}', false);
SET ROLE authenticated;

DELETE FROM storage.objects
WHERE name = '22222222-2222-4222-8222-222222222222/keep.png';

RESET ROLE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.objects
    WHERE name = '22222222-2222-4222-8222-222222222222/keep.png'
  ) THEN
    RAISE EXCEPTION 'FAIL: A deleted B board upload';
  END IF;
  IF EXISTS (
    SELECT 1 FROM storage.objects
    WHERE name = '11111111-1111-4111-8111-111111111111/board.png'
  ) THEN
    RAISE EXCEPTION 'FAIL: A own board upload was not deleted';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM storage.objects
    WHERE name = '11111111-1111-4111-8111-111111111111/cover.png'
      AND metadata = '{"ok":true}'::jsonb
  ) THEN
    RAISE EXCEPTION 'FAIL: A media update did not stick';
  END IF;
  RAISE NOTICE 'PASS: storage folder rule held for update and delete';
END $$;

SELECT set_config('request.jwt.claim.sub', '', false);
SELECT set_config('request.jwt.claim.role', 'anon', false);
SELECT set_config('request.jwt.claims', '{"role":"anon"}', false);
SET ROLE anon;

DO $$
BEGIN
  BEGIN
    INSERT INTO storage.objects (bucket_id, name)
    VALUES ('media', 'anon/nope.png');
    RAISE EXCEPTION 'FAIL: anon uploaded media';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: anon cannot upload media';
  END;
END $$;

RESET ROLE;

