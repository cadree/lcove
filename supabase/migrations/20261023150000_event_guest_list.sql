-- One guest list for free RSVPs and ticket orders.
--
-- Host screens read event_attendees. Free RSVPs only wrote event_rsvps, so a
-- host could see "2 attending" from the public count and "No attendees" on
-- the Attendees tab. This migration:
--   1. Links each RSVP to an attendee row and backfills the rows that are missing.
--   2. Keeps them in sync with a trigger.
--   3. Takes a seat under a row lock. A full event waitlists the new RSVP
--      instead of letting them in. People already over capacity stay; we do
--      not delete or demote them.
--
-- Apply this file yourself. It does not run against a database from the app.

ALTER TABLE public.event_attendees
  ADD COLUMN IF NOT EXISTS rsvp_id uuid REFERENCES public.event_rsvps(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS event_attendees_rsvp_id_unique
  ON public.event_attendees (rsvp_id) WHERE rsvp_id IS NOT NULL;

ALTER TABLE public.event_rsvps
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.notification_campaigns(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_event_rsvps_campaign ON public.event_rsvps (campaign_id);

ALTER TABLE public.notification_logs
  ADD COLUMN IF NOT EXISTS track_token text;

CREATE UNIQUE INDEX IF NOT EXISTS notification_logs_track_token_unique
  ON public.notification_logs (track_token) WHERE track_token IS NOT NULL;

-- Seats are registered or approved attendee rows. Waitlist, interested, and
-- cancelled rows do not take a seat. Check-in lives in event_check_ins.

CREATE OR REPLACE FUNCTION public.event_seat_count(p_event_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT COUNT(*)::integer
    FROM public.event_attendees a
    WHERE a.event_id = p_event_id
      AND a.status IN ('registered', 'approved')
  ), 0);
$$;

REVOKE ALL ON FUNCTION public.event_seat_count(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_seat_count(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.public_event_attendance_count(p_event_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = p_event_id
        AND (
          e.is_public = true
          OR e.creator_id = auth.uid()
          OR public.has_role(auth.uid(), 'admin')
          OR public.can_manage_event(e.id, auth.uid())
          OR EXISTS (
            SELECT 1 FROM public.event_rsvps mine
            WHERE mine.event_id = e.id AND mine.user_id = auth.uid()
          )
        )
    ) THEN public.event_seat_count(p_event_id)
    ELSE 0
  END;
$$;

REVOKE ALL ON FUNCTION public.public_event_attendance_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_event_attendance_count(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.host_event_attendance_counts(p_event_ids uuid[])
RETURNS TABLE (event_id uuid, going integer, waitlist integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id,
    public.event_seat_count(e.id),
    COALESCE((
      SELECT COUNT(*)::integer FROM public.event_attendees a
      WHERE a.event_id = e.id AND a.status = 'waitlisted'
    ), 0)
  FROM public.events e
  WHERE e.id = ANY(p_event_ids)
    AND (
      e.creator_id = auth.uid()
      OR public.can_manage_event(e.id, auth.uid())
      OR public.has_role(auth.uid(), 'admin')
    );
$$;

REVOKE ALL ON FUNCTION public.host_event_attendance_counts(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.host_event_attendance_counts(uuid[]) TO authenticated;

-- New free RSVPs waitlist when the locked event is full. A person who already
-- holds a seat, and a paid ticket, are not pushed out.

CREATE OR REPLACE FUNCTION public.enforce_rsvp_capacity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_capacity integer;
  v_taken integer;
BEGIN
  IF current_setting('ether.skip_capacity', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM 'going' THEN
    RETURN NEW;
  END IF;
  IF COALESCE(NEW.ticket_purchased, false) THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'going' THEN
    RETURN NEW;
  END IF;

  SELECT e.capacity INTO v_capacity
  FROM public.events e
  WHERE e.id = NEW.event_id
  FOR UPDATE;

  IF v_capacity IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*)::integer INTO v_taken
  FROM public.event_attendees a
  WHERE a.event_id = NEW.event_id
    AND a.status IN ('registered', 'approved')
    AND (a.rsvp_id IS NULL OR a.rsvp_id IS DISTINCT FROM NEW.id)
    AND NOT (
      NEW.user_id IS NOT NULL AND a.attendee_user_id = NEW.user_id
    )
    AND NOT (
      NEW.guest_email IS NOT NULL
      AND a.attendee_email IS NOT NULL
      AND lower(a.attendee_email) = lower(NEW.guest_email)
    );

  IF v_taken >= v_capacity THEN
    NEW.status := 'waitlist';
  END IF;
  RETURN NEW;
END;
$$;

-- Direct ticket inserts use the same lock. A full event rejects the insert
-- so a checkout cannot mint a seat the RSVP path would have waitlisted.

CREATE OR REPLACE FUNCTION public.enforce_attendee_capacity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_capacity integer;
  v_taken integer;
BEGIN
  IF current_setting('ether.skip_capacity', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF NEW.status NOT IN ('registered', 'approved') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IN ('registered', 'approved') THEN
    RETURN NEW;
  END IF;

  SELECT e.capacity INTO v_capacity
  FROM public.events e
  WHERE e.id = NEW.event_id
  FOR UPDATE;

  IF v_capacity IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*)::integer INTO v_taken
  FROM public.event_attendees a
  WHERE a.event_id = NEW.event_id
    AND a.status IN ('registered', 'approved')
    AND a.id IS DISTINCT FROM NEW.id;

  IF v_taken >= v_capacity THEN
    RAISE EXCEPTION 'sold out' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_rsvp_attendee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_name text;
  v_email text;
  v_existing uuid;
  v_promote uuid;
  v_capacity integer;
  v_taken integer;
  v_notify_email text;
  v_title text;
  v_safe_title text;
BEGIN
  v_status := CASE NEW.status
    WHEN 'going' THEN 'registered'
    WHEN 'interested' THEN 'interested'
    WHEN 'waitlist' THEN 'waitlisted'
    ELSE 'cancelled'
  END;

  v_name := NULLIF(btrim(COALESCE(NEW.guest_name, '')), '');
  IF v_name IS NULL AND NEW.user_id IS NOT NULL THEN
    SELECT NULLIF(btrim(p.display_name), '') INTO v_name
    FROM public.profiles p
    WHERE p.user_id = NEW.user_id;
  END IF;
  v_name := COALESCE(v_name, 'Guest');
  v_email := NULLIF(lower(btrim(COALESCE(NEW.guest_email, ''))), '');

  SELECT a.id INTO v_existing
  FROM public.event_attendees a
  WHERE a.rsvp_id = NEW.id
  LIMIT 1;

  IF v_existing IS NULL THEN
    SELECT a.id INTO v_existing
    FROM public.event_attendees a
    WHERE a.event_id = NEW.event_id
      AND a.rsvp_id IS NULL
      AND (
        (NEW.user_id IS NOT NULL AND a.attendee_user_id = NEW.user_id)
        OR (
          v_email IS NOT NULL
          AND a.attendee_email IS NOT NULL
          AND lower(a.attendee_email) = v_email
        )
      )
    ORDER BY a.created_at
    LIMIT 1;
  END IF;

  IF v_existing IS NOT NULL THEN
    UPDATE public.event_attendees
    SET rsvp_id = NEW.id,
        attendee_user_id = COALESCE(attendee_user_id, NEW.user_id),
        attendee_name = CASE
          WHEN attendee_name IS NULL OR btrim(attendee_name) = '' OR attendee_name = 'Guest' THEN v_name
          ELSE attendee_name
        END,
        attendee_email = COALESCE(attendee_email, v_email),
        attendee_phone = COALESCE(attendee_phone, NULLIF(btrim(COALESCE(NEW.guest_phone, '')), '')),
        status = CASE
          WHEN order_id IS NOT NULL AND status IN ('registered', 'approved') AND v_status <> 'cancelled' THEN status
          ELSE v_status
        END,
        updated_at = now()
    WHERE id = v_existing;
  ELSE
    INSERT INTO public.event_attendees (
      event_id, rsvp_id, attendee_user_id, attendee_name, attendee_email, attendee_phone, status, created_at, updated_at
    ) VALUES (
      NEW.event_id,
      NEW.id,
      NEW.user_id,
      v_name,
      v_email,
      NULLIF(btrim(COALESCE(NEW.guest_phone, '')), ''),
      v_status,
      COALESCE(NEW.created_at, now()),
      now()
    );
  END IF;

  IF NEW.campaign_id IS NOT NULL
     AND NEW.status = 'going'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'going') THEN
    UPDATE public.notification_campaigns
    SET rsvp_conversions = rsvp_conversions + 1
    WHERE id = NEW.campaign_id;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.status = 'waitlist'
     AND NEW.status = 'going' THEN
    IF NEW.user_id IS NOT NULL THEN
      BEGIN
        INSERT INTO public.notifications (user_id, type, title, body, data)
        VALUES (
          NEW.user_id,
          'event_reminder',
          'A spot opened',
          'You are going. A seat opened up.',
          jsonb_build_object('event_id', NEW.event_id)
        );
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;

    -- Email through the same queue as other transactional mail. A queue
    -- failure must not roll back the seat they just received.
    BEGIN
      v_notify_email := v_email;
      IF v_notify_email IS NULL AND NEW.user_id IS NOT NULL THEN
        SELECT NULLIF(lower(btrim(u.email)), '') INTO v_notify_email
        FROM auth.users u
        WHERE u.id = NEW.user_id;
      END IF;
      IF v_notify_email IS NOT NULL THEN
        SELECT COALESCE(e.title, 'your event') INTO v_title
        FROM public.events e
        WHERE e.id = NEW.event_id;
        v_safe_title := replace(replace(replace(COALESCE(v_title, 'your event'), '&', '&amp;'), '<', '&lt;'), '>', '&gt;');
        PERFORM public.enqueue_email(
          'transactional_emails',
          jsonb_build_object(
            'message_id', gen_random_uuid()::text,
            'to', v_notify_email,
            'from', 'Ether <notifications@etherbylcove.com>',
            'subject', 'A seat opened for ' || COALESCE(v_title, 'your event'),
            'html', '<p>A seat opened and you are going to <strong>' || v_safe_title || '</strong>.</p>',
            'text', 'A seat opened and you are going to ' || COALESCE(v_title, 'your event') || '.',
            'purpose', 'transactional',
            'label', 'waitlist-promoted',
            'idempotency_key', 'waitlist-promoted-' || NEW.id::text || '-' || floor(extract(epoch FROM now()))::text,
            'queued_at', now()
          )
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.status = 'going'
     AND NEW.status IS DISTINCT FROM 'going'
     AND current_setting('ether.promoting_waitlist', true) IS DISTINCT FROM 'on'
     AND current_setting('ether.skip_capacity', true) IS DISTINCT FROM 'on' THEN
    SELECT e.capacity INTO v_capacity FROM public.events e WHERE e.id = NEW.event_id;
    IF v_capacity IS NOT NULL THEN
      v_taken := public.event_seat_count(NEW.event_id);
      IF v_taken < v_capacity THEN
        SELECT r.id INTO v_promote
        FROM public.event_rsvps r
        WHERE r.event_id = NEW.event_id
          AND r.status = 'waitlist'
        ORDER BY r.created_at
        LIMIT 1;
        IF v_promote IS NOT NULL THEN
          PERFORM set_config('ether.promoting_waitlist', 'on', true);
          UPDATE public.event_rsvps
          SET status = 'going', updated_at = now()
          WHERE id = v_promote;
          PERFORM set_config('ether.promoting_waitlist', 'off', true);
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS event_rsvps_enforce_capacity ON public.event_rsvps;
CREATE TRIGGER event_rsvps_enforce_capacity
  BEFORE INSERT OR UPDATE OF status, ticket_purchased, guest_email, user_id
  ON public.event_rsvps
  FOR EACH ROW EXECUTE FUNCTION public.enforce_rsvp_capacity();

DROP TRIGGER IF EXISTS event_rsvps_sync_attendee ON public.event_rsvps;
CREATE TRIGGER event_rsvps_sync_attendee
  AFTER INSERT OR UPDATE OF status, guest_name, guest_email, guest_phone, user_id, ticket_purchased, campaign_id
  ON public.event_rsvps
  FOR EACH ROW EXECUTE FUNCTION public.sync_rsvp_attendee();

DROP TRIGGER IF EXISTS event_attendees_enforce_capacity ON public.event_attendees;
CREATE TRIGGER event_attendees_enforce_capacity
  BEFORE INSERT OR UPDATE OF status
  ON public.event_attendees
  FOR EACH ROW EXECUTE FUNCTION public.enforce_attendee_capacity();

-- Backfill. Existing over-capacity RSVPs are copied as registered seats.
-- The capacity trigger is skipped for this statement only.

SELECT set_config('ether.skip_capacity', 'on', true);

WITH ranked AS (
  SELECT
    a.id AS attendee_id,
    r.id AS rsvp_id,
    row_number() OVER (
      PARTITION BY a.id
      ORDER BY (r.status = 'going') DESC, r.created_at
    ) AS attendee_rank,
    row_number() OVER (
      PARTITION BY r.id
      ORDER BY a.created_at
    ) AS rsvp_rank
  FROM public.event_rsvps r
  JOIN public.event_attendees a
    ON a.event_id = r.event_id
   AND a.rsvp_id IS NULL
  WHERE r.status IN ('going', 'interested', 'waitlist')
    AND NOT EXISTS (
      SELECT 1 FROM public.event_attendees taken WHERE taken.rsvp_id = r.id
    )
    AND (
      (r.user_id IS NOT NULL AND a.attendee_user_id = r.user_id)
      OR (
        r.guest_email IS NOT NULL
        AND a.attendee_email IS NOT NULL
        AND lower(a.attendee_email) = lower(r.guest_email)
      )
    )
),
match AS (
  SELECT attendee_id, rsvp_id
  FROM ranked
  WHERE attendee_rank = 1 AND rsvp_rank = 1
)
UPDATE public.event_attendees a
SET rsvp_id = match.rsvp_id
FROM match
WHERE a.id = match.attendee_id
  AND a.rsvp_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.event_attendees other WHERE other.rsvp_id = match.rsvp_id
  );

INSERT INTO public.event_attendees (
  event_id, rsvp_id, attendee_user_id, attendee_name, attendee_email, attendee_phone, status, created_at, updated_at
)
SELECT
  r.event_id,
  r.id,
  r.user_id,
  COALESCE(NULLIF(btrim(r.guest_name), ''), NULLIF(btrim(p.display_name), ''), 'Guest'),
  NULLIF(lower(btrim(COALESCE(r.guest_email, ''))), ''),
  NULLIF(btrim(COALESCE(r.guest_phone, '')), ''),
  CASE r.status
    WHEN 'going' THEN 'registered'
    WHEN 'interested' THEN 'interested'
    WHEN 'waitlist' THEN 'waitlisted'
    ELSE 'cancelled'
  END,
  r.created_at,
  now()
FROM public.event_rsvps r
LEFT JOIN public.profiles p ON p.user_id = r.user_id
WHERE r.status IN ('going', 'interested', 'waitlist')
  AND NOT EXISTS (
    SELECT 1 FROM public.event_attendees a WHERE a.rsvp_id = r.id
  );

SELECT set_config('ether.skip_capacity', 'off', true);

-- Hosts, including organization members, can read the guest list. Guests
-- still only see their own RSVP row. The public count is the seat function.

DROP POLICY IF EXISTS "RSVP rows are visible to the attendee, host, or an admin" ON public.event_rsvps;
CREATE POLICY "RSVP rows are visible to the attendee, host, or an admin"
ON public.event_rsvps FOR SELECT
USING (
  (auth.uid() IS NOT NULL AND user_id = auth.uid())
  OR public.can_manage_event(event_id, auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "Event managers can view attendees" ON public.event_attendees;
CREATE POLICY "Event managers can view attendees"
ON public.event_attendees FOR SELECT
USING (public.can_manage_event(event_id, auth.uid()));

DROP POLICY IF EXISTS "Event managers can view check-ins" ON public.event_check_ins;
CREATE POLICY "Event managers can view check-ins"
ON public.event_check_ins FOR SELECT
USING (public.can_manage_event(event_id, auth.uid()));

-- Guest RSVP. Returns the id and the status the capacity trigger settled on.

DROP FUNCTION IF EXISTS public.create_guest_event_rsvp(uuid, text, text, text);

CREATE OR REPLACE FUNCTION public.create_guest_event_rsvp(
  p_event_id uuid,
  p_guest_name text,
  p_guest_email text,
  p_guest_phone text DEFAULT NULL,
  p_campaign_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_status text;
  v_email text;
  v_phone text;
BEGIN
  IF p_guest_name IS NULL OR btrim(p_guest_name) = '' THEN
    RAISE EXCEPTION 'name required';
  END IF;
  v_email := lower(btrim(COALESCE(p_guest_email, '')));
  IF v_email = '' OR position('@' in v_email) = 0 THEN
    RAISE EXCEPTION 'email required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = p_event_id AND e.is_public = true
  ) THEN
    RAISE EXCEPTION 'event not found';
  END IF;
  v_phone := NULLIF(btrim(COALESCE(p_guest_phone, '')), '');
  IF p_campaign_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.notification_campaigns WHERE id = p_campaign_id
  ) THEN
    p_campaign_id := NULL;
  END IF;
  INSERT INTO public.event_rsvps (
    event_id, user_id, status, guest_name, guest_email, guest_phone, campaign_id
  ) VALUES (
    p_event_id, NULL, 'going', btrim(p_guest_name), v_email, v_phone, p_campaign_id
  )
  RETURNING id, status INTO v_id, v_status;
  RETURN jsonb_build_object('id', v_id, 'status', v_status);
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'already rsvped';
END;
$$;

REVOKE ALL ON FUNCTION public.create_guest_event_rsvp(uuid, text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_guest_event_rsvp(uuid, text, text, text, uuid) TO anon, authenticated;

-- Opens, clicks, and delivery. Service role only, so a browser cannot inflate the counts.

CREATE OR REPLACE FUNCTION public.record_notification_engagement(p_token text, p_kind text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log public.notification_logs%ROWTYPE;
  v_now timestamptz := now();
BEGIN
  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RETURN jsonb_build_object('ok', false);
  END IF;
  IF p_kind NOT IN ('delivered', 'open', 'click', 'bounce') THEN
    RAISE EXCEPTION 'bad kind';
  END IF;

  SELECT * INTO v_log
  FROM public.notification_logs
  WHERE track_token = p_token
     OR metadata->>'resend_id' = p_token
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  IF p_kind = 'delivered' AND v_log.status IN ('queued', 'sent') THEN
    UPDATE public.notification_logs
    SET status = 'delivered'
    WHERE id = v_log.id;
  ELSIF p_kind = 'open' AND v_log.opened_at IS NULL THEN
    UPDATE public.notification_logs
    SET opened_at = v_now,
        status = CASE WHEN status IN ('queued', 'sent', 'delivered') THEN 'opened' ELSE status END
    WHERE id = v_log.id;
    IF v_log.campaign_id IS NOT NULL THEN
      UPDATE public.notification_campaigns
      SET opened_count = opened_count + 1
      WHERE id = v_log.campaign_id;
    END IF;
  ELSIF p_kind = 'click' AND v_log.clicked_at IS NULL THEN
    UPDATE public.notification_logs
    SET clicked_at = v_now,
        opened_at = COALESCE(opened_at, v_now),
        status = 'clicked'
    WHERE id = v_log.id;
    IF v_log.campaign_id IS NOT NULL THEN
      UPDATE public.notification_campaigns
      SET clicked_count = clicked_count + 1
      WHERE id = v_log.campaign_id;
      IF v_log.opened_at IS NULL THEN
        UPDATE public.notification_campaigns
        SET opened_count = opened_count + 1
        WHERE id = v_log.campaign_id;
      END IF;
    END IF;
  ELSIF p_kind = 'bounce' AND v_log.status IS DISTINCT FROM 'bounced' THEN
    UPDATE public.notification_logs
    SET status = 'bounced'
    WHERE id = v_log.id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'url', COALESCE(v_log.metadata->>'destination', '')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_notification_engagement(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_notification_engagement(text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.get_campaign_analytics(p_event_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_totals jsonb;
  v_by_channel jsonb;
  v_recent jsonb;
  v_rsvped integer;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT COUNT(*)::integer INTO v_rsvped
  FROM public.event_rsvps r
  JOIN public.notification_campaigns c ON c.id = r.campaign_id
  WHERE c.host_user_id = v_caller
    AND (p_event_id IS NULL OR c.event_id = p_event_id)
    AND r.status = 'going';

  SELECT jsonb_build_object(
    'sent', COUNT(*) FILTER (WHERE status IN ('sent', 'delivered', 'opened', 'clicked')),
    'people', COUNT(DISTINCT COALESCE(user_id::text, NULLIF(lower(recipient_email), '')))
      FILTER (WHERE status IN ('sent', 'delivered', 'opened', 'clicked')),
    'email_sent', COUNT(*) FILTER (
      WHERE channel = 'email' AND status IN ('sent', 'delivered', 'opened', 'clicked')
    ),
    'email_delivered', COUNT(*) FILTER (
      WHERE channel = 'email' AND status IN ('delivered', 'opened', 'clicked')
    ),
    'opened', COUNT(*) FILTER (WHERE opened_at IS NOT NULL),
    'clicked', COUNT(*) FILTER (WHERE clicked_at IS NOT NULL),
    'failed', COUNT(*) FILTER (WHERE status IN ('failed', 'bounced')),
    'opens_tracked', COALESCE(bool_or(channel = 'email' AND track_token IS NOT NULL), false),
    'clicks_tracked', COALESCE(bool_or(channel = 'email' AND track_token IS NOT NULL), false),
    'delivery_tracked', COALESCE(bool_or(
      channel = 'email' AND status IN ('delivered', 'opened', 'clicked')
    ), false),
    'rsvped', v_rsvped,
    'total', COUNT(*)
  ) INTO v_totals
  FROM public.notification_logs
  WHERE host_user_id = v_caller
    AND (p_event_id IS NULL OR event_id = p_event_id);

  SELECT COALESCE(jsonb_object_agg(channel, c), '{}'::jsonb) INTO v_by_channel
  FROM (
    SELECT channel, COUNT(*) AS c
    FROM public.notification_logs
    WHERE host_user_id = v_caller
      AND (p_event_id IS NULL OR event_id = p_event_id)
      AND status IN ('sent', 'delivered', 'opened', 'clicked')
    GROUP BY channel
  ) s;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id, 'name', name, 'type', type, 'title', title,
    'recipient_count', recipient_count, 'sent_count', sent_count,
    'opened_count', opened_count, 'clicked_count', clicked_count,
    'rsvp_conversions', rsvp_conversions, 'created_at', created_at
  ) ORDER BY created_at DESC), '[]'::jsonb) INTO v_recent
  FROM (
    SELECT * FROM public.notification_campaigns
    WHERE host_user_id = v_caller
      AND (p_event_id IS NULL OR event_id = p_event_id)
    ORDER BY created_at DESC
    LIMIT 20
  ) c;

  RETURN jsonb_build_object(
    'totals', COALESCE(v_totals, '{}'::jsonb) || jsonb_build_object('by_channel', v_by_channel),
    'by_channel', v_by_channel,
    'recent_campaigns', v_recent
  );
END;
$$;
