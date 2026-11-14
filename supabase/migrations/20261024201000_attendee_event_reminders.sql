-- Attendee reminders for someone else's event.
--
-- What already existed, and what it did not do:
--   event_rsvps.reminder_enabled defaults on. The calendar dialog can flip it.
--   notification_preferences.event_reminders_enabled, email_enabled, and
--   push_enabled are the global switches. send-push-notification and
--   send-notification-email honor them when notification_type is event_reminder.
--   notifications.type includes event_reminder. The transactional email queue
--   is enqueue_email('transactional_emails', ...). Push is send-push-notification.
--   auto-event-reminders is an edge function. Prod can POST it from the
--   dashboard cron (x-internal-secret). It is not scheduled in a migration.
--   Its windows are 1 week, 24h, 2h, and start time. There is no 1h window.
--   It looks for attendee statuses confirmed and checked_in, which are not
--   real statuses, so a ticket holder never matched. It does not skip
--   cancelled events or cancelled/refunded orders. In-app rows ignore the
--   global switch. The dedupe read-then-insert on event_reminder_log can
--   double-send. Host event_auto_reminders toggles default off in the UI
--   and are a separate host broadcast, not this attendee reminder.
--
-- This job sends about 24h before and about 1h before, in the event's
-- timezone for the clock on the message. The instant is start_date
-- (timestamptz). pg_cron runs the SQL function every minute. The same
-- function is what auto-event-reminders calls, so the dashboard cron and
-- this job share one idempotent claim.

ALTER TABLE public.event_attendees
  ADD COLUMN IF NOT EXISTS reminder_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.event_attendees.reminder_enabled IS
  'Per-event reminder switch for this attendee. Default on. A false RSVP switch for the same person also suppresses the send.';

CREATE TABLE IF NOT EXISTS public.attendee_event_reminder_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  recipient_key text NOT NULL,
  reminder_kind text NOT NULL CHECK (reminder_kind IN ('24h', '1h')),
  user_id uuid,
  email text,
  title text NOT NULL,
  body text NOT NULL,
  ticket_url text NOT NULL,
  path text NOT NULL,
  email_from text,
  email_subject text,
  email_html text,
  in_app boolean NOT NULL DEFAULT false,
  email_queued boolean NOT NULL DEFAULT false,
  push_queued boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, recipient_key, reminder_kind)
);

COMMENT ON TABLE public.attendee_event_reminder_sends IS
  'One row per attendee per event per window. The unique key is the idempotency claim.';

CREATE INDEX IF NOT EXISTS idx_attendee_event_reminder_sends_event
  ON public.attendee_event_reminder_sends (event_id, reminder_kind);

ALTER TABLE public.attendee_event_reminder_sends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read their own reminder sends" ON public.attendee_event_reminder_sends;
CREATE POLICY "Members read their own reminder sends"
  ON public.attendee_event_reminder_sends
  FOR SELECT
  TO authenticated
  USING (recipient_key = 'user:' || auth.uid()::text);

REVOKE ALL ON TABLE public.attendee_event_reminder_sends FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.attendee_event_reminder_sends TO authenticated;
GRANT ALL ON TABLE public.attendee_event_reminder_sends TO service_role;

CREATE TABLE IF NOT EXISTS public.attendee_event_reminder_pushes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  send_id uuid NOT NULL UNIQUE REFERENCES public.attendee_event_reminder_sends(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

COMMENT ON TABLE public.attendee_event_reminder_pushes IS
  'Push payloads for send-push-notification. auto-event-reminders drains sent_at IS NULL.';

CREATE INDEX IF NOT EXISTS idx_attendee_event_reminder_pushes_unsent
  ON public.attendee_event_reminder_pushes (created_at)
  WHERE sent_at IS NULL;

ALTER TABLE public.attendee_event_reminder_pushes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.attendee_event_reminder_pushes FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.attendee_event_reminder_pushes TO service_role;

-- Optional wake for the existing auto-event-reminders function so queued
-- pushes leave in the same minute. Leave the row empty until the function
-- URL and x-internal-secret are set outside this migration. No secret here.
CREATE TABLE IF NOT EXISTS public.attendee_reminder_runtime (
  id integer PRIMARY KEY CHECK (id = 1),
  push_url text,
  push_secret text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.attendee_reminder_runtime ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.attendee_reminder_runtime FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.attendee_reminder_runtime TO service_role;

CREATE OR REPLACE FUNCTION public.event_local_stamp(p_instant timestamptz, p_zone text)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_zone text := 'UTC';
BEGIN
  IF p_zone IS NOT NULL AND EXISTS (
    SELECT 1 FROM pg_timezone_names WHERE name = p_zone
  ) THEN
    v_zone := p_zone;
  END IF;
  RETURN to_char(p_instant AT TIME ZONE v_zone, 'Dy, Mon FMDD')
    || ' '
    || to_char(p_instant AT TIME ZONE v_zone, 'FMHH12:MI AM');
END;
$$;

REVOKE ALL ON FUNCTION public.event_local_stamp(timestamptz, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.event_local_stamp(timestamptz, text) TO service_role;

-- Copy the RSVP switch onto the attendee row the guest-list trigger inserts.
CREATE OR REPLACE FUNCTION public.copy_event_reminder_pref()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_enabled boolean;
BEGIN
  SELECT r.reminder_enabled INTO v_enabled
  FROM public.event_rsvps r
  WHERE (NEW.rsvp_id IS NOT NULL AND r.id = NEW.rsvp_id)
     OR (
       NEW.attendee_user_id IS NOT NULL
       AND r.event_id = NEW.event_id
       AND r.user_id = NEW.attendee_user_id
     )
  ORDER BY CASE WHEN NEW.rsvp_id IS NOT NULL AND r.id = NEW.rsvp_id THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_enabled IS NOT NULL THEN
    NEW.reminder_enabled := v_enabled;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS event_attendees_copy_reminder ON public.event_attendees;
CREATE TRIGGER event_attendees_copy_reminder
  BEFORE INSERT ON public.event_attendees
  FOR EACH ROW
  EXECUTE FUNCTION public.copy_event_reminder_pref();

CREATE OR REPLACE FUNCTION public.sync_event_reminder_pref()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.reminder_enabled IS NOT DISTINCT FROM OLD.reminder_enabled THEN
    RETURN NEW;
  END IF;

  UPDATE public.event_attendees
  SET reminder_enabled = COALESCE(NEW.reminder_enabled, true),
      updated_at = now()
  WHERE event_id = NEW.event_id
    AND (
      rsvp_id = NEW.id
      OR (NEW.user_id IS NOT NULL AND attendee_user_id = NEW.user_id)
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS event_rsvps_sync_reminder ON public.event_rsvps;
CREATE TRIGGER event_rsvps_sync_reminder
  AFTER INSERT OR UPDATE OF reminder_enabled ON public.event_rsvps
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_event_reminder_pref();

CREATE OR REPLACE FUNCTION public.my_event_reminder_enabled(p_event_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_live boolean := false;
  v_rsvp boolean;
  v_attendee boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.events e
    WHERE e.id = p_event_id
      AND e.status IS DISTINCT FROM 'cancelled'
      AND (
        EXISTS (
          SELECT 1
          FROM public.event_rsvps r
          WHERE r.event_id = e.id
            AND r.user_id = v_uid
            AND r.status = 'going'
            AND (
              NOT COALESCE(r.ticket_purchased, false)
              OR EXISTS (
                SELECT 1
                FROM public.ticket_orders o
                WHERE o.event_id = e.id
                  AND o.purchaser_user_id = v_uid
                  AND o.payment_status IN ('paid', 'partial_refund')
              )
            )
        )
        OR EXISTS (
          SELECT 1
          FROM public.event_attendees a
          LEFT JOIN public.ticket_orders o ON o.id = a.order_id
          WHERE a.event_id = e.id
            AND a.attendee_user_id = v_uid
            AND a.status IN ('registered', 'approved')
            AND (a.order_id IS NULL OR o.payment_status IN ('paid', 'partial_refund'))
        )
      )
  ) INTO v_live;

  IF NOT v_live THEN
    RETURN NULL;
  END IF;

  SELECT bool_and(COALESCE(r.reminder_enabled, true))
  INTO v_rsvp
  FROM public.event_rsvps r
  WHERE r.event_id = p_event_id
    AND r.user_id = v_uid
    AND r.status = 'going';

  SELECT bool_and(COALESCE(a.reminder_enabled, true))
  INTO v_attendee
  FROM public.event_attendees a
  WHERE a.event_id = p_event_id
    AND a.attendee_user_id = v_uid
    AND a.status IN ('registered', 'approved');

  RETURN COALESCE(v_rsvp, true) AND COALESCE(v_attendee, true);
END;
$$;

REVOKE ALL ON FUNCTION public.my_event_reminder_enabled(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_event_reminder_enabled(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_my_event_reminder(p_event_id uuid, p_enabled boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_count integer := 0;
  v_n integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  UPDATE public.event_rsvps
  SET reminder_enabled = p_enabled,
      updated_at = now()
  WHERE event_id = p_event_id
    AND user_id = v_uid;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_count := v_n;

  UPDATE public.event_attendees a
  SET reminder_enabled = p_enabled,
      updated_at = now()
  WHERE a.event_id = p_event_id
    AND (
      a.attendee_user_id = v_uid
      OR (
        a.attendee_user_id IS NULL
        AND EXISTS (
          SELECT 1
          FROM public.ticket_orders o
          WHERE o.id = a.order_id
            AND o.purchaser_user_id = v_uid
        )
      )
    );
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_count := v_count + v_n;

  RETURN v_count > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.set_my_event_reminder(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_my_event_reminder(uuid, boolean) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.dispatch_attendee_event_reminders(p_now timestamptz DEFAULT now())
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  rec record;
  v_count integer := 0;
  v_send_id uuid;
  v_host text;
  v_when text;
  v_venue text;
  v_path text;
  v_url text;
  v_title text;
  v_body text;
  v_from text;
  v_html text;
  v_reply text;
  v_email_ok boolean;
  v_push_ok boolean;
  v_in_app boolean;
  v_payload jsonb;
  v_wake_url text;
  v_wake_secret text;
BEGIN
  IF p_now IS NULL THEN
    p_now := now();
  END IF;

  FOR rec IN
    WITH windows AS (
      SELECT '24h'::text AS reminder_kind,
             p_now + interval '23 hours 30 minutes' AS window_start,
             p_now + interval '24 hours 30 minutes' AS window_end
      UNION ALL
      SELECT '1h'::text,
             p_now + interval '50 minutes',
             p_now + interval '70 minutes'
    ),
    live_events AS (
      SELECT e.id,
             e.title,
             e.start_date,
             e.timezone,
             e.venue,
             e.city,
             e.creator_id,
             w.reminder_kind
      FROM public.events e
      JOIN windows w
        ON e.start_date >= w.window_start
       AND e.start_date < w.window_end
      WHERE e.start_date > p_now
        AND e.status IS DISTINCT FROM 'cancelled'
        AND e.status IS DISTINCT FROM 'draft'
    ),
    seats AS (
      SELECT
        e.id AS event_id,
        e.reminder_kind,
        e.title AS event_title,
        e.start_date,
        e.timezone,
        e.venue,
        e.city,
        a.attendee_user_id AS user_id,
        NULLIF(lower(btrim(COALESCE(a.attendee_email, u.email))), '') AS email,
        a.order_id,
        COALESCE(NULLIF(btrim(b.organizer_name), ''), NULLIF(btrim(pr.display_name), ''), 'Your host') AS host_name
      FROM live_events e
      JOIN public.event_attendees a ON a.event_id = e.id
      LEFT JOIN public.ticket_orders o ON o.id = a.order_id
      LEFT JOIN public.event_rsvps r
        ON r.event_id = a.event_id
       AND r.user_id = a.attendee_user_id
      LEFT JOIN auth.users u ON u.id = a.attendee_user_id
      LEFT JOIN public.event_email_branding b ON b.event_id = e.id
      LEFT JOIN public.profiles pr ON pr.user_id = e.creator_id
      WHERE a.status IN ('registered', 'approved')
        AND (a.order_id IS NULL OR o.payment_status IN ('paid', 'partial_refund'))
        AND a.attendee_user_id IS DISTINCT FROM e.creator_id
        AND COALESCE(a.reminder_enabled, true)
        AND COALESCE(r.reminder_enabled, true)
        AND (
          NOT COALESCE(r.ticket_purchased, false)
          OR EXISTS (
            SELECT 1
            FROM public.ticket_orders live_order
            WHERE live_order.event_id = a.event_id
              AND live_order.purchaser_user_id = a.attendee_user_id
              AND live_order.payment_status IN ('paid', 'partial_refund')
          )
        )

      UNION ALL

      SELECT
        e.id,
        e.reminder_kind,
        e.title,
        e.start_date,
        e.timezone,
        e.venue,
        e.city,
        r.user_id,
        NULLIF(lower(btrim(COALESCE(r.guest_email, u.email))), ''),
        NULL::uuid,
        COALESCE(NULLIF(btrim(b.organizer_name), ''), NULLIF(btrim(pr.display_name), ''), 'Your host')
      FROM live_events e
      JOIN public.event_rsvps r ON r.event_id = e.id
      LEFT JOIN auth.users u ON u.id = r.user_id
      LEFT JOIN public.event_email_branding b ON b.event_id = e.id
      LEFT JOIN public.profiles pr ON pr.user_id = e.creator_id
      WHERE r.status = 'going'
        AND NOT COALESCE(r.ticket_purchased, false)
        AND COALESCE(r.reminder_enabled, true)
        AND r.user_id IS DISTINCT FROM e.creator_id
        AND NOT EXISTS (
          SELECT 1
          FROM public.event_attendees a
          WHERE a.event_id = r.event_id
            AND (
              a.rsvp_id = r.id
              OR (r.user_id IS NOT NULL AND a.attendee_user_id = r.user_id)
            )
        )
    ),
    picked AS (
      SELECT DISTINCT ON (event_id, recipient_key, reminder_kind)
        event_id,
        reminder_kind,
        event_title,
        start_date,
        timezone,
        venue,
        city,
        user_id,
        email,
        order_id,
        host_name,
        recipient_key
      FROM (
        SELECT s.*,
          CASE
            WHEN s.user_id IS NOT NULL THEN 'user:' || s.user_id::text
            WHEN s.email IS NOT NULL THEN 'email:' || s.email
            ELSE NULL
          END AS recipient_key
        FROM seats s
      ) keyed
      WHERE recipient_key IS NOT NULL
      ORDER BY event_id, recipient_key, reminder_kind, order_id NULLS LAST
    )
    SELECT
      p.event_id,
      p.reminder_kind,
      p.event_title,
      p.start_date,
      p.timezone,
      p.venue,
      p.city,
      p.user_id,
      p.email,
      p.order_id,
      p.host_name,
      p.recipient_key,
      CASE
        WHEN p.user_id IS NULL THEN true
        ELSE COALESCE(prefs.email_enabled, true)
      END AS email_on,
      CASE
        WHEN p.user_id IS NULL THEN false
        ELSE COALESCE(prefs.push_enabled, true)
      END AS push_on
    FROM picked p
    LEFT JOIN public.notification_preferences prefs ON prefs.user_id = p.user_id
    WHERE p.user_id IS NULL
       OR COALESCE(prefs.event_reminders_enabled, true)
  LOOP
    BEGIN
      v_send_id := NULL;
      v_host := left(btrim(regexp_replace(COALESCE(rec.host_name, ''), '[<>@",;\r\n]+', ' ', 'g')), 60);
      IF v_host IS NULL OR v_host = '' THEN
        v_host := 'Your host';
      END IF;

      v_when := public.event_local_stamp(rec.start_date, rec.timezone);
      v_venue := NULLIF(btrim(concat_ws(', ',
        NULLIF(btrim(COALESCE(rec.venue, '')), ''),
        NULLIF(btrim(COALESCE(rec.city, '')), '')
      )), '');
      IF v_venue IS NULL THEN
        v_venue := 'Location to follow';
      END IF;

      v_path := CASE
        WHEN rec.order_id IS NOT NULL THEN '/event/' || rec.event_id::text || '/confirmation?order_id=' || rec.order_id::text
        ELSE '/event/' || rec.event_id::text
      END;
      v_url := 'https://etherbylcove.com' || v_path;
      v_title := v_host || ': ' || rec.event_title;
      v_body := rec.event_title || ' · ' || v_when || ' · ' || v_venue || '. Ticket: ' || v_url;
      v_from := v_host || ' via Ether <events@etherbylcove.com>';

      v_in_app := rec.user_id IS NOT NULL;
      v_email_ok := rec.email IS NOT NULL
        AND rec.email_on
        AND NOT EXISTS (
          SELECT 1 FROM public.suppressed_emails s WHERE lower(s.email) = rec.email
        );
      v_push_ok := rec.user_id IS NOT NULL
        AND rec.push_on
        AND EXISTS (
          SELECT 1 FROM public.push_subscriptions ps WHERE ps.user_id = rec.user_id
        );

      IF NOT v_in_app AND NOT v_email_ok AND NOT v_push_ok THEN
        CONTINUE;
      END IF;

      v_reply := NULL;
      SELECT NULLIF(btrim(b.reply_to_email), '')
      INTO v_reply
      FROM public.event_email_branding b
      WHERE b.event_id = rec.event_id
        AND b.reply_to_verified_at IS NOT NULL;

      v_html := NULL;
      IF v_email_ok THEN
        v_html :=
          '<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#1a1a2e;">'
          || '<p style="margin:0;font-size:18px;font-weight:700;">'
          || replace(replace(replace(v_host, '&', '&amp;'), '<', '&lt;'), '>', '&gt;')
          || '</p>'
          || '<h1 style="margin:16px 0 4px;font-size:26px;">'
          || replace(replace(replace(rec.event_title, '&', '&amp;'), '<', '&lt;'), '>', '&gt;')
          || '</h1>'
          || '<p style="margin:0 0 8px;color:#444;">'
          || replace(replace(replace(v_when, '&', '&amp;'), '<', '&lt;'), '>', '&gt;')
          || '</p>'
          || '<p style="margin:0 0 12px;color:#333;">'
          || replace(replace(replace(v_venue, '&', '&amp;'), '<', '&lt;'), '>', '&gt;')
          || '</p>'
          || '<p style="margin:0 0 16px;"><a href="'
          || replace(replace(replace(v_url, '&', '&amp;'), '<', '&lt;'), '>', '&gt;')
          || '">Your ticket</a></p>'
          || '<p style="color:#9a9a9a;font-size:11px;text-align:center;">Powered by Ether</p>'
          || '</div>';
      END IF;

      INSERT INTO public.attendee_event_reminder_sends (
        event_id, recipient_key, reminder_kind, user_id, email,
        title, body, ticket_url, path, email_from, email_subject, email_html,
        in_app, email_queued, push_queued
      ) VALUES (
        rec.event_id, rec.recipient_key, rec.reminder_kind, rec.user_id, rec.email,
        v_title, v_body, v_url, v_path, v_from, v_title, v_html,
        v_in_app, false, false
      )
      ON CONFLICT (event_id, recipient_key, reminder_kind) DO NOTHING
      RETURNING id INTO v_send_id;

      IF v_send_id IS NULL THEN
        CONTINUE;
      END IF;

      IF v_in_app THEN
        INSERT INTO public.notifications (user_id, type, title, body, data)
        VALUES (
          rec.user_id,
          'event_reminder',
          v_title,
          v_body,
          jsonb_build_object(
            'event_id', rec.event_id,
            'reminder_kind', rec.reminder_kind,
            'path', v_path,
            'ticket_url', v_url
          )
        );
      END IF;

      IF v_email_ok THEN
        v_payload := jsonb_build_object(
          'message_id', pg_catalog.gen_random_uuid()::text,
          'to', rec.email,
          'from', v_from,
          'subject', v_title,
          'html', v_html,
          'text', v_body,
          'purpose', 'transactional',
          'label', 'attendee-event-reminder',
          'idempotency_key', 'attendee-reminder-' || rec.event_id::text || '-' || rec.recipient_key || '-' || rec.reminder_kind,
          'queued_at', p_now
        );
        -- Reply-To only after the host address is verified.
        IF v_reply IS NOT NULL THEN
          v_payload := v_payload || jsonb_build_object('reply_to', v_reply);
        END IF;
        PERFORM public.enqueue_email('transactional_emails', v_payload);
        UPDATE public.attendee_event_reminder_sends
        SET email_queued = true
        WHERE id = v_send_id;
      END IF;

      IF v_push_ok THEN
        INSERT INTO public.attendee_event_reminder_pushes (
          send_id, user_id, event_id, title, body, url
        ) VALUES (
          v_send_id, rec.user_id, rec.event_id, v_title, v_body, v_url
        );
        UPDATE public.attendee_event_reminder_sends
        SET push_queued = true
        WHERE id = v_send_id;
      END IF;

      INSERT INTO public.event_reminder_log (
        event_id, reminder_type, recipient_email, recipient_count, sent_by
      ) VALUES (
        rec.event_id, rec.reminder_kind, rec.email, 1, NULL
      );

      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'attendee reminder skipped for % %: %', rec.event_id, rec.recipient_key, SQLERRM;
    END;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM public.attendee_event_reminder_pushes WHERE sent_at IS NULL
  ) THEN
    SELECT push_url, push_secret INTO v_wake_url, v_wake_secret
    FROM public.attendee_reminder_runtime
    WHERE id = 1;

    IF v_wake_url IS NOT NULL AND v_wake_secret IS NOT NULL THEN
      BEGIN
        PERFORM net.http_post(
          url := v_wake_url,
          body := '{}'::jsonb,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-internal-secret', v_wake_secret
          ),
          timeout_milliseconds := 2000
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'attendee reminder push wake was not sent: %', SQLERRM;
      END;
    END IF;
  END IF;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.dispatch_attendee_event_reminders(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dispatch_attendee_event_reminders(timestamptz) TO service_role;

-- No secrets in the command. The dashboard cron that POSTs auto-event-reminders
-- can stay; that function calls this same claim, so the two jobs do not double-send.
DO $cron$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'attendee-event-reminders') THEN
    PERFORM cron.unschedule('attendee-event-reminders');
  END IF;
  PERFORM cron.schedule(
    'attendee-event-reminders',
    '* * * * *',
    $job$SELECT public.dispatch_attendee_event_reminders()$job$
  );
EXCEPTION
  WHEN undefined_table OR undefined_object OR undefined_function OR invalid_schema_name OR insufficient_privilege THEN
    RAISE NOTICE 'attendee-event-reminders was not scheduled: %', SQLERRM;
END
$cron$;
