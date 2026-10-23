-- Story likes use the existing notifications table.
-- The like insert policy only allows a post_likes row, so a story heart
-- was saved and then rejected. This policy is additive: permissive INSERT
-- policies are OR'd.
--
-- Story replies and shares must land in one personal direct chat.
-- Two quick sends were able to create two chats and leave the first reply
-- in the one the owner did not open.

CREATE OR REPLACE FUNCTION public.viewer_liked_story(p_story_id uuid, p_owner uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.story_reactions r
    JOIN public.stories s ON s.id = r.story_id
    WHERE r.story_id = p_story_id
      AND r.user_id = auth.uid()
      AND r.emoji = '❤️'
      AND s.user_id = p_owner
      AND s.user_id IS DISTINCT FROM auth.uid()
      AND NOT public.has_blocked(auth.uid(), s.user_id)
      AND NOT public.has_blocked(s.user_id, auth.uid())
  );
$$;

REVOKE ALL ON FUNCTION public.viewer_liked_story(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.viewer_liked_story(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Story likes the viewer caused" ON public.notifications;
CREATE POLICY "Story likes the viewer caused"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND type = 'like'
  AND user_id IS DISTINCT FROM auth.uid()
  AND COALESCE(data->>'story_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND public.viewer_liked_story((data->>'story_id')::uuid, user_id)
);

CREATE OR REPLACE FUNCTION public.get_or_create_direct_conversation(p_other uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Sign in to send'
      USING ERRCODE = '42501';
  END IF;
  IF p_other IS NULL OR p_other = v_me THEN
    RAISE EXCEPTION 'Choose someone else'
      USING ERRCODE = '22023';
  END IF;
  IF public.has_blocked(v_me, p_other) OR public.has_blocked(p_other, v_me) THEN
    RAISE EXCEPTION 'You cannot message this person'
      USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('ether-direct:' || least(v_me::text, p_other::text) || ':' || greatest(v_me::text, p_other::text), 0)
  );

  SELECT c.id INTO v_id
  FROM public.conversations c
  WHERE c.type = 'direct'
    AND c.project_id IS NULL
    AND EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = c.id AND cp.user_id = v_me
    )
    AND EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = c.id AND cp.user_id = p_other
    )
  ORDER BY c.created_at ASC, c.id ASC
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  INSERT INTO public.conversations (type, created_by)
  VALUES ('direct', v_me)
  RETURNING id INTO v_id;

  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES (v_id, v_me), (v_id, p_other);

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_direct_conversation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_direct_conversation(uuid) TO authenticated, service_role;
