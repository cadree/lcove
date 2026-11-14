-- Timing, opt-out, cancellation, and idempotency for attendee reminders.
-- Run only by scripts/attendee-reminder-check.sh against a scratch database.

\set ON_ERROR_STOP on

INSERT INTO auth.users (id, email) VALUES
  ('11111111-1111-4111-8111-111111111111', 'host@example.com'),
  ('22222222-2222-4222-8222-222222222222', 'guest@example.com'),
  ('33333333-3333-4333-8333-333333333333', 'other@example.com'),
  ('44444444-4444-4444-8444-444444444444', 'quiet@example.com'),
  ('55555555-5555-4555-8555-555555555555', 'inboxoff@example.com');

UPDATE public.profiles
SET display_name = 'Cadre House'
WHERE user_id = '11111111-1111-4111-8111-111111111111';

UPDATE public.notification_preferences
SET event_reminders_enabled = false
WHERE user_id = '44444444-4444-4444-8444-444444444444';

UPDATE public.notification_preferences
SET email_enabled = false,
    push_enabled = false
WHERE user_id = '55555555-5555-4555-8555-555555555555';

INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth)
VALUES (
  '22222222-2222-4222-8222-222222222222',
  'https://push.example/guest',
  'key',
  'auth'
);

DO $$
DECLARE
  v_now timestamptz := timestamptz '2026-10-24 15:00:00+00';
  v_host uuid := '11111111-1111-4111-8111-111111111111';
  v_guest uuid := '22222222-2222-4222-8222-222222222222';
  v_other uuid := '33333333-3333-4333-8333-333333333333';
  v_quiet uuid := '44444444-4444-4444-8444-444444444444';
  v_inbox uuid := '55555555-5555-4555-8555-555555555555';
  v_day uuid;
  v_hour uuid;
  v_mid uuid;
  v_past uuid;
  v_edge_in uuid;
  v_edge_out uuid;
  v_hour_in uuid;
  v_hour_out uuid;
  v_opt uuid;
  v_cancelled uuid;
  v_refunded uuid;
  v_attendee_cancelled uuid;
  v_draft uuid;
  v_host_own uuid;
  v_quiet_event uuid;
  v_inbox_event uuid;
  v_ticket uuid;
  v_interested uuid;
  v_zone uuid;
  v_order uuid;
  v_refund_order uuid;
  v_sent integer;
  v_again integer;
  v_notes integer;
  v_title text;
  v_body text;
  v_url text;
  v_html text;
  v_from text;
  v_kind text;
  v_email boolean;
  v_push boolean;
  v_in_app boolean;
  v_seen integer;
  v_cfg text;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'dispatch_attendee_event_reminders'
      AND EXISTS (
        SELECT 1
        FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) cfg
        WHERE cfg LIKE '%search_path=public, extensions%'
      )
  ) THEN
    RAISE EXCEPTION 'FAIL: dispatcher search_path must include public, extensions';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('attendee_event_reminder_sends', 'attendee_event_reminder_pushes', 'attendee_reminder_runtime')
      AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'FAIL: reminder tables must enable RLS';
  END IF;

  INSERT INTO public.events (creator_id, title, city, venue, start_date, timezone, status, is_public)
  VALUES
    (v_host, 'Listening Session', 'Brooklyn', 'The Loft', v_now + interval '24 hours', 'America/Los_Angeles', 'published', true)
  RETURNING id INTO v_day;

  INSERT INTO public.events (creator_id, title, city, venue, start_date, timezone, status, is_public)
  VALUES
    (v_host, 'Soundcheck', 'Brooklyn', 'The Loft', v_now + interval '60 minutes', 'America/New_York', 'published', true)
  RETURNING id INTO v_hour;

  INSERT INTO public.events (creator_id, title, city, venue, start_date, timezone, status, is_public)
  VALUES
    (v_host, 'Too Early', 'Brooklyn', 'The Loft', v_now + interval '12 hours', 'America/New_York', 'published', true)
  RETURNING id INTO v_mid;

  INSERT INTO public.events (creator_id, title, city, venue, start_date, timezone, status, is_public)
  VALUES
    (v_host, 'Already Started', 'Brooklyn', 'The Loft', v_now - interval '1 hour', 'America/New_York', 'published', true)
  RETURNING id INTO v_past;

  INSERT INTO public.events (creator_id, title, city, venue, start_date, timezone, status, is_public)
  VALUES
    (v_host, 'Day Window Open', 'Brooklyn', 'The Loft', v_now + interval '23 hours 30 minutes', 'America/New_York', 'published', true)
  RETURNING id INTO v_edge_in;

  INSERT INTO public.events (creator_id, title, city, venue, start_date, timezone, status, is_public)
  VALUES
    (v_host, 'Day Window Closed', 'Brooklyn', 'The Loft', v_now + interval '24 hours 30 minutes', 'America/New_York', 'published', true)
  RETURNING id INTO v_edge_out;

  INSERT INTO public.events (creator_id, title, city, venue, start_date, timezone, status, is_public)
  VALUES
    (v_host, 'Hour Window Open', 'Brooklyn', 'The Loft', v_now + interval '50 minutes', 'America/New_York', 'published', true)
  RETURNING id INTO v_hour_in;

  INSERT INTO public.events (creator_id, title, city, venue, start_date, timezone, status, is_public)
  VALUES
    (v_host, 'Hour Window Closed', 'Brooklyn', 'The Loft', v_now + interval '70 minutes', 'America/New_York', 'published', true)
  RETURNING id INTO v_hour_out;

  INSERT INTO public.events (creator_id, title, city, venue, start_date, timezone, status, is_public)
  VALUES
    (v_host, 'Opt Out Night', 'Brooklyn', 'The Loft', v_now + interval '24 hours', 'America/New_York', 'published', true)
  RETURNING id INTO v_opt;

  INSERT INTO public.events (creator_id, title, city, venue, start_date, timezone, status, is_public)
  VALUES
    (v_host, 'Called Off', 'Brooklyn', 'The Loft', v_now + interval '24 hours', 'America/New_York', 'cancelled', true)
  RETURNING id INTO v_cancelled;

  INSERT INTO public.events (creator_id, title, city, venue, start_date, timezone, status, is_public)
  VALUES
    (v_host, 'Refunded Show', 'Brooklyn', 'The Loft', v_now + interval '24 hours', 'America/New_York', 'published', true)
  RETURNING id INTO v_refunded;

  INSERT INTO public.events (creator_id, title, city, venue, start_date, timezone, status, is_public)
  VALUES
    (v_host, 'Seat Cancelled', 'Brooklyn', 'The Loft', v_now + interval '24 hours', 'America/New_York', 'published', true)
  RETURNING id INTO v_attendee_cancelled;

  INSERT INTO public.events (creator_id, title, city, venue, start_date, timezone, status, is_public)
  VALUES
    (v_host, 'Still a Draft', 'Brooklyn', 'The Loft', v_now + interval '24 hours', 'America/New_York', 'draft', true)
  RETURNING id INTO v_draft;

  INSERT INTO public.events (creator_id, title, city, venue, start_date, timezone, status, is_public)
  VALUES
    (v_host, 'Host Only', 'Brooklyn', 'The Loft', v_now + interval '24 hours', 'America/New_York', 'published', true)
  RETURNING id INTO v_host_own;

  INSERT INTO public.events (creator_id, title, city, venue, start_date, timezone, status, is_public)
  VALUES
    (v_host, 'Quiet Night', 'Brooklyn', 'The Loft', v_now + interval '24 hours', 'America/New_York', 'published', true)
  RETURNING id INTO v_quiet_event;

  INSERT INTO public.events (creator_id, title, city, venue, start_date, timezone, status, is_public)
  VALUES
    (v_host, 'No Mail', 'Brooklyn', 'The Loft', v_now + interval '24 hours', 'America/New_York', 'published', true)
  RETURNING id INTO v_inbox_event;

  INSERT INTO public.events (creator_id, title, city, venue, start_date, timezone, status, is_public)
  VALUES
    (v_host, 'Ticketed Night', 'Brooklyn', 'The Loft', v_now + interval '24 hours', 'America/New_York', 'published', true)
  RETURNING id INTO v_ticket;

  INSERT INTO public.events (creator_id, title, city, venue, start_date, timezone, status, is_public)
  VALUES
    (v_host, 'Just Looking', 'Brooklyn', 'The Loft', v_now + interval '24 hours', 'America/New_York', 'published', true)
  RETURNING id INTO v_interested;

  INSERT INTO public.events (creator_id, title, city, venue, start_date, timezone, status, is_public)
  VALUES
    (v_host, 'Pacific Set', 'Los Angeles', 'The Bowl', timestamptz '2026-11-01 01:00:00+00', 'America/Los_Angeles', 'published', true)
  RETURNING id INTO v_zone;

  INSERT INTO public.event_rsvps (event_id, user_id, status) VALUES
    (v_day, v_guest, 'going'),
    (v_hour, v_other, 'going'),
    (v_mid, v_guest, 'going'),
    (v_past, v_guest, 'going'),
    (v_edge_in, v_guest, 'going'),
    (v_edge_out, v_guest, 'going'),
    (v_hour_in, v_other, 'going'),
    (v_hour_out, v_other, 'going'),
    (v_opt, v_guest, 'going'),
    (v_cancelled, v_guest, 'going'),
    (v_draft, v_guest, 'going'),
    (v_host_own, v_host, 'going'),
    (v_quiet_event, v_quiet, 'going'),
    (v_inbox_event, v_inbox, 'going'),
    (v_interested, v_guest, 'interested'),
    (v_zone, v_guest, 'going'),
    (v_attendee_cancelled, v_guest, 'going');

  INSERT INTO public.ticket_orders (event_id, purchaser_user_id, purchaser_email, payment_status, quantity)
  VALUES (v_ticket, v_guest, 'guest@example.com', 'paid', 1)
  RETURNING id INTO v_order;

  INSERT INTO public.event_rsvps (event_id, user_id, status, ticket_purchased)
  VALUES (v_ticket, v_guest, 'going', true);

  UPDATE public.event_attendees
  SET order_id = v_order
  WHERE event_id = v_ticket
    AND attendee_user_id = v_guest;

  INSERT INTO public.ticket_orders (event_id, purchaser_user_id, purchaser_email, payment_status, quantity)
  VALUES (v_refunded, v_guest, 'guest@example.com', 'refunded', 1)
  RETURNING id INTO v_refund_order;

  INSERT INTO public.event_rsvps (event_id, user_id, status, ticket_purchased)
  VALUES (v_refunded, v_guest, 'going', true);

  UPDATE public.event_attendees
  SET order_id = v_refund_order,
      status = 'registered'
  WHERE event_id = v_refunded
    AND attendee_user_id = v_guest;

  UPDATE public.event_attendees
  SET status = 'cancelled'
  WHERE event_id = v_attendee_cancelled
    AND attendee_user_id = v_guest;

  PERFORM set_config('request.jwt.claim.sub', v_guest::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  IF public.my_event_reminder_enabled(v_opt) IS NOT TRUE THEN
    RAISE EXCEPTION 'FAIL: reminder toggle should default on for a going RSVP';
  END IF;
  IF public.set_my_event_reminder(v_opt, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'FAIL: attendee could not turn reminders off';
  END IF;
  IF public.my_event_reminder_enabled(v_opt) IS NOT FALSE THEN
    RAISE EXCEPTION 'FAIL: reminder toggle stayed on after opt-out';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.event_attendees
    WHERE event_id = v_opt
      AND attendee_user_id = v_guest
      AND reminder_enabled IS DISTINCT FROM false
  ) THEN
    RAISE EXCEPTION 'FAIL: opt-out did not reach the attendee row';
  END IF;
  PERFORM set_config('request.jwt.claim.sub', '', true);

  v_sent := public.dispatch_attendee_event_reminders(v_now);

  SELECT title, body, ticket_url, email_html, email_from, reminder_kind, email_queued, push_queued, in_app
  INTO v_title, v_body, v_url, v_html, v_from, v_kind, v_email, v_push, v_in_app
  FROM public.attendee_event_reminder_sends
  WHERE event_id = v_day
    AND recipient_key = 'user:' || v_guest::text;

  IF v_kind IS DISTINCT FROM '24h' THEN
    RAISE EXCEPTION 'FAIL: 24h window did not send, got %', v_kind;
  END IF;
  IF v_title NOT LIKE 'Cadre House:%' OR v_title ILIKE 'ether%' THEN
    RAISE EXCEPTION 'FAIL: host name should lead the title, got %', v_title;
  END IF;
  IF v_title NOT LIKE '%Listening Session%' OR v_body NOT LIKE '%Listening Session%' THEN
    RAISE EXCEPTION 'FAIL: reminder missing the event name';
  END IF;
  IF v_body NOT LIKE '%8:00 AM%' THEN
    RAISE EXCEPTION 'FAIL: 24h reminder ignored America/Los_Angeles, body %', v_body;
  END IF;
  IF v_body NOT LIKE '%The Loft, Brooklyn%' THEN
    RAISE EXCEPTION 'FAIL: reminder missing the venue, body %', v_body;
  END IF;
  IF v_url IS DISTINCT FROM 'https://etherbylcove.com/event/' || v_day::text THEN
    RAISE EXCEPTION 'FAIL: free RSVP ticket link was %', v_url;
  END IF;
  IF v_body NOT LIKE '%' || v_url || '%' THEN
    RAISE EXCEPTION 'FAIL: body missing the ticket link';
  END IF;
  IF v_in_app IS NOT TRUE OR v_email IS NOT TRUE OR v_push IS NOT TRUE THEN
    RAISE EXCEPTION 'FAIL: expected in-app, email, and push for the guest';
  END IF;
  IF v_from NOT LIKE 'Cadre House via Ether <events@etherbylcove.com>' THEN
    RAISE EXCEPTION 'FAIL: from header was %', v_from;
  END IF;
  IF v_html NOT LIKE '%Powered by Ether%' OR v_html ILIKE '%ETHER by lcove%' THEN
    RAISE EXCEPTION 'FAIL: email footer should keep Ether secondary';
  END IF;
  IF (
    SELECT count(*) FROM public.notifications
    WHERE user_id = v_guest AND type = 'event_reminder' AND data->>'event_id' = v_day::text
  ) <> 1 THEN
    RAISE EXCEPTION 'FAIL: expected one in-app reminder for the day-before event';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.attendee_event_reminder_pushes
    WHERE event_id = v_day AND user_id = v_guest AND sent_at IS NULL AND url = v_url
  ) THEN
    RAISE EXCEPTION 'FAIL: push payload was not queued';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.attendee_event_reminder_sends
    WHERE event_id = v_hour AND reminder_kind = '1h' AND recipient_key = 'user:' || v_other::text
  ) THEN
    RAISE EXCEPTION 'FAIL: 1h window did not send';
  END IF;

  IF EXISTS (SELECT 1 FROM public.attendee_event_reminder_sends WHERE event_id IN (v_mid, v_past, v_edge_out, v_hour_out)) THEN
    RAISE EXCEPTION 'FAIL: sent outside the 24h or 1h window, or for a past event';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.attendee_event_reminder_sends
    WHERE event_id = v_edge_in AND reminder_kind = '24h'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.attendee_event_reminder_sends
    WHERE event_id = v_hour_in AND reminder_kind = '1h'
  ) THEN
    RAISE EXCEPTION 'FAIL: open edge of a window was skipped';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.attendee_event_reminder_sends
    WHERE event_id IN (v_opt, v_cancelled, v_refunded, v_attendee_cancelled, v_draft, v_host_own, v_quiet_event, v_interested)
  ) THEN
    RAISE EXCEPTION 'FAIL: sent for opt-out, cancelled, refunded, draft, host, quiet, or interested';
  END IF;

  SELECT ticket_url, email_queued, push_queued
  INTO v_url, v_email, v_push
  FROM public.attendee_event_reminder_sends
  WHERE event_id = v_ticket AND recipient_key = 'user:' || v_guest::text;

  IF v_url IS DISTINCT FROM 'https://etherbylcove.com/event/' || v_ticket::text || '/confirmation?order_id=' || v_order::text THEN
    RAISE EXCEPTION 'FAIL: paid ticket link was %', v_url;
  END IF;
  IF (
    SELECT count(*) FROM public.notifications
    WHERE user_id = v_guest AND data->>'event_id' = v_ticket::text
  ) <> 1 THEN
    RAISE EXCEPTION 'FAIL: two tickets or a duplicate claim created two notices';
  END IF;

  SELECT in_app, email_queued, push_queued
  INTO v_in_app, v_email, v_push
  FROM public.attendee_event_reminder_sends
  WHERE event_id = v_inbox_event;

  IF v_in_app IS NOT TRUE OR v_email IS NOT FALSE OR v_push IS NOT FALSE THEN
    RAISE EXCEPTION 'FAIL: global email and push switches were ignored (in_app %, email %, push %)', v_in_app, v_email, v_push;
  END IF;

  SELECT count(*) INTO v_notes FROM public.notifications WHERE user_id = v_guest AND type = 'event_reminder';
  v_again := public.dispatch_attendee_event_reminders(v_now);
  IF v_again <> 0 THEN
    RAISE EXCEPTION 'FAIL: second run sent % more reminders', v_again;
  END IF;
  IF (SELECT count(*) FROM public.notifications WHERE user_id = v_guest AND type = 'event_reminder') <> v_notes THEN
    RAISE EXCEPTION 'FAIL: second run duplicated an in-app reminder';
  END IF;
  IF v_sent < 1 THEN
    RAISE EXCEPTION 'FAIL: first run claimed nothing';
  END IF;

  v_again := public.dispatch_attendee_event_reminders(timestamptz '2026-10-31 01:00:00+00');
  SELECT body INTO v_body
  FROM public.attendee_event_reminder_sends
  WHERE event_id = v_zone AND reminder_kind = '24h';
  IF v_body IS NULL OR v_body NOT LIKE '%6:00 PM%' OR v_body LIKE '%1:00 AM%' THEN
    RAISE EXCEPTION 'FAIL: event timezone was not used, body %', v_body;
  END IF;
  IF v_again <> 1 THEN
    RAISE EXCEPTION 'FAIL: timezone event should be the only new send, got %', v_again;
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_guest::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  EXECUTE 'SET ROLE authenticated';
  SELECT count(*) INTO v_seen FROM public.attendee_event_reminder_sends;
  IF v_seen = 0 THEN
    RAISE EXCEPTION 'FAIL: attendee could not read their own reminder rows';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.attendee_event_reminder_sends
    WHERE recipient_key IS DISTINCT FROM 'user:' || v_guest::text
  ) THEN
    RAISE EXCEPTION 'FAIL: attendee could read someone else''s reminder rows';
  END IF;
  BEGIN
    INSERT INTO public.attendee_event_reminder_sends (
      event_id, recipient_key, reminder_kind, title, body, ticket_url, path
    ) VALUES (
      v_day, 'user:' || v_guest::text, '1h', 'x', 'x', 'https://etherbylcove.com/event/' || v_day::text, '/event/' || v_day::text
    );
    RAISE EXCEPTION 'FAIL: attendee inserted a reminder send';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;
  EXECUTE 'RESET ROLE';

  BEGIN
    EXECUTE 'SET ROLE authenticated';
    PERFORM public.dispatch_attendee_event_reminders(v_now);
    RAISE EXCEPTION 'FAIL: authenticated role ran the dispatcher';
  EXCEPTION
    WHEN insufficient_privilege THEN
      EXECUTE 'RESET ROLE';
  END;

  SELECT string_agg(cfg, ',') INTO v_cfg
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  CROSS JOIN LATERAL unnest(COALESCE(p.proconfig, ARRAY[]::text[])) cfg
  WHERE n.nspname = 'public'
    AND p.proname = 'dispatch_attendee_event_reminders';
  IF v_cfg NOT LIKE '%search_path=public, extensions, pg_temp%' THEN
    RAISE EXCEPTION 'FAIL: dispatcher search_path is %', v_cfg;
  END IF;
END
$$;

SELECT 'attendee reminder checks passed' AS result;
