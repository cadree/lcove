-- Guest RSVP from the browser, nearby-events consent, and post-RSVP reveal.
-- Idempotent. Ether Engineer applies this by hand to ether-prod after merge.
-- Do not run it from the app or from CI.
--
-- Anon may execute create_guest_event_rsvp and the public read functions below.
-- Anon still cannot read event_secrets, event_rsvps, or event_attendees.
-- Hidden street addresses are forced null on events. The street lives in
-- event_secrets and leaves that table only through public_event_location.
-- Hidden host notes leave event_secrets only through public_event_host_notes.
-- Guest names leave the database only through public_event_guest_preview,
-- and only after the caller has a going RSVP, a paid order, or is the host.

-- ---------------------------------------------------------------------------
-- Consent. Default off. A timestamp is stored only when the guest opts in.
-- ---------------------------------------------------------------------------

ALTER TABLE public.event_rsvps
  ADD COLUMN IF NOT EXISTS nearby_events_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS nearby_events_consent_at timestamptz;

ALTER TABLE public.ticket_orders
  ADD COLUMN IF NOT EXISTS nearby_events_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS nearby_events_consent_at timestamptz;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS hide_host_notes boolean NOT NULL DEFAULT false;

ALTER TABLE public.event_secrets
  ADD COLUMN IF NOT EXISTS host_notes text,
  ADD COLUMN IF NOT EXISTS hide_host_notes boolean NOT NULL DEFAULT false;

GRANT SELECT (hide_host_notes) ON public.events TO anon;

-- ---------------------------------------------------------------------------
-- A hidden address cannot sit in events.address, which anon is allowed to read.
-- The street is copied into event_secrets, then the public column is cleared.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.events_clear_hidden_address()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.hide_address IS NOT TRUE THEN
    PERFORM set_config('ether.hidden_address', '', true);
    RETURN NEW;
  END IF;
  IF NEW.address IS NOT NULL AND btrim(NEW.address) <> '' THEN
    PERFORM set_config('ether.hidden_address', btrim(NEW.address), true);
  ELSE
    PERFORM set_config('ether.hidden_address', '', true);
  END IF;
  NEW.address := NULL;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.events_store_hidden_address()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_street text := NULLIF(current_setting('ether.hidden_address', true), '');
BEGIN
  IF v_street IS NULL THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.event_secrets (event_id, private_address)
  VALUES (NEW.id, v_street)
  ON CONFLICT (event_id) DO UPDATE
    SET private_address = COALESCE(NULLIF(btrim(public.event_secrets.private_address), ''), EXCLUDED.private_address),
        updated_at = now();
  PERFORM set_config('ether.hidden_address', '', true);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS events_clear_hidden_address ON public.events;
CREATE TRIGGER events_clear_hidden_address
  BEFORE INSERT OR UPDATE OF address, hide_address
  ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.events_clear_hidden_address();

DROP TRIGGER IF EXISTS events_store_hidden_address ON public.events;
CREATE TRIGGER events_store_hidden_address
  AFTER INSERT OR UPDATE OF address, hide_address
  ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.events_store_hidden_address();

REVOKE ALL ON FUNCTION public.events_clear_hidden_address() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.events_store_hidden_address() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.events_clear_hidden_address() TO authenticated;
GRANT EXECUTE ON FUNCTION public.events_store_hidden_address() TO authenticated;

-- ---------------------------------------------------------------------------
-- Who may see the street, the guest names, and notes marked hide-until-RSVP.
-- Not granted to the browser. The public functions below call it.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.event_reveal_allowed(
  p_event_id uuid,
  p_order_id uuid DEFAULT NULL,
  p_rsvp_id uuid DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_creator uuid;
BEGIN
  SELECT creator_id INTO v_creator
  FROM public.events
  WHERE id = p_event_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  IF auth.uid() IS NOT NULL AND (
    auth.uid() = v_creator
    OR COALESCE(public.can_manage_event(p_event_id, auth.uid()), false)
  ) THEN
    RETURN true;
  END IF;
  IF auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.event_rsvps
    WHERE event_id = p_event_id
      AND user_id = auth.uid()
      AND status IN ('going', 'waitlist')
  ) THEN
    RETURN true;
  END IF;
  IF auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.event_attendees
    WHERE event_id = p_event_id
      AND attendee_user_id = auth.uid()
      AND status IN ('registered', 'approved', 'checked_in')
  ) THEN
    RETURN true;
  END IF;
  IF p_order_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.ticket_orders
    WHERE id = p_order_id
      AND event_id = p_event_id
      AND payment_status = 'paid'
  ) THEN
    RETURN true;
  END IF;
  IF p_rsvp_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.event_rsvps
    WHERE id = p_rsvp_id
      AND event_id = p_event_id
      AND status IN ('going', 'waitlist')
  ) THEN
    RETURN true;
  END IF;
  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.event_reveal_allowed(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_reveal_allowed(uuid, uuid, uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- Address. Unhidden events still return the public street. Hidden events
-- return the private street only after a commit.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.public_event_location(
  p_event_id uuid,
  p_order_id uuid DEFAULT NULL,
  p_rsvp_id uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_hide boolean;
  v_public text;
  v_private text;
  v_venue text;
  v_city text;
  v_state text;
BEGIN
  SELECT hide_address, address, venue, city, state
    INTO v_hide, v_public, v_venue, v_city, v_state
  FROM public.events
  WHERE id = p_event_id
    AND (is_public IS TRUE OR creator_id = auth.uid());
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  IF v_hide IS NOT TRUE THEN
    RETURN NULLIF(concat_ws(', ', v_venue, v_public, v_city, v_state), '');
  END IF;
  IF NOT public.event_reveal_allowed(p_event_id, p_order_id, p_rsvp_id) THEN
    RETURN NULL;
  END IF;
  SELECT private_address INTO v_private
  FROM public.event_secrets
  WHERE event_id = p_event_id;
  RETURN NULLIF(concat_ws(', ', v_venue, COALESCE(v_private, v_public), v_city, v_state), '');
END;
$$;

REVOKE ALL ON FUNCTION public.public_event_location(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_event_location(uuid, uuid, uuid) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Names and avatars. Empty until the caller has committed. No emails.
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.public_event_guest_preview(uuid);

CREATE OR REPLACE FUNCTION public.public_event_guest_preview(
  p_event_id uuid,
  p_order_id uuid DEFAULT NULL,
  p_rsvp_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_names jsonb;
  v_avatars jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = p_event_id AND e.is_public IS TRUE
  ) AND NOT public.event_reveal_allowed(p_event_id, p_order_id, p_rsvp_id) THEN
    RETURN jsonb_build_object('names', '[]'::jsonb, 'avatars', '[]'::jsonb, 'locked', true);
  END IF;
  IF NOT public.event_reveal_allowed(p_event_id, p_order_id, p_rsvp_id) THEN
    RETURN jsonb_build_object('names', '[]'::jsonb, 'avatars', '[]'::jsonb, 'locked', true);
  END IF;

  WITH going AS (
    SELECT COALESCE(NULLIF(btrim(a.attendee_name), ''), 'Guest') AS name,
           p.avatar_url,
           a.created_at
    FROM public.event_attendees a
    LEFT JOIN public.profiles_public p ON p.user_id = a.attendee_user_id
    WHERE a.event_id = p_event_id
      AND a.status IN ('registered', 'approved', 'checked_in')
    ORDER BY a.created_at
    LIMIT 24
  )
  SELECT
    COALESCE((SELECT jsonb_agg(name) FROM (SELECT name FROM going LIMIT 8) s), '[]'::jsonb),
    COALESCE((SELECT jsonb_agg(avatar_url) FROM (SELECT avatar_url FROM going LIMIT 5) s), '[]'::jsonb)
  INTO v_names, v_avatars;

  RETURN jsonb_build_object(
    'names', COALESCE(v_names, '[]'::jsonb),
    'avatars', COALESCE(v_avatars, '[]'::jsonb),
    'locked', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.public_event_guest_preview(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_event_guest_preview(uuid, uuid, uuid) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Host notes. Public when the host leaves the switch off. Otherwise only
-- after a commit. The text is not a column anon can select.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.public_event_host_notes(
  p_event_id uuid,
  p_order_id uuid DEFAULT NULL,
  p_rsvp_id uuid DEFAULT NULL
) RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_notes text;
  v_hide boolean;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = p_event_id
      AND (e.is_public IS TRUE OR e.creator_id = auth.uid())
  ) THEN
    RETURN NULL;
  END IF;
  SELECT NULLIF(btrim(s.host_notes), ''), COALESCE(s.hide_host_notes, e.hide_host_notes, false)
    INTO v_notes, v_hide
  FROM public.events e
  LEFT JOIN public.event_secrets s ON s.event_id = e.id
  WHERE e.id = p_event_id;
  IF v_notes IS NULL THEN
    RETURN NULL;
  END IF;
  IF v_hide IS NOT TRUE THEN
    RETURN v_notes;
  END IF;
  IF public.event_reveal_allowed(p_event_id, p_order_id, p_rsvp_id) THEN
    RETURN v_notes;
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.public_event_host_notes(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_event_host_notes(uuid, uuid, uuid) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Host save. Extra arguments are optional so older clients keep working.
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.set_event_access(uuid, boolean, text, text, boolean);

CREATE OR REPLACE FUNCTION public.set_event_access(
  p_event_id uuid,
  p_hide_address boolean,
  p_private_address text,
  p_password text,
  p_password_protected boolean,
  p_host_notes text DEFAULT NULL,
  p_hide_host_notes boolean DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
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
      hide_host_notes = COALESCE(p_hide_host_notes, hide_host_notes),
      address = CASE
        WHEN COALESCE(p_hide_address, false) THEN NULL
        ELSE NULLIF(btrim(COALESCE(p_private_address, '')), '')
      END
  WHERE id = p_event_id;

  INSERT INTO public.event_secrets (
    event_id, private_address, access_password, host_notes, hide_host_notes
  )
  VALUES (
    p_event_id,
    NULLIF(btrim(COALESCE(p_private_address, '')), ''),
    CASE
      WHEN NOT COALESCE(p_password_protected, false) THEN NULL
      WHEN p_password IS NULL OR btrim(p_password) = '' THEN NULL
      ELSE crypt(p_password, gen_salt('bf'))
    END,
    CASE WHEN p_host_notes IS NULL THEN NULL ELSE NULLIF(btrim(p_host_notes), '') END,
    COALESCE(p_hide_host_notes, false)
  )
  ON CONFLICT (event_id) DO UPDATE SET
    private_address = EXCLUDED.private_address,
    access_password = CASE
      WHEN NOT COALESCE(p_password_protected, false) THEN NULL
      WHEN p_password IS NULL OR btrim(p_password) = '' THEN public.event_secrets.access_password
      ELSE EXCLUDED.access_password
    END,
    host_notes = CASE
      WHEN p_host_notes IS NULL THEN public.event_secrets.host_notes
      ELSE EXCLUDED.host_notes
    END,
    hide_host_notes = COALESCE(p_hide_host_notes, public.event_secrets.hide_host_notes),
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.set_event_access(uuid, boolean, text, text, boolean, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_event_access(uuid, boolean, text, text, boolean, text, boolean) TO authenticated;

-- ---------------------------------------------------------------------------
-- Signed-out RSVP. Rate limited. Free events only. Consent defaults off.
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.create_guest_event_rsvp(uuid, text, text, text, uuid);
DROP FUNCTION IF EXISTS public.create_guest_event_rsvp(uuid, text, text, text);

CREATE OR REPLACE FUNCTION public.create_guest_event_rsvp(
  p_event_id uuid,
  p_guest_name text,
  p_guest_email text,
  p_guest_phone text DEFAULT NULL,
  p_campaign_id uuid DEFAULT NULL,
  p_nearby_consent boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
  v_status text;
  v_email text;
  v_phone text;
  v_consent boolean := COALESCE(p_nearby_consent, false);
BEGIN
  IF p_guest_name IS NULL OR btrim(p_guest_name) = '' OR length(btrim(p_guest_name)) > 100 THEN
    RAISE EXCEPTION 'name required';
  END IF;
  v_email := lower(btrim(COALESCE(p_guest_email, '')));
  IF v_email = '' OR position('@' in v_email) = 0 OR length(v_email) > 255 THEN
    RAISE EXCEPTION 'email required';
  END IF;
  v_phone := NULLIF(btrim(COALESCE(p_guest_phone, '')), '');
  IF v_phone IS NOT NULL AND length(v_phone) > 40 THEN
    RAISE EXCEPTION 'phone invalid';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = p_event_id
      AND e.is_public IS TRUE
      AND e.status IS DISTINCT FROM 'draft'
  ) THEN
    RAISE EXCEPTION 'event not found';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = p_event_id
      AND e.ticket_type IN ('paid', 'credits', 'hybrid')
  ) OR EXISTS (
    SELECT 1 FROM public.ticket_tiers t
    WHERE t.event_id = p_event_id
      AND t.is_active IS TRUE
      AND COALESCE(t.price_cents, 0) > 0
  ) THEN
    RAISE EXCEPTION 'tickets required';
  END IF;
  PERFORM public.consume_guest_quota('guest_rsvp_email', v_email, 8, 86400);
  PERFORM public.consume_guest_quota('guest_rsvp_global', 'all', 400, 3600);
  IF p_campaign_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.notification_campaigns WHERE id = p_campaign_id
  ) THEN
    p_campaign_id := NULL;
  END IF;
  INSERT INTO public.event_rsvps (
    event_id, user_id, status, guest_name, guest_email, guest_phone, campaign_id,
    nearby_events_consent, nearby_events_consent_at
  ) VALUES (
    p_event_id, NULL, 'going', btrim(p_guest_name), v_email, v_phone, p_campaign_id,
    v_consent, CASE WHEN v_consent THEN now() ELSE NULL END
  )
  RETURNING id, status INTO v_id, v_status;
  RETURN jsonb_build_object('id', v_id, 'status', v_status);
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'already rsvped';
END;
$$;

REVOKE ALL ON FUNCTION public.create_guest_event_rsvp(uuid, text, text, text, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_guest_event_rsvp(uuid, text, text, text, uuid, boolean) TO anon, authenticated, service_role;
