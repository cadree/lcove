-- Admin, member, and anon checks for the admin console.
-- The whole script rolls back. It refuses every database except ether_admin_test.
--
--   psql "postgres:///ether_admin_test" -v ON_ERROR_STOP=1 -f scripts/admin-console-privilege-check.sql

DO $guard$
BEGIN
  IF current_database() IS DISTINCT FROM 'ether_admin_test' THEN
    RAISE EXCEPTION 'refusing admin check on database %', current_database();
  END IF;
END
$guard$;

BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('11111111-1111-4111-8111-111111111111', 'admin@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'member@example.test'),
  ('33333333-3333-4333-8333-333333333333', 'target@example.test');

INSERT INTO public.profiles (user_id, display_name, access_status, created_at) VALUES
  ('11111111-1111-4111-8111-111111111111', 'Admin', 'active', now() - interval '40 days'),
  ('22222222-2222-4222-8222-222222222222', 'Member', 'active', now() - interval '2 days'),
  ('33333333-3333-4333-8333-333333333333', 'Target', 'active', now() - interval '10 days');

INSERT INTO public.user_roles (user_id, role) VALUES
  ('11111111-1111-4111-8111-111111111111', 'admin');

INSERT INTO public.posts (id, user_id, content) VALUES
  ('01999999-0000-4000-8000-000000000010', '33333333-3333-4333-8333-333333333333', 'A real photograph of the room');

INSERT INTO public.events (id, creator_id, title, is_public) VALUES
  ('01999999-0000-4000-8000-000000000011', '33333333-3333-4333-8333-333333333333', 'Open studio', true);

INSERT INTO public.stores (id, user_id) VALUES
  ('01999999-0000-4000-8000-000000000012', '33333333-3333-4333-8333-333333333333');

INSERT INTO public.store_items (id, store_id, title) VALUES
  ('01999999-0000-4000-8000-000000000013', '01999999-0000-4000-8000-000000000012', 'Print');

INSERT INTO public.content_reports (id, reporter_id, target_type, target_id, reason, status) VALUES
  (
    '01999999-0000-4000-8000-000000000014',
    '22222222-2222-4222-8222-222222222222',
    'post',
    '01999999-0000-4000-8000-000000000010',
    'Fake or AI-generated person',
    'open'
  );

INSERT INTO public.ticket_orders (total_cents, refund_amount_cents, payment_method, payment_status, stripe_payment_intent_id)
VALUES (2500, 0, 'stripe', 'paid', 'pi_test_admin_console');

-- Anon cannot execute an admin function.
SET LOCAL ROLE anon;
DO $anon$
BEGIN
  PERFORM public.admin_dashboard_stats();
  RAISE EXCEPTION 'FAIL anon stats was allowed';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS anon stats denied (%).', SQLERRM;
END
$anon$;
RESET ROLE;

-- A signed-in member is denied, and cannot change their own standing.
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
SET LOCAL ROLE authenticated;
DO $member_rpc$
BEGIN
  IF auth.uid() IS DISTINCT FROM '22222222-2222-4222-8222-222222222222'::uuid THEN
    RAISE EXCEPTION 'FAIL member uid is %', auth.uid();
  END IF;
  PERFORM public.admin_set_user_access('33333333-3333-4333-8333-333333333333', 'suspend', 'nope');
  RAISE EXCEPTION 'FAIL member suspend was allowed';
EXCEPTION
  WHEN insufficient_privilege THEN
    IF SQLERRM ILIKE '%Admins only%' THEN
      RAISE NOTICE 'PASS member suspend denied';
    ELSE
      RAISE;
    END IF;
END
$member_rpc$;

DO $member_standing$
BEGIN
  UPDATE public.profiles
    SET is_suspended = false
    WHERE user_id = '22222222-2222-4222-8222-222222222222';
  UPDATE public.profiles
    SET is_suspended = true
    WHERE user_id = '22222222-2222-4222-8222-222222222222';
  RAISE EXCEPTION 'FAIL member changed their own standing';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS member standing update denied (%).', SQLERRM;
END
$member_standing$;

UPDATE public.profiles
  SET display_name = 'Member renamed'
  WHERE user_id = auth.uid();
DO $member_rename$
DECLARE
  name text;
BEGIN
  SELECT display_name INTO name FROM public.profiles WHERE user_id = auth.uid();
  IF name IS DISTINCT FROM 'Member renamed' THEN
    RAISE EXCEPTION 'FAIL member rename stored %', name;
  END IF;
  RAISE NOTICE 'PASS member can still edit their name';
END
$member_rename$;
RESET ROLE;

-- Admin path: stats, suspend, hide, report, message, soft delete, refused hard delete, hard delete.
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
SET LOCAL ROLE authenticated;
DO $admin$
DECLARE
  stats jsonb;
  suspended boolean;
  hidden integer;
  report_status text;
  notice_count integer;
  audit_count integer;
  removed timestamptz;
BEGIN
  stats := public.admin_dashboard_stats();
  IF (stats->>'signups_total')::int <> 3
    OR (stats->>'signups_7d')::int <> 1
    OR (stats->>'posts_total')::int <> 1
    OR (stats->>'events_total')::int <> 1
    OR (stats->>'reports_open')::int <> 1
    OR (stats->>'reports_ai_open')::int <> 1
    OR (stats->>'revenue_cents')::int <> 2500
  THEN
    RAISE EXCEPTION 'FAIL stats %', stats;
  END IF;
  RAISE NOTICE 'PASS admin stats';

  PERFORM public.admin_set_user_access('33333333-3333-4333-8333-333333333333', 'suspend', 'spam');
  RESET ROLE;
  SELECT is_suspended INTO suspended FROM public.profiles WHERE user_id = '33333333-3333-4333-8333-333333333333';
  SET LOCAL ROLE authenticated;
  IF NOT suspended THEN
    RAISE EXCEPTION 'FAIL suspend did not stick';
  END IF;
  RAISE NOTICE 'PASS admin suspend';

  PERFORM set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
  BEGIN
    INSERT INTO public.posts (user_id, content) VALUES ('33333333-3333-4333-8333-333333333333', 'still posting');
    RAISE EXCEPTION 'FAIL suspended account inserted a post';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'PASS suspended account cannot post';
  END;
  IF EXISTS (SELECT 1 FROM public.posts WHERE content = 'still posting') THEN
    RAISE EXCEPTION 'FAIL suspended post was stored';
  END IF;
  BEGIN
    UPDATE public.posts
      SET content = 'rewritten while suspended'
      WHERE id = '01999999-0000-4000-8000-000000000010';
    RAISE EXCEPTION 'FAIL suspended account rewrote a post';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'PASS suspended account cannot edit a post';
  END;
  UPDATE public.posts
    SET created_at = created_at
    WHERE id = '01999999-0000-4000-8000-000000000010';
  RAISE NOTICE 'PASS suspended account bookkeeping update is allowed';
  PERFORM set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);

  PERFORM public.admin_moderate_content('post', '01999999-0000-4000-8000-000000000010', 'hide', 'ai rule', NULL);
  IF (SELECT count(*) FROM public.admin_list_content('post', 'photograph', 10) WHERE state = 'hidden') <> 1 THEN
    RAISE EXCEPTION 'FAIL content search did not return the hidden post';
  END IF;
  PERFORM public.admin_moderate_content('event', '01999999-0000-4000-8000-000000000011', 'remove', 'duplicate', NULL);
  PERFORM public.admin_moderate_content('product', '01999999-0000-4000-8000-000000000013', 'hide', 'not a product photo', NULL);
  RAISE NOTICE 'PASS admin hid a post, removed an event, hid a product';

  PERFORM public.admin_review_report(
    '01999999-0000-4000-8000-000000000014',
    'resolve',
    'Reviewed the AI-rule report',
    NULL
  );
  RESET ROLE;
  SELECT status INTO report_status FROM public.content_reports WHERE id = '01999999-0000-4000-8000-000000000014';
  SET LOCAL ROLE authenticated;
  IF report_status IS DISTINCT FROM 'actioned' THEN
    RAISE EXCEPTION 'FAIL report status %', report_status;
  END IF;
  RAISE NOTICE 'PASS admin resolved the AI-rule report';

  PERFORM public.admin_message_user(
    '22222222-2222-4222-8222-222222222222',
    'Hello',
    'This is an admin notice'
  );
  RESET ROLE;
  SELECT count(*) INTO notice_count FROM public.notifications
    WHERE user_id = '22222222-2222-4222-8222-222222222222' AND type = 'admin';
  SET LOCAL ROLE authenticated;
  IF notice_count <> 1 THEN
    RAISE EXCEPTION 'FAIL notice count %', notice_count;
  END IF;
  RAISE NOTICE 'PASS admin in-app message';

  PERFORM public.admin_remove_user('33333333-3333-4333-8333-333333333333', 'removed', false, NULL);
  RESET ROLE;
  SELECT deleted_at INTO removed FROM public.profiles WHERE user_id = '33333333-3333-4333-8333-333333333333';
  SET LOCAL ROLE authenticated;
  IF removed IS NULL THEN
    RAISE EXCEPTION 'FAIL soft delete left deleted_at null';
  END IF;
  RAISE NOTICE 'PASS admin soft delete';

  BEGIN
    PERFORM public.admin_remove_user(
      '22222222-2222-4222-8222-222222222222',
      'no',
      true,
      'wrong-confirm'
    );
    RAISE EXCEPTION 'FAIL hard delete accepted a bad confirmation';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'PASS hard delete refused without the user id';
  END;

  IF EXISTS (SELECT 1 FROM auth.users WHERE id = '22222222-2222-4222-8222-222222222222') IS NOT TRUE THEN
    RAISE EXCEPTION 'FAIL bad confirmation removed the member';
  END IF;

  PERFORM public.admin_remove_user(
    '22222222-2222-4222-8222-222222222222',
    'confirmed',
    true,
    '22222222-2222-4222-8222-222222222222'
  );
  RESET ROLE;
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = '22222222-2222-4222-8222-222222222222') THEN
    RAISE EXCEPTION 'FAIL hard delete left the login';
  END IF;
  SELECT count(*) INTO audit_count FROM public.admin_actions WHERE admin_id = '11111111-1111-4111-8111-111111111111';
  IF audit_count < 8 THEN
    RAISE EXCEPTION 'FAIL audit count %', audit_count;
  END IF;
  RAISE NOTICE 'PASS hard delete and % audit rows', audit_count;
END
$admin$;
RESET ROLE;

-- The hidden post is invisible to anon and to a member, and visible to the admin.
SELECT set_config('request.jwt.claim.sub', '', true);
SET LOCAL ROLE anon;
DO $anon_post$
DECLARE
  seen integer;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL anon uid is %', auth.uid();
  END IF;
  SELECT count(*) INTO seen FROM public.posts WHERE id = '01999999-0000-4000-8000-000000000010';
  IF seen <> 0 THEN
    RAISE EXCEPTION 'FAIL anon still sees the hidden post';
  END IF;
  SELECT count(*) INTO seen FROM public.events WHERE id = '01999999-0000-4000-8000-000000000011';
  IF seen <> 0 THEN
    RAISE EXCEPTION 'FAIL anon still sees the removed event';
  END IF;
  RAISE NOTICE 'PASS anon does not see hidden or removed content';
END
$anon_post$;
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
SET LOCAL ROLE authenticated;
DO $admin_post$
DECLARE
  seen integer;
BEGIN
  SELECT count(*) INTO seen FROM public.posts WHERE id = '01999999-0000-4000-8000-000000000010';
  IF seen <> 1 THEN
    RAISE EXCEPTION 'FAIL admin cannot see the hidden post';
  END IF;
  RAISE NOTICE 'PASS admin still sees the hidden post';
END
$admin_post$;
RESET ROLE;

ROLLBACK;
