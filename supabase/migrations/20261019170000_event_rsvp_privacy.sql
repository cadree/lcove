-- Stop public reads of event_rsvps. Guest name, email, phone, and payment
-- ids were visible to anyone for a public event. Hosts, the attendee, and
-- admins can still read the rows. Public pages get a count only.

DROP POLICY IF EXISTS "Anyone can view RSVPs for public events" ON public.event_rsvps;
DROP POLICY IF EXISTS "Users can view RSVPs for public events" ON public.event_rsvps;

CREATE POLICY "RSVP rows are visible to the attendee, host, or an admin"
ON public.event_rsvps FOR SELECT
USING (
  (auth.uid() IS NOT NULL AND user_id = auth.uid())
  OR (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_rsvps.event_id AND e.creator_id = auth.uid()
    )
  )
  OR public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "Admins can view event attendees" ON public.event_attendees;
CREATE POLICY "Admins can view event attendees"
ON public.event_attendees FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can view ticket orders" ON public.ticket_orders;
CREATE POLICY "Admins can view ticket orders"
ON public.ticket_orders FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can view event check-ins" ON public.event_check_ins;
CREATE POLICY "Admins can view event check-ins"
ON public.event_check_ins FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.public_event_attendance_count(p_event_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = p_event_id AND e.is_public = true
    ) THEN (
      COALESCE((
        SELECT COUNT(*) FROM public.event_attendees a
        WHERE a.event_id = p_event_id
          AND a.status IN ('confirmed', 'checked_in', 'registered', 'approved')
      ), 0)
      +
      COALESCE((
        SELECT COUNT(*) FROM public.event_rsvps r
        WHERE r.event_id = p_event_id AND r.status = 'going'
      ), 0)
    )::integer
    ELSE 0
  END;
$fn$;

REVOKE ALL ON FUNCTION public.public_event_attendance_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_event_attendance_count(uuid) TO anon, authenticated;

-- Guest RSVP insert cannot RETURNING the new id once public SELECT is gone.
-- This returns only the new row id, never another guest's details.
CREATE OR REPLACE FUNCTION public.create_guest_event_rsvp(
  p_event_id uuid,
  p_guest_name text,
  p_guest_email text,
  p_guest_phone text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_id uuid;
  v_email text;
  v_phone text;
BEGIN
  IF p_guest_name IS NULL OR btrim(p_guest_name) = '' THEN
    RAISE EXCEPTION 'name required';
  END IF;
  v_email := lower(btrim(coalesce(p_guest_email, '')));
  IF v_email = '' OR position('@' in v_email) = 0 THEN
    RAISE EXCEPTION 'email required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = p_event_id AND e.is_public = true
  ) THEN
    RAISE EXCEPTION 'event not found';
  END IF;
  v_phone := NULLIF(btrim(coalesce(p_guest_phone, '')), '');
  INSERT INTO public.event_rsvps (event_id, user_id, status, guest_name, guest_email, guest_phone)
  VALUES (p_event_id, NULL, 'going', btrim(p_guest_name), v_email, v_phone)
  RETURNING id INTO v_id;
  RETURN v_id;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'already rsvped';
END;
$fn$;

REVOKE ALL ON FUNCTION public.create_guest_event_rsvp(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_guest_event_rsvp(uuid, text, text, text) TO anon, authenticated;
