-- Host event presentation, hidden address, and public guest names.
-- Additive. Existing checkout keeps working before these columns are read.
-- Re-running is safe.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS flyer_font text,
  ADD COLUMN IF NOT EXISTS page_theme text NOT NULL DEFAULT 'dark',
  ADD COLUMN IF NOT EXISTS hide_address boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS absorb_fees boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_transfers boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS password_protected boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS features text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_page_theme_check;
ALTER TABLE public.events
  ADD CONSTRAINT events_page_theme_check CHECK (page_theme IN ('light', 'dark'));

CREATE TABLE IF NOT EXISTS public.event_secrets (
  event_id uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  private_address text,
  access_password text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.event_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.event_secrets FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.event_secrets TO service_role;

ALTER TABLE public.content_reports DROP CONSTRAINT IF EXISTS content_reports_target_type_check;
ALTER TABLE public.content_reports ADD CONSTRAINT content_reports_target_type_check
  CHECK (target_type IN ('post', 'profile', 'message', 'comment', 'project', 'stream_message', 'stream', 'event'));

CREATE OR REPLACE FUNCTION public.set_event_access(
  p_event_id uuid,
  p_hide_address boolean,
  p_private_address text,
  p_password text,
  p_password_protected boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = p_event_id
      AND (e.creator_id = auth.uid() OR public.can_manage_event(p_event_id, auth.uid()))
  ) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  UPDATE public.events
  SET hide_address = COALESCE(p_hide_address, false),
      password_protected = COALESCE(p_password_protected, false),
      address = CASE
        WHEN COALESCE(p_hide_address, false) THEN NULL
        ELSE NULLIF(btrim(COALESCE(p_private_address, '')), '')
      END
  WHERE id = p_event_id;

  INSERT INTO public.event_secrets (event_id, private_address, access_password)
  VALUES (
    p_event_id,
    NULLIF(btrim(COALESCE(p_private_address, '')), ''),
    CASE
      WHEN NOT COALESCE(p_password_protected, false) THEN NULL
      WHEN p_password IS NULL OR btrim(p_password) = '' THEN NULL
      ELSE crypt(p_password, gen_salt('bf'))
    END
  )
  ON CONFLICT (event_id) DO UPDATE SET
    private_address = EXCLUDED.private_address,
    access_password = CASE
      WHEN NOT COALESCE(p_password_protected, false) THEN NULL
      WHEN p_password IS NULL OR btrim(p_password) = '' THEN public.event_secrets.access_password
      ELSE EXCLUDED.access_password
    END,
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.event_password_ok(p_event_id uuid, p_password text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_protected boolean;
  v_hash text;
BEGIN
  SELECT password_protected INTO v_protected FROM public.events WHERE id = p_event_id;
  IF NOT FOUND OR v_protected IS NOT TRUE THEN
    RETURN true;
  END IF;
  SELECT access_password INTO v_hash FROM public.event_secrets WHERE event_id = p_event_id;
  IF v_hash IS NULL OR v_hash = '' THEN
    RETURN true;
  END IF;
  IF p_password IS NULL OR btrim(p_password) = '' THEN
    RETURN false;
  END IF;
  RETURN v_hash = crypt(p_password, v_hash);
END;
$$;

CREATE OR REPLACE FUNCTION public.public_event_location(
  p_event_id uuid,
  p_order_id uuid DEFAULT NULL,
  p_rsvp_id uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hide boolean;
  v_public text;
  v_private text;
  v_venue text;
  v_city text;
  v_state text;
  v_creator uuid;
  v_allowed boolean := false;
BEGIN
  SELECT hide_address, address, venue, city, state, creator_id
    INTO v_hide, v_public, v_venue, v_city, v_state, v_creator
  FROM public.events
  WHERE id = p_event_id AND (is_public IS TRUE OR creator_id = auth.uid());
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  IF v_hide IS NOT TRUE THEN
    RETURN NULLIF(concat_ws(', ', v_venue, v_public, v_city, v_state), '');
  END IF;
  IF auth.uid() IS NOT NULL AND (
    auth.uid() = v_creator OR COALESCE(public.can_manage_event(p_event_id, auth.uid()), false)
  ) THEN
    v_allowed := true;
  END IF;
  IF auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.event_rsvps
    WHERE event_id = p_event_id AND user_id = auth.uid() AND status = 'going'
  ) THEN
    v_allowed := true;
  END IF;
  IF auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.event_attendees
    WHERE event_id = p_event_id AND attendee_user_id = auth.uid()
      AND status IN ('registered', 'approved')
  ) THEN
    v_allowed := true;
  END IF;
  IF p_order_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.ticket_orders
    WHERE id = p_order_id AND event_id = p_event_id AND payment_status = 'paid'
  ) THEN
    v_allowed := true;
  END IF;
  IF p_rsvp_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.event_rsvps
    WHERE id = p_rsvp_id AND event_id = p_event_id AND status = 'going'
  ) THEN
    v_allowed := true;
  END IF;
  IF NOT v_allowed THEN
    RETURN NULL;
  END IF;
  SELECT private_address INTO v_private FROM public.event_secrets WHERE event_id = p_event_id;
  RETURN NULLIF(concat_ws(', ', v_venue, COALESCE(v_private, v_public), v_city, v_state), '');
END;
$$;

CREATE OR REPLACE FUNCTION public.public_event_guest_preview(p_event_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  WITH going AS (
    SELECT COALESCE(NULLIF(btrim(a.attendee_name), ''), 'Guest') AS name,
           p.avatar_url,
           a.created_at
    FROM public.event_attendees a
    LEFT JOIN public.profiles_public p ON p.user_id = a.attendee_user_id
    WHERE a.event_id = p_event_id
      AND a.status IN ('registered', 'approved')
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

CREATE OR REPLACE FUNCTION public.public_host_stats(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT jsonb_build_object(
    'events', (
      SELECT COUNT(*)::integer FROM public.events
      WHERE creator_id = p_user_id AND is_public IS TRUE AND status IS DISTINCT FROM 'draft'
    ),
    'attendees', (
      SELECT COALESCE(SUM(public.public_event_attendance_count(e.id)), 0)::integer
      FROM public.events e
      WHERE e.creator_id = p_user_id AND e.is_public IS TRUE AND e.status IS DISTINCT FROM 'draft'
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.host_follower_count(p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT COUNT(*)::integer FROM public.favorite_friends WHERE friend_user_id = p_user_id;
$$;

REVOKE ALL ON FUNCTION public.set_event_access(uuid, boolean, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_event_access(uuid, boolean, text, text, boolean) TO authenticated;

REVOKE ALL ON FUNCTION public.event_password_ok(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.event_password_ok(uuid, text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.public_event_location(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_event_location(uuid, uuid, uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.public_event_guest_preview(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_event_guest_preview(uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.public_host_stats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_host_stats(uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.host_follower_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.host_follower_count(uuid) TO anon, authenticated;

-- Hosts can refill the address field. Guests still go through public_event_location.
CREATE OR REPLACE FUNCTION public.host_event_address(p_event_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_address text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = p_event_id
      AND (e.creator_id = auth.uid() OR public.can_manage_event(p_event_id, auth.uid()))
  ) THEN
    RETURN NULL;
  END IF;
  SELECT COALESCE(s.private_address, e.address)
    INTO v_address
  FROM public.events e
  LEFT JOIN public.event_secrets s ON s.event_id = e.id
  WHERE e.id = p_event_id;
  RETURN v_address;
END;
$$;

REVOKE ALL ON FUNCTION public.host_event_address(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.host_event_address(uuid) TO authenticated;
