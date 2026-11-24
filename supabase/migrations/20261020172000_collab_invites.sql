-- Collab invites are written by security-definer RPCs so the recipient gets a
-- notification. Client inserts into notifications are blocked by RLS.

CREATE TABLE IF NOT EXISTS public.collab_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  conversation_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  UNIQUE (sender_id, recipient_id)
);

ALTER TABLE public.collab_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Collab parties read invites" ON public.collab_invites;
CREATE POLICY "Collab parties read invites"
ON public.collab_invites
FOR SELECT
TO authenticated
USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE OR REPLACE FUNCTION public.send_collab_invite(p_recipient uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_id uuid;
  v_status text;
  v_name text;
BEGIN
  IF v_user IS NULL OR p_recipient IS NULL OR p_recipient = v_user THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_recipient) THEN
    RAISE EXCEPTION 'That person is not on Ether';
  END IF;

  SELECT id, status INTO v_id, v_status
  FROM public.collab_invites
  WHERE sender_id = v_user AND recipient_id = p_recipient;

  IF v_id IS NOT NULL AND v_status = 'pending' THEN
    RETURN jsonb_build_object('id', v_id, 'status', 'pending');
  END IF;

  INSERT INTO public.collab_invites (sender_id, recipient_id, status, responded_at)
  VALUES (v_user, p_recipient, 'pending', NULL)
  ON CONFLICT (sender_id, recipient_id) DO UPDATE
    SET status = 'pending', responded_at = NULL, created_at = now()
  RETURNING id INTO v_id;

  SELECT COALESCE(display_name, 'Someone') INTO v_name
  FROM public.profiles WHERE user_id = v_user;

  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    p_recipient,
    'collab_invite',
    'Collab invite',
    COALESCE(v_name, 'Someone') || ' wants to match',
    jsonb_build_object('invite_id', v_id, 'sender_id', v_user)
  );

  RETURN jsonb_build_object('id', v_id, 'status', 'pending');
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_collab_invite(p_invite_id uuid, p_accept boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_sender uuid;
  v_status text;
  v_conv uuid;
  v_name text;
BEGIN
  IF v_user IS NULL OR p_invite_id IS NULL THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  SELECT sender_id, status, conversation_id
    INTO v_sender, v_status, v_conv
  FROM public.collab_invites
  WHERE id = p_invite_id AND recipient_id = v_user;

  IF v_sender IS NULL THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;

  IF p_accept IS NOT TRUE THEN
    UPDATE public.collab_invites
      SET status = 'declined', responded_at = now()
      WHERE id = p_invite_id;
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      v_sender, 'collab_invite', 'Invite declined',
      'They passed on the collab invite',
      jsonb_build_object('invite_id', p_invite_id, 'accepted', false)
    );
    RETURN jsonb_build_object('status', 'declined');
  END IF;

  IF v_conv IS NULL THEN
    SELECT c.id INTO v_conv
    FROM public.conversations c
    JOIN public.conversation_participants a
      ON a.conversation_id = c.id AND a.user_id = v_sender
    JOIN public.conversation_participants b
      ON b.conversation_id = c.id AND b.user_id = v_user
    WHERE c.type = 'direct'
    LIMIT 1;
  END IF;

  IF v_conv IS NULL THEN
    INSERT INTO public.conversations (type, created_by)
    VALUES ('direct', v_user)
    RETURNING id INTO v_conv;

    INSERT INTO public.conversation_participants (conversation_id, user_id)
    VALUES (v_conv, v_user), (v_conv, v_sender);
  END IF;

  UPDATE public.collab_invites
    SET status = 'accepted', conversation_id = v_conv, responded_at = now()
    WHERE id = p_invite_id;

  SELECT COALESCE(display_name, 'Someone') INTO v_name
  FROM public.profiles WHERE user_id = v_user;

  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    v_sender, 'collab_invite', 'Invite accepted',
    COALESCE(v_name, 'Someone') || ' opened a chat',
    jsonb_build_object('invite_id', p_invite_id, 'conversation_id', v_conv, 'accepted', true)
  );

  RETURN jsonb_build_object('status', 'accepted', 'conversation_id', v_conv);
END;
$$;

REVOKE ALL ON FUNCTION public.send_collab_invite(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.respond_collab_invite(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_collab_invite(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_collab_invite(uuid, boolean) TO authenticated;
