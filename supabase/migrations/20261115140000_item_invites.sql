-- Invite someone you connected with to a project, gig or event that already
-- exists, instead of making a new one. The invitee gets an in-app notice
-- ("<name> invited you to <title>") with Join or RSVP, which opens the item.
--
-- Who can invite:
--   * the owner/host of the item (events: creator or an organization member),
--   * anyone, to an item that is publicly listed and still joinable
--     (public open/in-progress project or gig; public, published, upcoming,
--     not password-protected event). Members of a public item can therefore
--     invite too; private items are owner-only and are not offered yet,
--     because the invitee could not open them.
-- Never: yourself, a blocked pair (either way), a banned/suspended/deleted
-- account, or the same person twice for the same item (one row per person
-- per item, whoever sent it). A sender can send at most 40 invites an hour.
-- Writes go through the SECURITY DEFINER RPCs below. The table has no
-- client write policy. Sender and invitee can read their own rows.
-- Rollback: supabase/rollbacks/20261115140000_item_invites.down.sql

CREATE TABLE IF NOT EXISTS public.item_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type text NOT NULL CHECK (item_type IN ('project', 'event')),
  item_id uuid NOT NULL,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  CONSTRAINT item_invites_not_self CHECK (sender_id <> recipient_id),
  CONSTRAINT item_invites_one_per_person UNIQUE (item_type, item_id, recipient_id)
);

CREATE INDEX IF NOT EXISTS item_invites_recipient_idx ON public.item_invites (recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS item_invites_sender_idx ON public.item_invites (sender_id, created_at DESC);

ALTER TABLE public.item_invites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.item_invites FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.item_invites TO authenticated;
GRANT ALL ON public.item_invites TO service_role;

DROP POLICY IF EXISTS "Sender and invitee read item invites" ON public.item_invites;
CREATE POLICY "Sender and invitee read item invites"
ON public.item_invites
FOR SELECT
TO authenticated
USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

-- "Charlotte, NC", "charlotte|nc" and "Charlotte" all become "charlotte".
CREATE OR REPLACE FUNCTION public.invite_city_token(p_city text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT nullif(lower(btrim(split_part(split_part(coalesce(p_city, ''), '|', 1), ',', 1))), '');
$$;

-- Can this account be invited, or send invites? Not banned, suspended or deleted.
CREATE OR REPLACE FUNCTION public.invite_account_ok(p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = p_user
      AND p.access_status IS DISTINCT FROM 'banned'
      AND NOT coalesce(p.is_suspended, false)
      AND p.deleted_at IS NULL
  );
$$;

-- One row per item the viewer may invite to. role: 'host' (owner/manager),
-- 'member' (accepted on the project), 'going' (RSVP'd), or NULL (just listed).
CREATE OR REPLACE FUNCTION public.item_invite_candidates(p_viewer uuid)
RETURNS TABLE (
  item_type text,
  item_id uuid,
  owner_id uuid,
  title text,
  cover_url text,
  starts_at timestamptz,
  place text,
  city_token text,
  role text,
  is_public_listing boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT 'project'::text, p.id, p.creator_id, p.title, p.cover_image_url,
         p.timeline_start::timestamptz, nullif(btrim(coalesce(p.venue, '')), ''),
         public.invite_city_token(coalesce(cp.city_key, cp.city)),
         CASE
           WHEN p.creator_id = p_viewer THEN 'host'
           WHEN EXISTS (SELECT 1 FROM public.project_applications pa
                        WHERE pa.project_id = p.id AND pa.applicant_id = p_viewer AND pa.status = 'accepted') THEN 'member'
           ELSE NULL
         END,
         (p.status = 'open')
  FROM public.projects p
  LEFT JOIN public.profiles cp ON cp.user_id = p.creator_id
  WHERE p.removed_at IS NULL
    AND p.hidden_at IS NULL
    AND p.is_private = false
    AND p.status IN ('open', 'in_progress')
  UNION ALL
  SELECT 'event'::text, e.id, e.creator_id, e.title, e.image_url,
         e.start_date,
         nullif(concat_ws(', ', nullif(btrim(coalesce(e.venue, '')), ''), nullif(btrim(coalesce(e.city, '')), '')), ''),
         public.invite_city_token(e.city),
         CASE
           WHEN public.can_manage_event(e.id, p_viewer) THEN 'host'
           WHEN EXISTS (SELECT 1 FROM public.event_rsvps r
                        WHERE r.event_id = e.id AND r.user_id = p_viewer AND r.status IN ('going', 'interested', 'waitlist')) THEN 'going'
           ELSE NULL
         END,
         NOT coalesce(e.password_protected, false)
  FROM public.events e
  WHERE e.removed_at IS NULL
    AND e.hidden_at IS NULL
    AND e.is_public = true
    AND coalesce(e.status, 'published') = 'published'
    AND e.start_date IS NOT NULL
    AND coalesce(e.end_date, e.start_date) >= now();
$$;

-- Is the invitee already in? Only answered for items the viewer hosts; for
-- other items an RSVP stays private and the RPC reports 'available'.
CREATE OR REPLACE FUNCTION public.item_invite_state(p_type text, p_item uuid, p_owner uuid, p_viewer_hosts boolean, p_invitee uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_owner = p_invitee THEN 'host'
    WHEN p_viewer_hosts AND p_type = 'project' AND EXISTS (
      SELECT 1 FROM public.project_applications pa
      WHERE pa.project_id = p_item AND pa.applicant_id = p_invitee AND pa.status = 'accepted') THEN 'member'
    WHEN p_viewer_hosts AND p_type = 'event' AND EXISTS (
      SELECT 1 FROM public.event_rsvps r
      WHERE r.event_id = p_item AND r.user_id = p_invitee AND r.status IN ('going', 'interested', 'waitlist')) THEN 'going'
    WHEN EXISTS (
      SELECT 1 FROM public.item_invites i
      WHERE i.item_type = p_type AND i.item_id = p_item AND i.recipient_id = p_invitee) THEN 'invited'
    ELSE 'available'
  END;
$$;

-- The picker: "yours" (host/member/going) and "nearby" (listed in your city).
CREATE OR REPLACE FUNCTION public.item_invite_targets(p_invitee uuid, p_kind text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  me uuid := auth.uid();
  my_city text;
  result jsonb;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Sign in to invite people'; END IF;
  IF p_kind NOT IN ('project', 'event') THEN RAISE EXCEPTION 'Choose a project or an event'; END IF;
  IF p_invitee IS NULL OR p_invitee = me THEN RAISE EXCEPTION 'Choose someone else to invite'; END IF;
  IF public.either_blocked(me, p_invitee) OR NOT public.invite_account_ok(p_invitee) THEN
    RAISE EXCEPTION 'This profile is unavailable';
  END IF;

  SELECT public.invite_city_token(coalesce(p.city_key, p.city)) INTO my_city
  FROM public.profiles p WHERE p.user_id = me;

  SELECT coalesce(jsonb_agg(row_json ORDER BY sort_section, sort_time NULLS LAST, title), '[]'::jsonb)
  INTO result
  FROM (
    SELECT
      jsonb_build_object(
        'item_type', c.item_type,
        'item_id', c.item_id,
        'title', c.title,
        'cover_url', c.cover_url,
        'starts_at', c.starts_at,
        'place', c.place,
        'section', CASE WHEN c.role IS NOT NULL THEN 'yours' ELSE 'nearby' END,
        'role', c.role,
        'state', public.item_invite_state(c.item_type, c.item_id, c.owner_id, c.role = 'host', p_invitee)
      ) AS row_json,
      CASE WHEN c.role IS NOT NULL THEN 0 ELSE 1 END AS sort_section,
      c.starts_at AS sort_time,
      c.title
    FROM public.item_invite_candidates(me) c
    WHERE c.item_type = p_kind
      AND NOT public.either_blocked(c.owner_id, p_invitee)
      AND NOT public.either_blocked(c.owner_id, me)
      AND (
        c.role IS NOT NULL
        OR (c.is_public_listing AND my_city IS NOT NULL AND c.city_token = my_city)
      )
    LIMIT 60
  ) rows;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_item_invite(p_kind text, p_item uuid, p_invitee uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  me uuid := auth.uid();
  c record;
  v_state text;
  v_id uuid;
  v_name text;
  v_path text;
  v_quiet boolean := false;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Sign in to invite people'; END IF;
  IF p_kind NOT IN ('project', 'event') OR p_item IS NULL THEN RAISE EXCEPTION 'Choose a project or an event'; END IF;
  IF p_invitee IS NULL OR p_invitee = me THEN RAISE EXCEPTION 'Choose someone else to invite'; END IF;
  IF NOT public.invite_account_ok(me) THEN RAISE EXCEPTION 'Your account cannot send invites right now'; END IF;
  IF public.either_blocked(me, p_invitee) OR NOT public.invite_account_ok(p_invitee) THEN
    RAISE EXCEPTION 'This profile is unavailable';
  END IF;

  SELECT * INTO c FROM public.item_invite_candidates(me) x
  WHERE x.item_type = p_kind AND x.item_id = p_item;
  IF NOT FOUND OR (c.role IS NULL AND NOT c.is_public_listing) THEN
    RAISE EXCEPTION 'You cannot invite people to this';
  END IF;
  IF public.either_blocked(c.owner_id, p_invitee) OR public.either_blocked(c.owner_id, me) THEN
    RAISE EXCEPTION 'You cannot invite people to this';
  END IF;

  -- Serialize per (item, invitee) so two taps make one row and one notice.
  PERFORM pg_advisory_xact_lock(hashtextextended('ether-item-invite:' || p_kind || ':' || p_item::text || ':' || p_invitee::text, 0));

  SELECT i.id INTO v_id FROM public.item_invites i
  WHERE i.item_type = p_kind AND i.item_id = p_item AND i.recipient_id = p_invitee;
  IF v_id IS NOT NULL THEN
    RETURN jsonb_build_object('id', v_id, 'status', 'already_invited');
  END IF;

  v_state := public.item_invite_state(p_kind, p_item, c.owner_id, c.role = 'host', p_invitee);
  IF v_state IN ('host', 'member', 'going') THEN
    RETURN jsonb_build_object('status', 'already_in', 'state', v_state);
  END IF;

  IF (SELECT count(*) FROM public.item_invites i
      WHERE i.sender_id = me AND i.created_at > now() - interval '1 hour') >= 40 THEN
    RAISE EXCEPTION 'Too many invites in the last hour. Try again later.';
  END IF;

  INSERT INTO public.item_invites (item_type, item_id, sender_id, recipient_id)
  VALUES (p_kind, p_item, me, p_invitee)
  ON CONFLICT (item_type, item_id, recipient_id) DO NOTHING
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    SELECT i.id INTO v_id FROM public.item_invites i
    WHERE i.item_type = p_kind AND i.item_id = p_item AND i.recipient_id = p_invitee;
    RETURN jsonb_build_object('id', v_id, 'status', 'already_invited');
  END IF;

  -- A listed item the invitee already joined: keep the row, skip the notice.
  -- The sender sees "sent" and learns nothing about someone else's RSVP.
  IF c.role IS DISTINCT FROM 'host' THEN
    IF p_kind = 'project' THEN
      v_quiet := EXISTS (SELECT 1 FROM public.project_applications pa
                         WHERE pa.project_id = p_item AND pa.applicant_id = p_invitee AND pa.status = 'accepted');
    ELSE
      v_quiet := EXISTS (SELECT 1 FROM public.event_rsvps r
                         WHERE r.event_id = p_item AND r.user_id = p_invitee AND r.status IN ('going', 'interested', 'waitlist'));
    END IF;
  END IF;
  -- Someone who turned project/event invites off still gets the row, not the notice.
  v_quiet := v_quiet OR EXISTS (SELECT 1 FROM public.notification_preferences np
                                WHERE np.user_id = p_invitee AND np.project_invites_enabled = false);

  v_path := CASE p_kind WHEN 'project' THEN '/project/' ELSE '/event/' END || p_item::text;
  IF NOT v_quiet THEN
    SELECT coalesce(nullif(btrim(p.display_name), ''), 'Someone') INTO v_name
    FROM public.profiles p WHERE p.user_id = me;
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      p_invitee,
      'item_invite',
      coalesce(v_name, 'Someone') || ' invited you to ' || left(coalesce(nullif(btrim(c.title), ''), CASE p_kind WHEN 'project' THEN 'a project' ELSE 'an event' END), 120),
      CASE p_kind WHEN 'project' THEN 'Tap Join to see the project and pick a role.' ELSE 'Tap RSVP to see the event.' END,
      jsonb_build_object('invite_id', v_id, 'item_type', p_kind, 'item_id', p_item, 'sender_id', me, 'path', v_path)
    );
  END IF;

  RETURN jsonb_build_object('id', v_id, 'status', 'sent', 'notified', NOT v_quiet);
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_item_invite(p_invite uuid, p_accept boolean)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  me uuid := auth.uid();
  inv public.item_invites%ROWTYPE;
  v_path text;
  v_title text;
  v_name text;
BEGIN
  IF me IS NULL OR p_invite IS NULL OR p_accept IS NULL THEN RAISE EXCEPTION 'not allowed'; END IF;
  SELECT * INTO inv FROM public.item_invites WHERE id = p_invite AND recipient_id = me FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invite not found'; END IF;
  v_path := CASE inv.item_type WHEN 'project' THEN '/project/' ELSE '/event/' END || inv.item_id::text;

  IF inv.status <> 'pending' THEN
    RETURN jsonb_build_object('status', inv.status, 'path', v_path, 'item_type', inv.item_type, 'item_id', inv.item_id);
  END IF;

  UPDATE public.item_invites
  SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END, responded_at = now()
  WHERE id = p_invite;

  -- The invitee's notice shows it was answered.
  UPDATE public.notifications
  SET data = data || jsonb_build_object('accepted', p_accept), read_at = coalesce(read_at, now())
  WHERE user_id = me AND type = 'item_invite' AND data->>'invite_id' = p_invite::text;

  -- Accepting tells the sender. Declining stays quiet.
  IF p_accept AND NOT public.either_blocked(me, inv.sender_id) THEN
    IF inv.item_type = 'project' THEN
      SELECT title INTO v_title FROM public.projects WHERE id = inv.item_id;
    ELSE
      SELECT title INTO v_title FROM public.events WHERE id = inv.item_id;
    END IF;
    SELECT coalesce(nullif(btrim(p.display_name), ''), 'Someone') INTO v_name
    FROM public.profiles p WHERE p.user_id = me;
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      inv.sender_id,
      'item_invite',
      coalesce(v_name, 'Someone') || ' is checking out ' || left(coalesce(nullif(btrim(v_title), ''), 'your invite'), 120),
      'They accepted your invite.',
      jsonb_build_object('invite_id', inv.id, 'item_type', inv.item_type, 'item_id', inv.item_id, 'path', v_path, 'accepted', true, 'answer', true)
    );
  END IF;

  RETURN jsonb_build_object('status', CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END, 'path', v_path,
                            'item_type', inv.item_type, 'item_id', inv.item_id);
END;
$$;

REVOKE ALL ON FUNCTION public.invite_city_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.invite_account_ok(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.item_invite_candidates(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.item_invite_state(text, uuid, uuid, boolean, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.item_invite_targets(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.send_item_invite(text, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.respond_item_invite(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.invite_city_token(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.item_invite_targets(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_item_invite(text, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_item_invite(uuid, boolean) TO authenticated;
