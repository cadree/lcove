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
--
-- The invite also lands as a card in the two people's direct chat
-- (messages.shared_invite_id), created through get_or_create_direct_conversation
-- so the match-only DM rule still applies. Only the app can post a card.
-- Accepting never counts as joining: projects go to the role picker
-- (item_invite_apply; an invite from the owner is accepted on the spot,
-- otherwise it is a normal pending application), events go to the ticket
-- step (paid) or the RSVP button (free). The card says Going only after a
-- real RSVP or ticket.
-- Accepted project members are added to the project's main group chat by a
-- trigger on project_applications, whatever path accepted them.
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
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  CONSTRAINT item_invites_not_self CHECK (sender_id <> recipient_id),
  CONSTRAINT item_invites_one_per_person UNIQUE (item_type, item_id, recipient_id)
);

-- Re-runs after an earlier version of this file.
ALTER TABLE public.item_invites ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL;
ALTER TABLE public.item_invites ADD COLUMN IF NOT EXISTS message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL;

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

-- Invite card in the direct chat. Only post_item_invite_card may set it
-- (a transaction-local flag), and only for the invite's own sender.
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS shared_invite_id uuid REFERENCES public.item_invites(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.guard_invite_card()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    NEW.shared_invite_id := NULL;
    RETURN NEW;
  END IF;
  IF NEW.shared_invite_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.shared_invite_id IS DISTINCT FROM OLD.shared_invite_id) THEN
    IF current_setting('ether.invite_card', true) IS DISTINCT FROM 'on'
       OR NOT EXISTS (SELECT 1 FROM public.item_invites i
                      WHERE i.id = NEW.shared_invite_id AND i.sender_id = NEW.sender_id) THEN
      RAISE EXCEPTION 'Invite cards are sent by the app' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_invite_card ON public.messages;
CREATE TRIGGER guard_invite_card
BEFORE INSERT OR UPDATE ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.guard_invite_card();

-- Paid, credits, hybrid or info events, or any paid tier, need the ticket step
-- (same rule as eventIsFree in the app).
CREATE OR REPLACE FUNCTION public.item_invite_ticket_required(p_event uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = p_event
      AND (coalesce(e.ticket_type, 'free') IN ('paid', 'credits', 'hybrid', 'info')
           OR EXISTS (SELECT 1 FROM public.ticket_tiers t
                      WHERE t.event_id = e.id AND t.is_active AND coalesce(t.price_cents, 0) > 0))
  );
$$;

CREATE OR REPLACE FUNCTION public.item_invite_path(p_invite uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN i.item_type = 'project' THEN '/project/' || i.item_id::text || '?invite=' || i.id::text
    WHEN public.item_invite_ticket_required(i.item_id) THEN '/event/' || i.item_id::text || '/tickets'
    ELSE '/event/' || i.item_id::text || '?invite=' || i.id::text
  END
  FROM public.item_invites i WHERE i.id = p_invite;
$$;

-- Post the card in the sender's direct chat with the invitee. Uses
-- get_or_create_direct_conversation, so blocks and match-only DMs apply; if
-- a chat is not allowed the invite and its notice still go, without a card.
CREATE OR REPLACE FUNCTION public.post_item_invite_card(p_invite uuid, p_title text)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  inv public.item_invites%ROWTYPE;
  v_conv uuid;
  v_msg uuid;
BEGIN
  SELECT * INTO inv FROM public.item_invites WHERE id = p_invite;
  IF NOT FOUND OR inv.sender_id IS DISTINCT FROM auth.uid() THEN RETURN NULL; END IF;
  BEGIN
    v_conv := public.get_or_create_direct_conversation(inv.recipient_id);
    PERFORM set_config('ether.invite_card', 'on', true);
    INSERT INTO public.messages (conversation_id, sender_id, content, shared_invite_id)
    VALUES (v_conv, inv.sender_id, 'Invited you to ' || left(coalesce(nullif(btrim(p_title), ''), 'this'), 120), inv.id)
    RETURNING id INTO v_msg;
    PERFORM set_config('ether.invite_card', 'off', true);
    UPDATE public.item_invites SET conversation_id = v_conv, message_id = v_msg WHERE id = inv.id;
    RETURN v_conv;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
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
  v_already boolean := false;
  v_conv uuid;
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
      v_already := EXISTS (SELECT 1 FROM public.project_applications pa
                         WHERE pa.project_id = p_item AND pa.applicant_id = p_invitee AND pa.status = 'accepted');
    ELSE
      v_already := EXISTS (SELECT 1 FROM public.event_rsvps r
                         WHERE r.event_id = p_item AND r.user_id = p_invitee AND r.status IN ('going', 'interested', 'waitlist'));
    END IF;
  END IF;
  -- Someone who turned project/event invites off still gets the row (and the
  -- chat card, which is a normal DM), not the notice.
  v_quiet := v_already OR EXISTS (SELECT 1 FROM public.notification_preferences np
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


  IF NOT v_already THEN
    v_conv := public.post_item_invite_card(v_id, c.title);
  END IF;

  RETURN jsonb_build_object('id', v_id, 'status', 'sent', 'notified', NOT v_quiet, 'conversation_id', v_conv);
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
  v_next text;
BEGIN
  IF me IS NULL OR p_invite IS NULL OR p_accept IS NULL THEN RAISE EXCEPTION 'not allowed'; END IF;
  SELECT * INTO inv FROM public.item_invites WHERE id = p_invite AND recipient_id = me FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invite not found'; END IF;
  -- Where Join/RSVP leads: the role picker, the ticket step, or the event's RSVP.
  v_path := public.item_invite_path(inv.id);

  IF inv.status <> 'pending' THEN
    RETURN jsonb_build_object('status', inv.status, 'path', v_path, 'item_type', inv.item_type, 'item_id', inv.item_id);
  END IF;

  -- Accepting is "I'm interested". It is not an RSVP, a ticket or a role.
  UPDATE public.item_invites
  SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END, responded_at = now()
  WHERE id = p_invite;

  UPDATE public.notifications
  SET data = data || jsonb_build_object('accepted', p_accept), read_at = coalesce(read_at, now())
  WHERE user_id = me AND type = 'item_invite' AND data->>'invite_id' = p_invite::text;

  IF p_accept AND NOT public.either_blocked(me, inv.sender_id) THEN
    IF inv.item_type = 'project' THEN
      SELECT title INTO v_title FROM public.projects WHERE id = inv.item_id;
      v_next := 'Picking a role now.';
    ELSE
      SELECT title INTO v_title FROM public.events WHERE id = inv.item_id;
      v_next := CASE WHEN public.item_invite_ticket_required(inv.item_id) THEN 'Getting a ticket now.' ELSE 'RSVPing now.' END;
    END IF;
    v_title := left(coalesce(nullif(btrim(v_title), ''), 'your invite'), 120);
    SELECT coalesce(nullif(btrim(p.display_name), ''), 'Someone') INTO v_name
    FROM public.profiles p WHERE p.user_id = me;
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      inv.sender_id,
      'item_invite',
      coalesce(v_name, 'Someone') || ' accepted your invite to ' || v_title,
      v_next,
      jsonb_build_object('invite_id', inv.id, 'item_type', inv.item_type, 'item_id', inv.item_id,
                         'path', '/' || inv.item_type || '/' || inv.item_id::text, 'accepted', true, 'answer', true,
                         'conversation_id', inv.conversation_id)
    );
    -- A line from her under the card, so the two of them can talk about it.
    IF inv.conversation_id IS NOT NULL AND public.is_conversation_participant(inv.conversation_id, me) THEN
      BEGIN
        INSERT INTO public.messages (conversation_id, sender_id, content)
        VALUES (inv.conversation_id, me, 'Accepted your invite to ' || v_title || '. ' || v_next);
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;
  END IF;

  RETURN jsonb_build_object('status', CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END, 'path', v_path,
                            'item_type', inv.item_type, 'item_id', inv.item_id);
END;
$$;

-- What the chat card shows, for the sender or the invitee only. "stage" is
-- pending, declined, accepted, applied, joined or going. Going needs a real
-- RSVP or ticket; joined needs an accepted application.
CREATE OR REPLACE FUNCTION public.item_invite_card(p_invite uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  me uuid := auth.uid();
  inv public.item_invites%ROWTYPE;
  v_title text; v_cover text; v_start timestamptz; v_place text; v_live boolean := false;
  v_app_status text; v_role text; v_going boolean := false; v_stage text;
BEGIN
  SELECT * INTO inv FROM public.item_invites WHERE id = p_invite;
  IF NOT FOUND OR me IS NULL OR me NOT IN (inv.sender_id, inv.recipient_id)
     OR public.either_blocked(inv.sender_id, inv.recipient_id) THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;

  IF inv.item_type = 'project' THEN
    SELECT p.title, p.cover_image_url, p.timeline_start::timestamptz, nullif(btrim(coalesce(p.venue, '')), ''),
           p.removed_at IS NULL AND p.hidden_at IS NULL
    INTO v_title, v_cover, v_start, v_place, v_live
    FROM public.projects p WHERE p.id = inv.item_id;
    SELECT pa.status, r.role_name INTO v_app_status, v_role
    FROM public.project_applications pa
    LEFT JOIN public.project_roles r ON r.id = pa.role_id
    WHERE pa.project_id = inv.item_id AND pa.applicant_id = inv.recipient_id AND pa.status IN ('pending', 'accepted')
    ORDER BY (pa.status = 'accepted') DESC, pa.created_at DESC
    LIMIT 1;
  ELSE
    SELECT e.title, e.image_url, e.start_date,
           nullif(concat_ws(', ', nullif(btrim(coalesce(e.venue, '')), ''), nullif(btrim(coalesce(e.city, '')), '')), ''),
           e.removed_at IS NULL AND e.hidden_at IS NULL
    INTO v_title, v_cover, v_start, v_place, v_live
    FROM public.events e WHERE e.id = inv.item_id;
    v_going := EXISTS (SELECT 1 FROM public.event_rsvps r
                       WHERE r.event_id = inv.item_id AND r.user_id = inv.recipient_id AND r.status = 'going')
            OR EXISTS (SELECT 1 FROM public.event_attendees a
                       WHERE a.event_id = inv.item_id AND a.attendee_user_id = inv.recipient_id
                         AND a.status IN ('registered', 'approved', 'checked_in'));
  END IF;

  v_stage := CASE
    WHEN v_app_status = 'accepted' THEN 'joined'
    WHEN v_app_status = 'pending' THEN 'applied'
    WHEN v_going THEN 'going'
    ELSE inv.status
  END;

  RETURN jsonb_build_object(
    'invite_id', inv.id,
    'item_type', inv.item_type,
    'item_id', inv.item_id,
    'title', coalesce(v_title, CASE inv.item_type WHEN 'project' THEN 'A project' ELSE 'An event' END),
    'cover_url', v_cover,
    'starts_at', v_start,
    'place', v_place,
    'available', coalesce(v_live, false),
    'status', inv.status,
    'stage', v_stage,
    'role_name', v_role,
    'viewer', CASE WHEN me = inv.recipient_id THEN 'invitee' ELSE 'sender' END,
    'invitee_name', (SELECT nullif(btrim(p.display_name), '') FROM public.profiles p WHERE p.user_id = inv.recipient_id),
    'ticket_required', inv.item_type = 'event' AND public.item_invite_ticket_required(inv.item_id),
    'path', public.item_invite_path(inv.id)
  );
END;
$$;

-- The invitee picks a role. An invite from the project owner is the owner's
-- yes, so she is accepted on the spot (and the chat trigger adds her to the
-- project chat). An invite from anyone else is a normal pending application.
CREATE OR REPLACE FUNCTION public.item_invite_apply(p_invite uuid, p_role uuid, p_message text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  me uuid := auth.uid();
  inv public.item_invites%ROWTYPE;
  proj public.projects%ROWTYPE;
  role_row public.project_roles%ROWTYPE;
  v_app uuid;
  v_existing text;
  v_status text := 'pending';
  v_chat uuid;
  v_name text;
BEGIN
  IF me IS NULL OR p_invite IS NULL OR p_role IS NULL THEN RAISE EXCEPTION 'Pick a role'; END IF;
  IF NOT public.invite_account_ok(me) THEN RAISE EXCEPTION 'Your account cannot join projects right now'; END IF;
  SELECT * INTO inv FROM public.item_invites WHERE id = p_invite AND recipient_id = me AND item_type = 'project' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invite not found'; END IF;
  IF inv.status = 'declined' THEN RAISE EXCEPTION 'You passed on this invite'; END IF;

  SELECT * INTO proj FROM public.projects WHERE id = inv.item_id;
  IF NOT FOUND OR proj.removed_at IS NOT NULL OR proj.hidden_at IS NOT NULL OR proj.status NOT IN ('open', 'in_progress') THEN
    RAISE EXCEPTION 'This project is not taking people right now';
  END IF;
  IF public.either_blocked(me, proj.creator_id) THEN RAISE EXCEPTION 'This project is unavailable'; END IF;
  SELECT * INTO role_row FROM public.project_roles WHERE id = p_role AND project_id = proj.id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pick a role on this project'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('ether-project-apply:' || proj.id::text || ':' || me::text, 0));
  SELECT pa.id, pa.status INTO v_app, v_existing
  FROM public.project_applications pa
  WHERE pa.project_id = proj.id AND pa.applicant_id = me AND pa.status IN ('pending', 'accepted')
  ORDER BY (pa.status = 'accepted') DESC
  LIMIT 1;
  IF v_app IS NOT NULL THEN
    RETURN jsonb_build_object('status', v_existing, 'application_id', v_app, 'already', true);
  END IF;
  IF role_row.is_locked OR role_row.slots_filled >= role_row.slots_available THEN
    RAISE EXCEPTION 'That role is full. Pick another one.';
  END IF;

  UPDATE public.item_invites SET status = 'accepted', responded_at = coalesce(responded_at, now())
  WHERE id = inv.id AND status = 'pending';

  INSERT INTO public.project_applications (project_id, role_id, applicant_id, message, status)
  VALUES (proj.id, role_row.id, me, nullif(left(btrim(coalesce(p_message, '')), 2000), ''), 'pending')
  RETURNING id INTO v_app;

  IF inv.sender_id = proj.creator_id THEN
    UPDATE public.project_applications SET status = 'accepted', reviewed_by = proj.creator_id WHERE id = v_app;
    v_status := 'accepted';
    SELECT coalesce(nullif(btrim(p.display_name), ''), 'Someone') INTO v_name FROM public.profiles p WHERE p.user_id = me;
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (proj.creator_id, 'item_invite',
            coalesce(v_name, 'Someone') || ' joined ' || left(coalesce(nullif(btrim(proj.title), ''), 'your project'), 120),
            'As ' || role_row.role_name || '. They are in the project chat.',
            jsonb_build_object('invite_id', inv.id, 'item_type', 'project', 'item_id', proj.id,
                               'path', '/project/' || proj.id::text, 'accepted', true, 'answer', true));
  END IF;

  SELECT c.id INTO v_chat
  FROM public.conversations c
  JOIN public.conversation_participants cp ON cp.conversation_id = c.id AND cp.user_id = me
  WHERE c.project_id = proj.id AND c.type = 'group' AND NOT coalesce(c.is_client_chat, false) AND c.parent_conversation_id IS NULL
  LIMIT 1;

  RETURN jsonb_build_object('status', v_status, 'application_id', v_app, 'chat_id', v_chat, 'role_name', role_row.role_name);
END;
$$;

-- Same as prod's enforce_project_conversation, plus one exemption: the
-- accepted-member trigger below may create a project's main chat for its
-- owner while someone else is signed in. Only server code sets the flag.
CREATE OR REPLACE FUNCTION public.enforce_project_conversation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  parent public.conversations%ROWTYPE;
BEGIN
  IF NEW.project_id IS NULL AND NEW.parent_conversation_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.parent_conversation_id IS NULL
     AND NOT COALESCE(NEW.is_client_chat, false)
     AND current_setting('ether.project_chat_for', true) = NEW.project_id::text
     AND public.is_project_creator(NEW.project_id, NEW.created_by) THEN
    RETURN NEW;
  END IF;

  IF NEW.created_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Conversation creator must be the signed-in user';
  END IF;

  IF NEW.parent_conversation_id IS NOT NULL THEN
    SELECT * INTO parent FROM public.conversations WHERE id = NEW.parent_conversation_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Parent chat not found';
    END IF;
    IF parent.parent_conversation_id IS NOT NULL THEN
      RAISE EXCEPTION 'Subgroups cannot contain their own subgroups';
    END IF;
    IF COALESCE(parent.is_client_chat, false) THEN
      RAISE EXCEPTION 'Subgroups belong to the main project chat';
    END IF;
    IF parent.project_id IS NULL OR NEW.project_id IS DISTINCT FROM parent.project_id THEN
      RAISE EXCEPTION 'Subgroup must stay on the same project';
    END IF;
    IF NOT (
      public.is_conversation_participant(parent.id, auth.uid())
      OR public.is_project_creator(parent.project_id, auth.uid())
    ) THEN
      RAISE EXCEPTION 'Only project members can open a subgroup';
    END IF;
    NEW.type := 'group';
    NEW.visibility := 'private';
    RETURN NEW;
  END IF;

  IF NOT public.is_project_creator(NEW.project_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only the project owner can create the project chat';
  END IF;
  RETURN NEW;
END;
$function$;

-- Accepted members join the project's main group chat, however they were
-- accepted (owner review, custom role proposal, or an owner's invite).
-- Before this, only the owner's browser did it after a review, so other paths
-- (and failures there) left people out of the chat.
CREATE OR REPLACE FUNCTION public.add_accepted_member_to_project_chat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  proj public.projects%ROWTYPE;
  v_chat uuid;
  v_role text;
  v_name text;
BEGIN
  IF NEW.status IS DISTINCT FROM 'accepted' OR (TG_OP = 'UPDATE' AND OLD.status = 'accepted') THEN
    RETURN NEW;
  END IF;
  SELECT * INTO proj FROM public.projects WHERE id = NEW.project_id;
  IF NOT FOUND OR NEW.applicant_id IS NULL OR NEW.applicant_id = proj.creator_id THEN RETURN NEW; END IF;

  SELECT c.id INTO v_chat
  FROM public.conversations c
  WHERE c.project_id = NEW.project_id AND c.type = 'group' AND NOT coalesce(c.is_client_chat, false) AND c.parent_conversation_id IS NULL
  ORDER BY c.created_at, c.id
  LIMIT 1;

  IF v_chat IS NULL THEN
    -- The chat belongs to the owner. When the owner is not the one signed in
    -- (an owner's invite accepted by the invitee), enforce_project_conversation
    -- lets this trigger alone create it, through a transaction-local flag.
    BEGIN
      PERFORM set_config('ether.project_chat_for', NEW.project_id::text, true);
      INSERT INTO public.conversations (type, name, description, avatar_url, created_by, visibility, project_id)
      VALUES ('group', proj.title, coalesce(proj.description, 'Project group chat for ' || proj.title), proj.cover_image_url,
              proj.creator_id, 'private', proj.id)
      RETURNING id INTO v_chat;
      PERFORM set_config('ether.project_chat_for', '', true);
      INSERT INTO public.conversation_participants (conversation_id, user_id, role, project_role_name)
      VALUES (v_chat, proj.creator_id, 'owner', 'Owner')
      ON CONFLICT (conversation_id, user_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      PERFORM set_config('ether.project_chat_for', '', true);
      RAISE WARNING 'project chat not created: %', SQLERRM;
      RETURN NEW;
    END;
  END IF;

  IF EXISTS (SELECT 1 FROM public.conversation_participants WHERE conversation_id = v_chat AND user_id = NEW.applicant_id) THEN
    RETURN NEW;
  END IF;
  SELECT role_name INTO v_role FROM public.project_roles WHERE id = NEW.role_id;
  BEGIN
    INSERT INTO public.conversation_participants (conversation_id, user_id, role, project_role_name)
    VALUES (v_chat, NEW.applicant_id, 'member', coalesce(v_role, 'Member'));
  EXCEPTION WHEN OTHERS THEN
    -- A block between members, for example. The acceptance itself stands.
    RAISE WARNING 'project chat join skipped: %', SQLERRM;
    RETURN NEW;
  END;
  BEGIN
    SELECT coalesce(nullif(btrim(display_name), ''), 'New member') INTO v_name FROM public.profiles WHERE user_id = NEW.applicant_id;
    INSERT INTO public.messages (conversation_id, sender_id, content)
    VALUES (v_chat, proj.creator_id, '🎉 ' || coalesce(v_name, 'New member') || ' joined the project as ' || coalesce(v_role, 'a member'));
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS add_accepted_member_to_project_chat ON public.project_applications;
CREATE TRIGGER add_accepted_member_to_project_chat
AFTER INSERT OR UPDATE OF status ON public.project_applications
FOR EACH ROW EXECUTE FUNCTION public.add_accepted_member_to_project_chat();

REVOKE ALL ON FUNCTION public.invite_city_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.invite_account_ok(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.item_invite_candidates(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.item_invite_state(text, uuid, uuid, boolean, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.item_invite_targets(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.send_item_invite(text, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.respond_item_invite(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.item_invite_card(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.item_invite_apply(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.post_item_invite_card(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.item_invite_ticket_required(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.item_invite_path(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_invite_card() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.add_accepted_member_to_project_chat() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.invite_city_token(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.item_invite_targets(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_item_invite(text, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_item_invite(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.item_invite_card(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.item_invite_apply(uuid, uuid, text) TO authenticated;
