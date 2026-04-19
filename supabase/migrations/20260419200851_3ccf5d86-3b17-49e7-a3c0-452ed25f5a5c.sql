-- Helper: can the caller manage this event?
CREATE OR REPLACE FUNCTION public.can_manage_event(p_event_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = p_event_id
      AND (
        e.creator_id = p_user_id
        OR (
          e.organization_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = e.organization_id
              AND om.user_id = p_user_id
          )
        )
      )
  )
$$;

-- Check-in function: validates QR, prevents duplicates, records check-in
CREATE OR REPLACE FUNCTION public.check_in_attendee(
  p_qr_code text,
  p_event_id uuid DEFAULT NULL,
  p_method text DEFAULT 'qr',
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attendee RECORD;
  v_existing_checkin RECORD;
  v_checkin_id uuid;
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- Find attendee by QR
  SELECT a.*, t.name AS tier_name
  INTO v_attendee
  FROM public.event_attendees a
  LEFT JOIN public.ticket_tiers t ON t.id = a.tier_id
  WHERE a.qr_code = p_qr_code
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_qr');
  END IF;

  -- Optional event scoping
  IF p_event_id IS NOT NULL AND v_attendee.event_id != p_event_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'wrong_event');
  END IF;

  -- Permission
  IF NOT public.can_manage_event(v_attendee.event_id, v_caller) THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authorized');
  END IF;

  -- Status check (must not be cancelled/refunded)
  IF v_attendee.status NOT IN ('confirmed', 'checked_in') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'attendee_not_active',
      'attendee_status', v_attendee.status
    );
  END IF;

  -- Already checked in?
  SELECT * INTO v_existing_checkin
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
      'checked_in_at', v_existing_checkin.created_at
    );
  END IF;

  -- Record check-in
  INSERT INTO public.event_check_ins (event_id, attendee_id, checked_in_by, method, notes)
  VALUES (v_attendee.event_id, v_attendee.id, v_caller, COALESCE(p_method, 'qr'), p_notes)
  RETURNING id INTO v_checkin_id;

  -- Update attendee status
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

GRANT EXECUTE ON FUNCTION public.can_manage_event(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_in_attendee(text, uuid, text, text) TO authenticated;