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
  BEGIN
    PERFORM 1 FROM public.profiles_public LIMIT 1;
    RAISE EXCEPTION 'FAIL: anon can read profiles_public';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: anon cannot read profiles_public';
  END;
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

  BEGIN
    INSERT INTO public.messages (conversation_id, sender_id, content)
    VALUES (
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      '11111111-1111-4111-8111-111111111111',
      'A should not write'
    );
    RAISE EXCEPTION 'FAIL: blocker A was allowed to message B';
  EXCEPTION
    WHEN insufficient_privilege OR raise_exception THEN
      IF SQLERRM ILIKE '%FAIL:%' THEN
        RAISE;
      END IF;
      RAISE NOTICE 'PASS: blocker A cannot message B (%)', SQLERRM;
  END;
  INSERT INTO public.favorite_friends (user_id, friend_user_id)
  VALUES (
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222'
  );
  RAISE NOTICE 'PASS: A hides B, cannot message B, and can still follow B';
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

-- ---------------------------------------------------------------------------
-- Hosted-style default EXECUTE grants must not survive the lock migration.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  fn regprocedure;
  internal text[] := ARRAY[
    'enqueue_email(text,jsonb)',
    'read_email_batch(text,integer,integer)',
    'delete_email(text,bigint)',
    'move_to_dlq(text,text,bigint,jsonb)',
    'purge_user_personal_data(uuid)',
    'apply_stream_tip(uuid,uuid,integer,text,text)',
    'confirm_store_card_order(uuid,text)',
    'award_xp(uuid,text,uuid,integer)',
    'xp_on_post()',
    'prevent_blocked_message()',
    'validate_profile_completion()'
  ];
  sig text;
BEGIN
  FOREACH sig IN ARRAY internal LOOP
    fn := sig::regprocedure;
    IF has_function_privilege('anon', fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'FAIL: anon can execute %', sig;
    END IF;
    IF has_function_privilege('authenticated', fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'FAIL: authenticated can execute %', sig;
    END IF;
    IF NOT has_function_privilege('service_role', fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'FAIL: service_role cannot execute %', sig;
    END IF;
  END LOOP;

  IF NOT has_function_privilege('anon', 'public.get_platform_stats()'::regprocedure, 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: anon cannot execute get_platform_stats';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.touch_last_active()'::regprocedure, 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: authenticated cannot execute touch_last_active';
  END IF;
  IF has_function_privilege('anon', 'public.touch_last_active()'::regprocedure, 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: anon can execute touch_last_active';
  END IF;
  IF NOT has_function_privilege('anon', 'public.has_blocked(uuid,uuid)'::regprocedure, 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: anon cannot execute has_blocked';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.sender_blocked_in_conversation(uuid,uuid)'::regprocedure, 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: authenticated cannot execute sender_blocked_in_conversation';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'enqueue_email',
        'read_email_batch',
        'delete_email',
        'move_to_dlq',
        'ledger_entry_deltas',
        'request_header',
        'xp_level'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) cfg
        WHERE cfg LIKE 'search_path=%'
      )
  ) THEN
    RAISE EXCEPTION 'FAIL: a reported function still has no search_path';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND NOT EXISTS (
        SELECT 1
        FROM pg_depend d
        WHERE d.classid = 'pg_proc'::regclass
          AND d.objid = p.oid
          AND d.deptype = 'e'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) cfg
        WHERE cfg LIKE 'search_path=%'
      )
  ) THEN
    RAISE EXCEPTION 'FAIL: a public function still has no search_path: %', (
      SELECT string_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', ', ')
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND NOT EXISTS (
          SELECT 1
          FROM pg_depend d
          WHERE d.classid = 'pg_proc'::regclass
            AND d.objid = p.oid
            AND d.deptype = 'e'
        )
        AND NOT EXISTS (
          SELECT 1
          FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) cfg
          WHERE cfg LIKE 'search_path=%'
        )
    );
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

  RAISE NOTICE 'PASS: internal functions are service_role only and user functions stay callable';
END $$;

CREATE FUNCTION public.ether_default_priv_probe()
RETURNS integer
LANGUAGE sql
AS $$ SELECT 1 $$;

DO $$
BEGIN
  IF has_function_privilege('anon', 'public.ether_default_priv_probe()'::regprocedure, 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.ether_default_priv_probe()'::regprocedure, 'EXECUTE')
     OR has_function_privilege('public', 'public.ether_default_priv_probe()'::regprocedure, 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: a new public function was granted to anon, authenticated, or PUBLIC';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.ether_default_priv_probe()'::regprocedure, 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: a new public function was not granted to service_role';
  END IF;
  RAISE NOTICE 'PASS: future functions are not granted to anon or authenticated';
END $$;

DROP FUNCTION public.ether_default_priv_probe();

DO $$
BEGIN
  IF NOT (
    SELECT c.relrowsecurity
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'ether_schema_migrations'
  ) THEN
    RAISE EXCEPTION 'FAIL: ether_schema_migrations RLS is off';
  END IF;
  IF has_table_privilege('anon', 'public.ether_schema_migrations', 'SELECT')
     OR has_table_privilege('authenticated', 'public.ether_schema_migrations', 'SELECT') THEN
    RAISE EXCEPTION 'FAIL: ether_schema_migrations is readable by anon or authenticated';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'profiles'
  ) THEN
    RAISE EXCEPTION 'FAIL: profiles is still in supabase_realtime';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'avatars' AND public = false
  ) THEN
    RAISE EXCEPTION 'FAIL: private avatars bucket is missing';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'public.ai_project_matches'::regclass
      AND polcmd = 'a'
      AND pg_get_expr(polwithcheck, polrelid) = 'true'
  ) OR EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'public.contact_timeline'::regclass
      AND polcmd = 'a'
      AND pg_get_expr(polwithcheck, polrelid) = 'true'
  ) OR EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'public.notifications'::regclass
      AND polcmd = 'a'
      AND pg_get_expr(polwithcheck, polrelid) = 'true'
  ) THEN
    RAISE EXCEPTION 'FAIL: an open INSERT policy remains';
  END IF;
  RAISE NOTICE 'PASS: bookkeeping, profiles publication, avatars, and open inserts are locked';
END $$;

-- Trigger functions have no EXECUTE for the writer, and the write still runs.
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","email":"a.passed@example.com"}', false);
SET ROLE authenticated;

UPDATE public.profiles
SET bio = 'trigger still runs'
WHERE user_id = '11111111-1111-4111-8111-111111111111';

INSERT INTO public.posts (id, user_id, content)
VALUES (
  'abababab-abab-4aba-8aba-ababababab99',
  '11111111-1111-4111-8111-111111111111',
  'post after execute revoke'
);

INSERT INTO public.notifications (user_id, type, title, data)
VALUES (
  '22222222-2222-4222-8222-222222222222',
  'message',
  'New Message',
  '{"conversation_id":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"}'::jsonb
);

DO $$
BEGIN
  BEGIN
    INSERT INTO public.notifications (user_id, type, title)
    VALUES ('33333333-3333-4333-8333-333333333333', 'message', 'spam');
    RAISE EXCEPTION 'FAIL: arbitrary notification insert was allowed';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: notification insert requires a real relationship';
  END;
  BEGIN
    INSERT INTO public.ai_project_matches (user_id, project_id)
    VALUES (
      '11111111-1111-4111-8111-111111111111',
      'abababab-abab-4aba-8aba-abababababab'
    );
    RAISE EXCEPTION 'FAIL: authenticated inserted an ai match';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: ai match insert is service_role only';
  END;
END $$;

RESET ROLE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = '11111111-1111-4111-8111-111111111111'
      AND bio = 'trigger still runs'
  ) THEN
    RAISE EXCEPTION 'FAIL: profile update did not run';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.xp_events
    WHERE source_id = 'abababab-abab-4aba-8aba-ababababab99'
  ) THEN
    RAISE EXCEPTION 'FAIL: post trigger did not award xp without EXECUTE';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.notifications
    WHERE user_id = '22222222-2222-4222-8222-222222222222'
      AND type = 'message'
  ) THEN
    RAISE EXCEPTION 'FAIL: participant notification was rejected';
  END IF;
  RAISE NOTICE 'PASS: triggers and the signed-in notification insert still work';
END $$;

SELECT set_config('request.jwt.claim.sub', '', false);
SELECT set_config('request.jwt.claim.role', 'anon', false);
SELECT set_config('request.jwt.claims', '{"role":"anon"}', false);
SET ROLE anon;

DO $$
BEGIN
  BEGIN
    PERFORM 1 FROM public.posts LIMIT 1;
    RAISE EXCEPTION 'FAIL: anon can read posts';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: anon cannot read posts';
  END;
  BEGIN
    PERFORM public.enqueue_email('transactional_emails', '{}'::jsonb);
    RAISE EXCEPTION 'FAIL: anon executed enqueue_email';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: anon cannot execute enqueue_email';
  END;
  BEGIN
    INSERT INTO public.notifications (user_id, type, title)
    VALUES ('22222222-2222-4222-8222-222222222222', 'message', 'anon');
    RAISE EXCEPTION 'FAIL: anon inserted a notification';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: anon cannot insert a notification';
  END;
  RAISE NOTICE 'PASS: anon cannot read the feed and cannot call the email queue';
END $$;

RESET ROLE;

-- Project collaborations: private discovery, subgroup reads, and share-up.
-- A owns both projects. B is accepted onto the private one.
-- The admin account can read the project row. It is not a chat member.
-- The block fixture above would correctly stop B from posting into a chat
-- that includes A. Those block checks have already passed.
DELETE FROM public.user_blocks
WHERE blocker_id = '11111111-1111-4111-8111-111111111111'
  AND blocked_id = '22222222-2222-4222-8222-222222222222';

SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","email":"a.passed@example.com"}', false);
SET ROLE authenticated;

-- insert().select() is INSERT ... RETURNING. The creator must get the new row
-- back, including a private project whose helper check cannot see it yet.
DO $$
DECLARE
  returned_id uuid;
BEGIN
  INSERT INTO public.projects (id, creator_id, title, status, is_private, listing_type, hide_from_calendar)
  VALUES (
    'c4c4c4c4-c4c4-44c4-84c4-c4c4c4c4c4c4',
    '11111111-1111-4111-8111-111111111111',
    'Returning collab',
    'open',
    true,
    'project',
    false
  )
  RETURNING id INTO returned_id;

  IF returned_id IS DISTINCT FROM 'c4c4c4c4-c4c4-44c4-84c4-c4c4c4c4c4c4' THEN
    RAISE EXCEPTION 'FAIL: creator insert-with-returning did not return the new project';
  END IF;
  RAISE NOTICE 'PASS: creator insert-with-returning returns the new project';
END $$;

INSERT INTO public.projects (id, creator_id, title, status, is_private, listing_type, hide_from_calendar)
VALUES
  ('c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1', '11111111-1111-4111-8111-111111111111', 'Public collab', 'open', false, 'project', false),
  ('c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2', '11111111-1111-4111-8111-111111111111', 'Private collab', 'open', true, 'gig', false);

INSERT INTO public.project_roles (id, project_id, role_name, payout_amount, credit_amount)
VALUES ('e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1', 'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2', 'Model', 200, 15);

INSERT INTO public.conversations (id, type, name, created_by, project_id, visibility)
VALUES ('d1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1', 'group', 'Private collab', '11111111-1111-4111-8111-111111111111', 'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2', 'private');

INSERT INTO public.conversation_participants (conversation_id, user_id, role, project_role_name)
VALUES ('d1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1', '11111111-1111-4111-8111-111111111111', 'owner', 'Owner');

INSERT INTO public.project_attachments (project_id, uploaded_by, file_url, file_name, file_type)
VALUES ('c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2', '11111111-1111-4111-8111-111111111111', 'https://example.com/ref.jpg', 'ref.jpg', 'image');

RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","email":"b.waiting@example.com"}', false);
SET ROLE authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.projects WHERE id = 'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2') THEN
    RAISE EXCEPTION 'FAIL: non-member B can see the private project';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.projects WHERE id = 'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1') THEN
    RAISE EXCEPTION 'FAIL: B cannot see the public project';
  END IF;
  IF EXISTS (SELECT 1 FROM public.project_attachments WHERE project_id = 'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2') THEN
    RAISE EXCEPTION 'FAIL: non-member B can see private project files';
  END IF;
  BEGIN
    INSERT INTO public.project_applications (project_id, role_id, applicant_id, status)
    VALUES (
      'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2',
      'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1',
      '22222222-2222-4222-8222-222222222222',
      'pending'
    );
    RAISE EXCEPTION 'FAIL: non-member B applied to a private project';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: a non-member cannot apply to a private project';
  END;
  RAISE NOTICE 'PASS: a non-member cannot see a private project or its files';
END $$;

RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","email":"a.passed@example.com"}', false);
SET ROLE authenticated;

INSERT INTO public.conversations (id, type, name, created_by, project_id, visibility, is_client_chat)
VALUES (
  'd3d3d3d3-d3d3-43d3-83d3-d3d3d3d3d3d3',
  'direct',
  'Private collab client',
  '11111111-1111-4111-8111-111111111111',
  'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2',
  'private',
  true
);

INSERT INTO public.project_clients (project_id, client_user_id, invited_by, status)
VALUES (
  'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2',
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  'invited'
);

INSERT INTO public.conversation_participants (conversation_id, user_id, role)
VALUES
  ('d3d3d3d3-d3d3-43d3-83d3-d3d3d3d3d3d3', '11111111-1111-4111-8111-111111111111', 'owner'),
  ('d3d3d3d3-d3d3-43d3-83d3-d3d3d3d3d3d3', '22222222-2222-4222-8222-222222222222', 'member');

RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","email":"b.waiting@example.com"}', false);
SET ROLE authenticated;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.projects WHERE id = 'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2') THEN
    RAISE EXCEPTION 'FAIL: invited person B cannot see the private project';
  END IF;
  RAISE NOTICE 'PASS: an invited person can see a private project';
END $$;

INSERT INTO public.project_applications (project_id, role_id, applicant_id, status)
VALUES (
  'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2',
  'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1',
  '22222222-2222-4222-8222-222222222222',
  'pending'
);

RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","email":"a.passed@example.com"}', false);
SET ROLE authenticated;

UPDATE public.project_applications
SET status = 'accepted', reviewed_by = '11111111-1111-4111-8111-111111111111'
WHERE project_id = 'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2'
  AND applicant_id = '22222222-2222-4222-8222-222222222222';

INSERT INTO public.conversation_participants (conversation_id, user_id, role, project_role_name)
VALUES ('d1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1', '22222222-2222-4222-8222-222222222222', 'member', 'Model');

RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","email":"b.waiting@example.com"}', false);
SET ROLE authenticated;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.projects WHERE id = 'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2') THEN
    RAISE EXCEPTION 'FAIL: accepted member B cannot see the private project';
  END IF;
  RAISE NOTICE 'PASS: an accepted member can see a private project';
END $$;

INSERT INTO public.conversations (id, type, name, created_by, project_id, parent_conversation_id, visibility)
VALUES (
  'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2d2',
  'group',
  'Models only',
  '22222222-2222-4222-8222-222222222222',
  'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2',
  'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1',
  'private'
);

INSERT INTO public.conversation_participants (conversation_id, user_id, role, project_role_name)
VALUES ('d2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2d2', '22222222-2222-4222-8222-222222222222', 'member', 'Model');

INSERT INTO public.messages (id, conversation_id, sender_id, content)
VALUES (
  'f1f1f1f1-f1f1-41f1-81f1-f1f1f1f1f1f1',
  'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2d2',
  '22222222-2222-4222-8222-222222222222',
  'Call time is 8'
);

SELECT public.share_messages_to_project_main(ARRAY['f1f1f1f1-f1f1-41f1-81f1-f1f1f1f1f1f1']::uuid[]);

RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","email":"a.passed@example.com"}', false);
SET ROLE authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.messages
    WHERE conversation_id = 'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2d2'
      AND content = 'Call time is 8'
  ) THEN
    RAISE EXCEPTION 'FAIL: owner cannot read a subgroup they were not added to';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.messages
    WHERE conversation_id = 'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1'
      AND shared_from_message_id = 'f1f1f1f1-f1f1-41f1-81f1-f1f1f1f1f1f1'
  ) THEN
    RAISE EXCEPTION 'FAIL: shared subgroup message did not land in the main chat';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = 'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2d2'
      AND user_id = '11111111-1111-4111-8111-111111111111'
  ) THEN
    RAISE EXCEPTION 'FAIL: reading a subgroup added the owner as a member';
  END IF;
  RAISE NOTICE 'PASS: owner reads a subgroup without being added, and the share reached the main chat';
END $$;

RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","email":"admin@example.com"}', false);
SET ROLE authenticated;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.projects WHERE id = 'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2') THEN
    RAISE EXCEPTION 'FAIL: an admin cannot see the private project';
  END IF;
  IF EXISTS (SELECT 1 FROM public.conversations WHERE id = 'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2d2') THEN
    RAISE EXCEPTION 'FAIL: stranger can see the subgroup';
  END IF;
  IF EXISTS (SELECT 1 FROM public.messages WHERE conversation_id = 'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2d2') THEN
    RAISE EXCEPTION 'FAIL: stranger can read subgroup messages';
  END IF;
  BEGIN
    PERFORM public.claim_chat_email_window(
      '33333333-3333-4333-8333-333333333333',
      'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1'
    );
    RAISE EXCEPTION 'FAIL: authenticated user claimed a chat email window';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: chat email throttle is service_role only';
  END;
  RAISE NOTICE 'PASS: an admin can see a private project, and a non-member cannot see its subgroup';
END $$;

RESET ROLE;

-- reject_objectionable_text calls objectionable_text, which is not granted to
-- authenticated. A signed-in insert has to succeed. Service role is not this check.
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","email":"a.passed@example.com"}', false);
SET ROLE authenticated;

INSERT INTO public.posts (id, user_id, content)
VALUES (
  'a9a9a9a9-a9a9-49a9-89a9-a9a9a9a9a9a9',
  '11111111-1111-4111-8111-111111111111',
  'signed-in post'
);

UPDATE public.posts
SET content = 'signed-in edit'
WHERE id = 'a9a9a9a9-a9a9-49a9-89a9-a9a9a9a9a9a9';

UPDATE public.profiles
SET bio = 'signed-in bio'
WHERE user_id = '11111111-1111-4111-8111-111111111111';

RESET ROLE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.posts
    WHERE id = 'a9a9a9a9-a9a9-49a9-89a9-a9a9a9a9a9a9'
      AND content = 'signed-in edit'
  ) THEN
    RAISE EXCEPTION 'FAIL: authenticated post write did not land';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = '11111111-1111-4111-8111-111111111111'
      AND bio = 'signed-in bio'
  ) THEN
    RAISE EXCEPTION 'FAIL: authenticated profile write did not land';
  END IF;
  RAISE NOTICE 'PASS: authenticated post and profile writes run reject_objectionable_text';
END $$;

-- Consumer catalog for anon. Community rows, emails, and stream keys stay closed.
-- Quota and guest-order writes run inside a transaction and roll back.

INSERT INTO public.events (id, creator_id, title, city, start_date, ticket_type, is_public)
VALUES (
  '14141414-1414-4414-8414-141414141414',
  '22222222-2222-4222-8222-222222222222',
  'Public consumer event',
  'Austin',
  now() + interval '3 days',
  'free',
  true
);

INSERT INTO public.events (id, creator_id, title, city, start_date, ticket_type, is_public)
VALUES (
  '15151515-1515-4515-8515-151515151515',
  '11111111-1111-4111-8111-111111111111',
  'Private consumer event',
  'Austin',
  now() + interval '4 days',
  'free',
  false
);

INSERT INTO public.projects (id, creator_id, title, status)
VALUES (
  '16161616-1616-4616-8616-161616161616',
  '11111111-1111-4111-8111-111111111111',
  'Open community project',
  'open'
);

INSERT INTO public.stores (id, user_id, name, is_active, accepts_cash)
VALUES (
  '17171717-1717-4717-8717-171717171717',
  '22222222-2222-4222-8222-222222222222',
  'Member B shop',
  true,
  true
);

INSERT INTO public.store_items (
  id, store_id, type, title, price, is_active, contact_email, contact_phone
) VALUES (
  '18181818-1818-4818-8818-181818181818',
  '17171717-1717-4717-8717-171717171717',
  'product',
  'Denim jacket',
  48,
  true,
  'secret-buyer@example.com',
  '5550199999'
);

INSERT INTO public.live_streams (
  id, host_id, title, stream_type, is_live, external_url, rtmp_stream_key
) VALUES (
  '19191919-1919-4919-8919-191919191919',
  '22222222-2222-4222-8222-222222222222',
  'Floor set',
  'youtube',
  true,
  'https://www.youtube.com/watch?v=jNQXAC9IVRw',
  'secret-stream-key'
);

INSERT INTO public.live_streams (id, host_id, title, stream_type, is_live)
VALUES (
  '1a1a1a1a-1a1a-41a1-81a1-1a1a1a1a1a1a',
  '22222222-2222-4222-8222-222222222222',
  'Draft room',
  'webrtc',
  false
);

SELECT set_config('request.jwt.claim.sub', '', false);
SELECT set_config('request.jwt.claim.role', 'anon', false);
SELECT set_config('request.jwt.claims', '{"role":"anon"}', false);
SET ROLE anon;

DO $$
DECLARE
  event_title text;
  item_title text;
  creator_name text;
  stream_title text;
  hidden text[];
BEGIN
  SELECT title INTO event_title
  FROM public.events
  WHERE id = '14141414-1414-4414-8414-141414141414';
  IF event_title IS DISTINCT FROM 'Public consumer event' THEN
    RAISE EXCEPTION 'FAIL: anon cannot read a public event title (got %)', event_title;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.events WHERE id = '15151515-1515-4515-8515-151515151515'
  ) THEN
    RAISE EXCEPTION 'FAIL: anon can read a private event';
  END IF;
  BEGIN
    PERFORM project_id FROM public.events WHERE id = '14141414-1414-4414-8414-141414141414';
    RAISE EXCEPTION 'FAIL: anon can read events.project_id';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: anon cannot read events.project_id';
  END;

  SELECT title INTO item_title
  FROM public.store_items
  WHERE id = '18181818-1818-4818-8818-181818181818';
  IF item_title IS DISTINCT FROM 'Denim jacket' THEN
    RAISE EXCEPTION 'FAIL: anon cannot read a product title (got %)', item_title;
  END IF;
  BEGIN
    PERFORM contact_email FROM public.store_items WHERE id = '18181818-1818-4818-8818-181818181818';
    RAISE EXCEPTION 'FAIL: anon can read store contact_email';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: anon cannot read store contact emails';
  END;
  BEGIN
    PERFORM contact_phone FROM public.store_items LIMIT 1;
    RAISE EXCEPTION 'FAIL: anon can read store contact_phone';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  SELECT title INTO stream_title
  FROM public.consumer_live_streams
  WHERE id = '19191919-1919-4919-8919-191919191919';
  IF stream_title IS DISTINCT FROM 'Floor set' THEN
    RAISE EXCEPTION 'FAIL: anon cannot watch a public stream (got %)', stream_title;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.consumer_live_streams
    WHERE id = '1a1a1a1a-1a1a-41a1-81a1-1a1a1a1a1a1a'
  ) THEN
    RAISE EXCEPTION 'FAIL: anon can see a draft stream';
  END IF;
  BEGIN
    PERFORM rtmp_stream_key FROM public.live_streams LIMIT 1;
    RAISE EXCEPTION 'FAIL: anon can read a stream key';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: anon cannot read stream keys';
  END;
  BEGIN
    PERFORM 1 FROM public.live_streams_public LIMIT 1;
    RAISE EXCEPTION 'FAIL: anon can read live_streams_public';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: anon cannot read live_streams_public';
  END;

  SELECT display_name INTO creator_name
  FROM public.consumer_creators
  WHERE user_id = '22222222-2222-4222-8222-222222222222';
  IF creator_name IS DISTINCT FROM 'Member B' THEN
    RAISE EXCEPTION 'FAIL: anon cannot see the seller display name (got %)', creator_name;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.consumer_creators
    WHERE user_id = '11111111-1111-4111-8111-111111111111'
  ) THEN
    RAISE EXCEPTION 'FAIL: anon can see an exam-gated profile on the consumer card';
  END IF;
  SELECT array_agg(column_name::text ORDER BY column_name) INTO hidden
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'consumer_creators'
    AND column_name IN ('email', 'phone', 'bio', 'social_links', 'access_status');
  IF hidden IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: consumer_creators exposes %', hidden;
  END IF;
  BEGIN
    PERFORM 1 FROM public.profiles_public LIMIT 1;
    RAISE EXCEPTION 'FAIL: anon can read profiles_public';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: anon cannot read profiles_public';
  END;
  BEGIN
    PERFORM 1 FROM public.projects WHERE title = 'Open community project';
    RAISE EXCEPTION 'FAIL: anon can read an open project';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: anon cannot read projects';
  END;
  BEGIN
    PERFORM guest_email FROM public.event_rsvps LIMIT 1;
    RAISE EXCEPTION 'FAIL: anon can read guest emails';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: anon cannot read guest emails';
  END;
  BEGIN
    PERFORM public.create_guest_event_rsvp(
      '14141414-1414-4414-8414-141414141414',
      'Guest',
      'guest@example.com',
      NULL,
      NULL
    );
    RAISE EXCEPTION 'FAIL: anon called create_guest_event_rsvp directly';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: anon cannot call create_guest_event_rsvp directly';
  END;
  RAISE NOTICE 'PASS: anon consumer catalog is limited to public event, product, and live fields';
END $$;

RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","email":"b.waiting@example.com"}', false);
SET ROLE authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.posts WHERE user_id = '22222222-2222-4222-8222-222222222222'
  ) THEN
    RAISE EXCEPTION 'FAIL: a member cannot read their posts';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.projects WHERE title = 'Open community project'
  ) THEN
    RAISE EXCEPTION 'FAIL: a member cannot read an open project';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles_public
    WHERE user_id = '22222222-2222-4222-8222-222222222222'
      AND display_name = 'Member B'
  ) THEN
    RAISE EXCEPTION 'FAIL: a member cannot read profiles_public';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.events WHERE id = '15151515-1515-4515-8515-151515151515'
  ) THEN
    RAISE EXCEPTION 'FAIL: a member can read someone else''s private event';
  END IF;
  RAISE NOTICE 'PASS: authenticated members still read posts, projects, and public profiles';
END $$;

RESET ROLE;

-- Admin hide and remove from 20261024120000 must survive the consumer policy
-- rewrite. Another member cannot see a hidden or removed row. The author can
-- see their own hidden row. An admin can see both.

INSERT INTO public.posts (id, user_id, content) VALUES
  ('a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a7a7', '11111111-1111-4111-8111-111111111111', 'held post');

INSERT INTO public.post_comments (id, post_id, user_id, content) VALUES
  ('b7b7b7b7-b7b7-47b7-87b7-b7b7b7b7b7b7', 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a7a7', '11111111-1111-4111-8111-111111111111', 'held comment');

INSERT INTO public.projects (id, creator_id, title, status, is_private)
VALUES (
  'c7c7c7c7-c7c7-47c7-87c7-c7c7c7c7c7c7',
  '11111111-1111-4111-8111-111111111111',
  'Held project',
  'open',
  false
);

UPDATE public.posts SET hidden_at = now() WHERE id = 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a7a7';
UPDATE public.post_comments SET hidden_at = now() WHERE id = 'b7b7b7b7-b7b7-47b7-87b7-b7b7b7b7b7b7';
UPDATE public.projects SET hidden_at = now() WHERE id = 'c7c7c7c7-c7c7-47c7-87c7-c7c7c7c7c7c7';

SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","email":"b.waiting@example.com"}', false);
SET ROLE authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.posts WHERE id = 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a7a7') THEN
    RAISE EXCEPTION 'FAIL: another member can read an admin-hidden post';
  END IF;
  IF EXISTS (SELECT 1 FROM public.post_comments WHERE id = 'b7b7b7b7-b7b7-47b7-87b7-b7b7b7b7b7b7') THEN
    RAISE EXCEPTION 'FAIL: another member can read an admin-hidden comment';
  END IF;
  IF EXISTS (SELECT 1 FROM public.projects WHERE id = 'c7c7c7c7-c7c7-47c7-87c7-c7c7c7c7c7c7') THEN
    RAISE EXCEPTION 'FAIL: another member can read an admin-hidden project';
  END IF;
  RAISE NOTICE 'PASS: admin-hidden posts, comments, and projects stay hidden from other members';
END $$;

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","email":"a.passed@example.com"}', false);
SET ROLE authenticated;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.posts WHERE id = 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a7a7') THEN
    RAISE EXCEPTION 'FAIL: the author cannot read their hidden post';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.post_comments WHERE id = 'b7b7b7b7-b7b7-47b7-87b7-b7b7b7b7b7b7') THEN
    RAISE EXCEPTION 'FAIL: the author cannot read their hidden comment';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.projects WHERE id = 'c7c7c7c7-c7c7-47c7-87c7-c7c7c7c7c7c7') THEN
    RAISE EXCEPTION 'FAIL: the creator cannot read their hidden project';
  END IF;
  RAISE NOTICE 'PASS: authors still read their own hidden posts, comments, and projects';
END $$;

RESET ROLE;
UPDATE public.posts SET removed_at = now() WHERE id = 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a7a7';
UPDATE public.post_comments SET removed_at = now() WHERE id = 'b7b7b7b7-b7b7-47b7-87b7-b7b7b7b7b7b7';
UPDATE public.projects SET removed_at = now() WHERE id = 'c7c7c7c7-c7c7-47c7-87c7-c7c7c7c7c7c7';

SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","email":"a.passed@example.com"}', false);
SET ROLE authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.posts WHERE id = 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a7a7') THEN
    RAISE EXCEPTION 'FAIL: the author can read a removed post';
  END IF;
  IF EXISTS (SELECT 1 FROM public.post_comments WHERE id = 'b7b7b7b7-b7b7-47b7-87b7-b7b7b7b7b7b7') THEN
    RAISE EXCEPTION 'FAIL: the author can read a removed comment';
  END IF;
  IF EXISTS (SELECT 1 FROM public.projects WHERE id = 'c7c7c7c7-c7c7-47c7-87c7-c7c7c7c7c7c7') THEN
    RAISE EXCEPTION 'FAIL: the creator can read a removed project';
  END IF;
  RAISE NOTICE 'PASS: removed posts, comments, and projects stay hidden from their authors';
END $$;

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', false);
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('request.jwt.claims', '{"role":"authenticated","email":"admin@example.com"}', false);
SET ROLE authenticated;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.posts WHERE id = 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a7a7') THEN
    RAISE EXCEPTION 'FAIL: an admin cannot read a removed post';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.post_comments WHERE id = 'b7b7b7b7-b7b7-47b7-87b7-b7b7b7b7b7b7') THEN
    RAISE EXCEPTION 'FAIL: an admin cannot read a removed comment';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.projects WHERE id = 'c7c7c7c7-c7c7-47c7-87c7-c7c7c7c7c7c7') THEN
    RAISE EXCEPTION 'FAIL: an admin cannot read a removed project';
  END IF;
  RAISE NOTICE 'PASS: an admin can read hidden and removed posts, comments, and projects';
END $$;

RESET ROLE;

BEGIN;
  SELECT public.consume_guest_quota('guest_rsvp_email', 'quota@example.com', 2, 86400);
  SELECT public.consume_guest_quota('guest_rsvp_email', 'quota@example.com', 2, 86400);
  DO $$
  BEGIN
    PERFORM public.consume_guest_quota('guest_rsvp_email', 'quota@example.com', 2, 86400);
    RAISE EXCEPTION 'FAIL: guest quota allowed a third hit';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT ILIKE '%limit reached%' THEN
      RAISE;
    END IF;
  END $$;

  SELECT public.create_guest_event_rsvp(
    '14141414-1414-4414-8414-141414141414',
    'Quota Guest',
    'rsvp-rollback@example.com',
    NULL,
    NULL
  );
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM public.event_rsvps
      WHERE guest_email = 'rsvp-rollback@example.com'
        AND event_id = '14141414-1414-4414-8414-141414141414'
    ) THEN
      RAISE EXCEPTION 'FAIL: guest RSVP did not write';
    END IF;
  END $$;

  SELECT public.begin_guest_store_order(
    '18181818-1818-4818-8818-181818181818',
    'Buyer Guest',
    'checkout-rollback@example.com',
    1,
    'ip-hash-for-test',
    123
  );
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM public.store_orders
      WHERE guest_email = 'checkout-rollback@example.com'
        AND buyer_id IS NULL
        AND status = 'pending'
        AND platform_fee = 1.23
    ) THEN
      RAISE EXCEPTION 'FAIL: guest checkout order did not store the supplied fee';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.store_orders
      WHERE guest_email = 'checkout-rollback@example.com'
        AND guest_cancel_token IS NULL
    ) THEN
      RAISE EXCEPTION 'FAIL: guest order is missing a cancel token';
    END IF;
  END $$;
ROLLBACK;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.event_rsvps WHERE guest_email = 'rsvp-rollback@example.com'
  ) THEN
    RAISE EXCEPTION 'FAIL: rolled-back guest RSVP is still stored';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.store_orders WHERE guest_email = 'checkout-rollback@example.com'
  ) THEN
    RAISE EXCEPTION 'FAIL: rolled-back guest order is still stored';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.guest_action_buckets WHERE bucket_key = 'quota@example.com'
  ) THEN
    RAISE EXCEPTION 'FAIL: rolled-back quota bucket is still stored';
  END IF;
  RAISE NOTICE 'PASS: guest RSVP and checkout writes rolled back';
END $$;

SET ROLE service_role;
BEGIN;
  SELECT public.begin_guest_store_order(
    '18181818-1818-4818-8818-181818181818',
    'Service Guest',
    'service-checkout@example.com',
    2,
    NULL,
    0
  );
ROLLBACK;
RESET ROLE;

