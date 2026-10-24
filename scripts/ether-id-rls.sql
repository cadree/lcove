-- Ether ID checks. Run by scripts/integration-rls-check.sh after the
-- shared fixtures exist. Writes run as authenticated inside BEGIN/ROLLBACK.

\set ON_ERROR_STOP on

\set user_a '11111111-1111-4111-8111-111111111111'
\set user_b '22222222-2222-4222-8222-222222222222'
\set user_admin '33333333-3333-4333-8333-333333333333'

BEGIN;

DO $$
DECLARE
  hidden text[];
BEGIN
  SELECT array_agg(column_name::text ORDER BY column_name) INTO hidden
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'profiles_public'
    AND column_name IN ('birthday_month', 'birthday_day', 'show_birthday', 'username', 'birth_year');
  IF hidden IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: profiles_public exposes %', hidden;
  END IF;
  RAISE NOTICE 'PASS: profiles_public has no username, birthday, or birth year';
END $$;

DO $$
DECLARE
  tok text;
  old_tok text;
  card jsonb;
  pub jsonb;
  pass jsonb;
  serial text;
  pass_auth text;
  created boolean;
  pushes integer;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  UPDATE public.profiles
  SET
    username = '@Member_A',
    birthday_month = 3,
    birthday_day = 4,
    show_birthday = true,
    last_active_at = now()
  WHERE user_id = '11111111-1111-4111-8111-111111111111';

  IF (SELECT username FROM public.profiles WHERE user_id = '11111111-1111-4111-8111-111111111111') <> 'member_a' THEN
    RAISE EXCEPTION 'FAIL: username was not normalized';
  END IF;

  BEGIN
    UPDATE public.profiles
    SET birthday_month = 2, birthday_day = 31
    WHERE user_id = '11111111-1111-4111-8111-111111111111';
    RAISE EXCEPTION 'FAIL: February 31 was stored';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%real month%' THEN
      RAISE;
    END IF;
  END;

  BEGIN
    UPDATE public.profiles
    SET username = 'no'
    WHERE user_id = '11111111-1111-4111-8111-111111111111';
    RAISE EXCEPTION 'FAIL: short username was stored';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%3 to 20%' THEN
      RAISE;
    END IF;
  END;

  BEGIN
    UPDATE public.profiles
    SET is_suspended = true
    WHERE user_id = '11111111-1111-4111-8111-111111111111';
    RAISE EXCEPTION 'FAIL: member suspended themselves';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  INSERT INTO public.user_passions (user_id, passion_id)
  SELECT '11111111-1111-4111-8111-111111111111', id
  FROM public.passions
  WHERE name = 'Photography'
  LIMIT 1;

  INSERT INTO public.projects (id, creator_id, title, status)
  VALUES ('a1111111-1111-4111-8111-1111111111e1', '11111111-1111-4111-8111-111111111111', 'Finished by A', 'completed');

  PERFORM set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
  INSERT INTO public.projects (id, creator_id, title, status)
  VALUES
    ('b2222222-2222-4222-8222-2222222222e2', '22222222-2222-4222-8222-222222222222', 'Finished with A', 'completed'),
    ('b3333333-3333-4333-8333-3333333333e3', '22222222-2222-4222-8222-222222222222', 'Still pending A', 'completed');
  INSERT INTO public.project_roles (id, project_id, role_name)
  VALUES
    ('e2222222-2222-4222-8222-2222222222e2', 'b2222222-2222-4222-8222-2222222222e2', 'Camera'),
    ('e3333333-3333-4333-8333-3333333333e3', 'b3333333-3333-4333-8333-3333333333e3', 'Camera');

  INSERT INTO public.user_reviews (reviewer_id, reviewed_user_id, rating, title, content)
  VALUES (
    '22222222-2222-4222-8222-222222222222',
    '11111111-1111-4111-8111-111111111111',
    4,
    'Steady',
    'Showed up and finished the work.'
  );

  PERFORM set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
  INSERT INTO public.project_applications (project_id, role_id, applicant_id, status)
  VALUES
    ('b2222222-2222-4222-8222-2222222222e2', 'e2222222-2222-4222-8222-2222222222e2', '11111111-1111-4111-8111-111111111111', 'pending'),
    ('b3333333-3333-4333-8333-3333333333e3', 'e3333333-3333-4333-8333-3333333333e3', '11111111-1111-4111-8111-111111111111', 'pending');

  PERFORM set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
  UPDATE public.project_applications
  SET status = 'accepted'
  WHERE project_id = 'b2222222-2222-4222-8222-2222222222e2'
    AND applicant_id = '11111111-1111-4111-8111-111111111111';

  PERFORM set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
  INSERT INTO public.user_reviews (reviewer_id, reviewed_user_id, rating, title, content)
  VALUES (
    '33333333-3333-4333-8333-333333333333',
    '11111111-1111-4111-8111-111111111111',
    5,
    'Precise',
    'Clear notes and a finished cut.'
  );

  PERFORM set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
  card := public.get_my_ether_id();
  tok := card->>'token';
  IF tok IS NULL OR tok NOT LIKE 'eid1.%' THEN
    RAISE EXCEPTION 'FAIL: owner card has no signed token: %', card;
  END IF;
  IF tok LIKE '%11111111-1111-4111-8111-111111111111%' THEN
    RAISE EXCEPTION 'FAIL: token contains the user id';
  END IF;
  IF card->>'status' <> 'Active' THEN
    RAISE EXCEPTION 'FAIL: expected Active, got %', card->>'status';
  END IF;
  IF card->>'username' <> 'member_a' OR card->>'passion' <> 'Photography' THEN
    RAISE EXCEPTION 'FAIL: username or passion mismatch: %', card;
  END IF;
  IF (card->>'peer_review_count')::int <> 2 OR card->>'peer_review_average' <> '4.5' THEN
    RAISE EXCEPTION 'FAIL: peer reviews are not the user_reviews average: %', card;
  END IF;
  IF card->>'peer_review_label' <> '4.5 average · 2 reviews' THEN
    RAISE EXCEPTION 'FAIL: peer review label %', card->>'peer_review_label';
  END IF;
  IF (card->>'projects_completed')::int <> 2 THEN
    RAISE EXCEPTION 'FAIL: completed project count %', card->>'projects_completed';
  END IF;
  IF card->>'birthday_label' <> 'March 4' OR card->>'birthday_label' ~ '[0-9]{4}' THEN
    RAISE EXCEPTION 'FAIL: birthday should be month and day only: %', card->>'birthday_label';
  END IF;
  IF card->>'birthday_note' <> 'self-reported' THEN
    RAISE EXCEPTION 'FAIL: birthday note %', card->>'birthday_note';
  END IF;
  IF card->>'verify_path' <> '/id/v/' || tok THEN
    RAISE EXCEPTION 'FAIL: verify path %', card->>'verify_path';
  END IF;

  pass := public.ensure_ether_id_pass('pass.com.ether.id.test');
  serial := pass->>'serial_number';
  pass_auth := pass->>'authentication_token';
  IF serial IS NULL OR serial LIKE '%11111111-1111-4111-8111-111111111111%' THEN
    RAISE EXCEPTION 'FAIL: pass serial is missing or is the user id: %', serial;
  END IF;
  PERFORM set_config('ether.probe_token', tok, true);
  PERFORM set_config('ether.probe_serial', serial, true);
  PERFORM set_config('ether.probe_pass_auth', pass_auth, true);

  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  EXECUTE 'RESET ROLE';
  EXECUTE 'SET LOCAL ROLE service_role';
  created := public.ether_id_register_device(serial, pass_auth, 'pass.com.ether.id.test', 'device-1', 'push-token-1');
  IF created IS NOT TRUE THEN
    RAISE EXCEPTION 'FAIL: device did not register';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  EXECUTE 'RESET ROLE';
  EXECUTE 'SET LOCAL ROLE authenticated';
  -- Direct profile updates of standing are refused for every authenticated
  -- session, including admins. The admin console RPC is the real path.
  PERFORM public.admin_set_user_access(
    '11111111-1111-4111-8111-111111111111',
    'suspend',
    'fixture'
  );

  PERFORM set_config('request.jwt.claim.role', 'anon', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  EXECUTE 'RESET ROLE';
  EXECUTE 'SET LOCAL ROLE anon';
  pub := public.get_ether_id_by_token(tok);
  IF pub->>'status' <> 'Suspended' THEN
    RAISE EXCEPTION 'FAIL: live status after suspend is %', pub;
  END IF;
  IF pub ? 'birthday_label' OR pub ? 'birthday_month' OR pub ? 'user_id'
     OR pub ? 'peer_review_count' OR pub ? 'projects_completed' OR pub ? 'token' THEN
    RAISE EXCEPTION 'FAIL: verify payload is not minimal: %', pub;
  END IF;
  IF pub->>'username' <> 'member_a' OR pub->>'display_name' <> 'Member A' THEN
    RAISE EXCEPTION 'FAIL: public name mismatch: %', pub;
  END IF;

  BEGIN
    PERFORM count(*) FROM public.ether_id_secret;
    IF (SELECT count(*) FROM public.ether_id_secret) <> 0 THEN
      RAISE EXCEPTION 'FAIL: anon read the signing secret';
    END IF;
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  BEGIN
    PERFORM count(*) FROM public.ether_id_tokens;
    IF (SELECT count(*) FROM public.ether_id_tokens) <> 0 THEN
      RAISE EXCEPTION 'FAIL: anon read verify tokens';
    END IF;
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  BEGIN
    PERFORM public.refresh_my_ether_id_token();
    RAISE EXCEPTION 'FAIL: anon minted a token';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  PERFORM set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  EXECUTE 'RESET ROLE';
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.admin_set_user_access(
    '11111111-1111-4111-8111-111111111111',
    'ban',
    'fixture'
  );

  PERFORM set_config('request.jwt.claim.role', 'anon', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  EXECUTE 'RESET ROLE';
  EXECUTE 'SET LOCAL ROLE anon';
  pub := public.get_ether_id_by_token(tok);
  IF pub->>'status' <> 'Banned' THEN
    RAISE EXCEPTION 'FAIL: live status after ban is %', pub->>'status';
  END IF;

  IF public.get_ether_id_by_token(tok || 'x') IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: tampered token verified';
  END IF;
  IF public.get_ether_id_by_token('11111111-1111-4111-8111-111111111111') IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: raw user id verified';
  END IF;

  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  EXECUTE 'RESET ROLE';
  EXECUTE 'SET LOCAL ROLE service_role';
  SELECT count(*) INTO pushes FROM public.ether_id_pending_pushes();
  IF pushes < 1 THEN
    RAISE EXCEPTION 'FAIL: ban did not queue a pass push';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  EXECUTE 'RESET ROLE';
  EXECUTE 'SET LOCAL ROLE authenticated';
  old_tok := tok;
  tok := public.refresh_my_ether_id_token();
  IF tok = old_tok THEN
    RAISE EXCEPTION 'FAIL: refresh did not rotate the token';
  END IF;

  PERFORM set_config('request.jwt.claim.role', 'anon', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  EXECUTE 'RESET ROLE';
  EXECUTE 'SET LOCAL ROLE anon';
  IF public.get_ether_id_by_token(old_tok) IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: revoked token still verifies';
  END IF;
  IF (public.get_ether_id_by_token(tok)->>'status') <> 'Banned' THEN
    RAISE EXCEPTION 'FAIL: rotated token is not the live ban';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  EXECUTE 'RESET ROLE';
  EXECUTE 'SET LOCAL ROLE authenticated';
  IF EXISTS (
    SELECT 1 FROM public.profiles WHERE user_id = '11111111-1111-4111-8111-111111111111'
  ) THEN
    RAISE EXCEPTION 'FAIL: another member read the owner profile row';
  END IF;
  BEGIN
    PERFORM public.ether_id_card_for_service('11111111-1111-4111-8111-111111111111');
    RAISE EXCEPTION 'FAIL: member called the service card';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  RAISE NOTICE 'PASS: ether id owner, anon, and ban checks';
END $$;

ROLLBACK;
RESET ROLE;
