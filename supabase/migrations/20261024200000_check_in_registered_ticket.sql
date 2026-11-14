-- Door check-in accepts a real ticket and records it with a legal status.
--
-- event_attendees.status allowed interested, registered, approved, waitlisted,
-- cancelled, no_show, and refunded. check_in_attendee only accepted confirmed
-- or checked_in, then wrote checked_in, which the constraint rejected.
-- A registered or approved seat can be checked in. The row becomes checked_in,
-- which now holds the seat the same way registered and approved do.
-- Cancelled and refunded stay rejected. The caller must be the event host
-- (events.creator_id) or a co-host (a member of that event's organization).

ALTER TABLE public.event_attendees
  DROP CONSTRAINT IF EXISTS event_attendees_status_check;

ALTER TABLE public.event_attendees
  ADD CONSTRAINT event_attendees_status_check
  CHECK (status IN (
    'interested',
    'registered',
    'approved',
    'waitlisted',
    'cancelled',
    'no_show',
    'refunded',
    'checked_in'
  ));

CREATE OR REPLACE FUNCTION public.event_seat_count(p_event_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
  SELECT COALESCE((
    SELECT COUNT(*)::integer
    FROM public.event_attendees a
    WHERE a.event_id = p_event_id
      AND a.status IN ('registered', 'approved', 'checked_in')
  ), 0);
$$;

REVOKE ALL ON FUNCTION public.event_seat_count(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_seat_count(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.enforce_rsvp_capacity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
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
    AND a.status IN ('registered', 'approved', 'checked_in')
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

CREATE OR REPLACE FUNCTION public.enforce_attendee_capacity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_capacity integer;
  v_taken integer;
BEGIN
  IF current_setting('ether.skip_capacity', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF NEW.status NOT IN ('registered', 'approved', 'checked_in') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IN ('registered', 'approved', 'checked_in') THEN
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
    AND a.status IN ('registered', 'approved', 'checked_in')
    AND a.id IS DISTINCT FROM NEW.id;

  IF v_taken >= v_capacity THEN
    RAISE EXCEPTION 'sold out' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.public_event_guest_preview(p_event_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
  WITH going AS (
    SELECT COALESCE(NULLIF(btrim(a.attendee_name), ''), 'Guest') AS name,
           p.avatar_url,
           a.created_at
    FROM public.event_attendees a
    LEFT JOIN public.profiles_public p ON p.user_id = a.attendee_user_id
    WHERE a.event_id = p_event_id
      AND a.status IN ('registered', 'approved', 'checked_in')
      AND EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.id = p_event_id AND e.is_public IS TRUE
      )
    ORDER BY a.created_at
    LIMIT 24
  )
  SELECT jsonb_build_object(
    'names', COALESCE((SELECT jsonb_agg(name) FROM (SELECT name FROM going LIMIT 8) s), '[]'::jsonb),
    'avatars', COALESCE((SELECT jsonb_agg(avatar_url) FROM (SELECT avatar_url FROM going LIMIT 5) s), '[]'::jsonb)
  );
$$;

CREATE OR REPLACE FUNCTION public.check_in_attendee(
  p_qr_code text,
  p_event_id uuid DEFAULT NULL,
  p_method text DEFAULT 'qr',
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_attendee RECORD;
  v_existing public.event_check_ins%ROWTYPE;
  v_checkin_id uuid;
  v_caller uuid := auth.uid();
  v_qr text := btrim(COALESCE(p_qr_code, ''));
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  IF v_qr = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_qr');
  END IF;

  SELECT a.*, t.name AS tier_name
  INTO v_attendee
  FROM public.event_attendees a
  LEFT JOIN public.ticket_tiers t ON t.id = a.tier_id
  WHERE a.qr_code = v_qr
  FOR UPDATE OF a;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_qr');
  END IF;

  IF p_event_id IS NOT NULL AND v_attendee.event_id IS DISTINCT FROM p_event_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'wrong_event');
  END IF;

  -- Host is the event creator. A co-host is a member of the event's organization.
  IF NOT public.can_manage_event(v_attendee.event_id, v_caller) THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authorized');
  END IF;

  IF v_attendee.status NOT IN ('registered', 'approved', 'checked_in') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'attendee_not_active',
      'attendee_status', v_attendee.status
    );
  END IF;

  SELECT * INTO v_existing
  FROM public.event_check_ins
  WHERE attendee_id = v_attendee.id
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'already_checked_in',
      'attendee', jsonb_build_object(
        'id', v_attendee.id,
        'name', v_attendee.attendee_name,
        'email', v_attendee.attendee_email,
        'ticket_number', v_attendee.ticket_number,
        'tier_name', v_attendee.tier_name
      ),
      'checked_in_at', v_existing.created_at
    );
  END IF;

  BEGIN
    INSERT INTO public.event_check_ins (event_id, attendee_id, checked_in_by, method, notes)
    VALUES (v_attendee.event_id, v_attendee.id, v_caller, COALESCE(p_method, 'qr'), p_notes)
    RETURNING id INTO v_checkin_id;
  EXCEPTION
    WHEN unique_violation THEN
      SELECT * INTO v_existing
      FROM public.event_check_ins
      WHERE attendee_id = v_attendee.id
      ORDER BY created_at DESC
      LIMIT 1;
      RETURN jsonb_build_object(
        'success', false,
        'error', 'already_checked_in',
        'attendee', jsonb_build_object(
          'id', v_attendee.id,
          'name', v_attendee.attendee_name,
          'email', v_attendee.attendee_email,
          'ticket_number', v_attendee.ticket_number,
          'tier_name', v_attendee.tier_name
        ),
        'checked_in_at', v_existing.created_at
      );
  END;

  UPDATE public.event_attendees
  SET status = 'checked_in', updated_at = now()
  WHERE id = v_attendee.id;

  RETURN jsonb_build_object(
    'success', true,
    'check_in_id', v_checkin_id,
    'attendee', jsonb_build_object(
      'id', v_attendee.id,
      'name', v_attendee.attendee_name,
      'email', v_attendee.attendee_email,
      'ticket_number', v_attendee.ticket_number,
      'tier_name', v_attendee.tier_name
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_in_attendee(text, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_in_attendee(text, uuid, text, text) TO authenticated;
