-- Copied verbatim from ether-prod (pg_get_functiondef, 2026-11-15) so the PGlite
-- invite checks run against the real chat, block, match and project-chat rules.
CREATE OR REPLACE FUNCTION public.can_read_conversation(p_conversation_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    p_user_id IS NOT NULL
    AND p_user_id IS NOT DISTINCT FROM auth.uid()
    AND (
      public.is_conversation_participant(p_conversation_id, p_user_id)
      OR EXISTS (
        SELECT 1
        FROM public.conversations c
        JOIN public.projects p ON p.id = c.project_id
        WHERE c.id = p_conversation_id
          AND p.creator_id = p_user_id
      )
    );
$function$
;
CREATE OR REPLACE FUNCTION public.creative_collab_consented(a uuid, b uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT EXISTS(SELECT 1 FROM public.collab_invites i
 WHERE ((i.sender_id=a AND i.recipient_id=b) OR (i.sender_id=b AND i.recipient_id=a))
 AND (i.status='accepted' OR (i.status='pending' AND i.recipient_id=auth.uid())));
$function$
;
CREATE OR REPLACE FUNCTION public.creative_dm_allowed(a uuid, b uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT a IS NOT NULL AND b IS NOT NULL AND NOT public.either_blocked(a,b)
 AND (NOT EXISTS(SELECT 1 FROM public.discovery_preferences WHERE user_id=b AND matches_only)
 OR public.creative_matched(a,b) OR public.creative_collab_consented(a,b));
$function$
;
CREATE OR REPLACE FUNCTION public.creative_matched(a uuid, b uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT EXISTS(SELECT 1 FROM public.creative_matches WHERE first_id=least(a,b) AND second_id=greatest(a,b) AND active)
 AND NOT public.either_blocked(a,b);
$function$
;
CREATE OR REPLACE FUNCTION public.enforce_creative_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF TG_OP='UPDATE' AND (NEW.sender_id<>OLD.sender_id OR NEW.conversation_id<>OLD.conversation_id) THEN RAISE EXCEPTION 'Message identity cannot be changed'; END IF;
 -- Permit deletion/redaction, even after an unmatch.
 IF TG_OP='UPDATE' AND NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;
 IF auth.uid() IS NULL THEN RETURN NEW; END IF;
 IF EXISTS(SELECT 1 FROM public.conversations c JOIN public.conversation_participants p ON p.conversation_id=c.id
 WHERE c.id=NEW.conversation_id AND c.type='direct' AND c.project_id IS NULL AND p.user_id<>NEW.sender_id
 AND (NOT public.creative_dm_allowed(NEW.sender_id,p.user_id) OR NOT public.creative_dm_allowed(p.user_id,NEW.sender_id))) THEN
 RAISE EXCEPTION 'One of you accepts DMs from mutual matches only. Match in Discover first.' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $function$
;
CREATE OR REPLACE FUNCTION public.enforce_creative_participant()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE conv public.conversations%ROWTYPE; peer record;
BEGIN
 IF TG_OP='UPDATE' AND (NEW.user_id<>OLD.user_id OR NEW.conversation_id<>OLD.conversation_id) THEN
  RAISE EXCEPTION 'Conversation membership cannot be moved';
 END IF;
 IF TG_OP='UPDATE' THEN RETURN NEW; END IF;
 SELECT * INTO conv FROM public.conversations WHERE id=NEW.conversation_id FOR UPDATE;
 IF conv.type='direct' AND conv.project_id IS NULL THEN
  IF (SELECT count(*) FROM public.conversation_participants WHERE conversation_id=NEW.conversation_id AND user_id<>NEW.user_id)>=2 THEN RAISE EXCEPTION 'Direct chats have exactly two participants'; END IF;
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  FOR peer IN SELECT user_id FROM public.conversation_participants WHERE conversation_id=NEW.conversation_id AND user_id<>NEW.user_id LOOP
   IF NOT public.creative_dm_allowed(peer.user_id,NEW.user_id) OR NOT public.creative_dm_allowed(NEW.user_id,peer.user_id) THEN
    RAISE EXCEPTION 'This person accepts DMs from mutual matches only. Match in Discover first.' USING ERRCODE='42501';
   END IF;
  END LOOP;
 END IF;
 RETURN NEW;
END $function$
;
CREATE OR REPLACE FUNCTION public.enforce_project_chat_member()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  conv public.conversations%ROWTYPE;
BEGIN
  SELECT * INTO conv FROM public.conversations WHERE id = NEW.conversation_id;
  IF conv.project_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- An invited client can join the private client thread before they accept.
  IF COALESCE(conv.is_client_chat, false) THEN
    IF NOT (
      public.is_project_creator(conv.project_id, NEW.user_id)
      OR NEW.user_id = conv.created_by
      OR EXISTS (
        SELECT 1
        FROM public.project_clients pc
        WHERE pc.project_id = conv.project_id
          AND pc.client_user_id = NEW.user_id
          AND pc.status IN ('invited', 'accepted')
      )
    ) THEN
      RAISE EXCEPTION 'Only the owner and invited clients can join this chat';
    END IF;
    RETURN NEW;
  END IF;

  IF NOT (
    public.is_project_creator(conv.project_id, NEW.user_id)
    OR EXISTS (
      SELECT 1
      FROM public.project_applications pa
      WHERE pa.project_id = conv.project_id
        AND pa.applicant_id = NEW.user_id
        AND pa.status = 'accepted'
    )
    OR public.is_project_client(conv.project_id, NEW.user_id)
    OR NEW.user_id = conv.created_by
  ) THEN
    RAISE EXCEPTION 'Only project members can join this chat';
  END IF;

  IF conv.parent_conversation_id IS NOT NULL THEN
    IF NOT (
      public.is_conversation_participant(conv.parent_conversation_id, NEW.user_id)
      OR public.is_project_creator(conv.project_id, NEW.user_id)
    ) THEN
      RAISE EXCEPTION 'Subgroup members come from the main project chat';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$
;
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
$function$
;
CREATE OR REPLACE FUNCTION public.get_or_create_direct_conversation(p_other uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  IF NOT public.creative_dm_allowed(v_me,p_other) OR NOT public.creative_dm_allowed(p_other,v_me) THEN
    RAISE EXCEPTION 'This person accepts DMs from mutual matches only. Match in Discover first.' USING ERRCODE='42501';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('ether-direct:' || least(v_me::text, p_other::text) || ':' || greatest(v_me::text, p_other::text), 0)
  );

  SELECT c.id INTO v_id
  FROM public.conversations c
  WHERE c.type = 'direct'
    AND c.project_id IS NULL
    AND (SELECT count(*) FROM public.conversation_participants cp WHERE cp.conversation_id=c.id)=2
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
$function$
;
CREATE OR REPLACE FUNCTION public.handle_application_accepted()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    UPDATE public.project_roles 
    SET slots_filled = slots_filled + 1,
        is_locked = CASE WHEN slots_filled + 1 >= slots_available THEN true ELSE is_locked END
    WHERE id = NEW.role_id;
    NEW.reviewed_at = now();
  END IF;
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.is_conversation_participant(conv_id uuid, uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = conv_id AND user_id = uid
  )
$function$
;
CREATE OR REPLACE FUNCTION public.is_project_client(p_project_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.project_clients
    WHERE project_id = p_project_id AND client_user_id = p_user_id AND status = 'accepted'
  )
$function$
;
CREATE OR REPLACE FUNCTION public.is_project_creator(p_project_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = p_project_id AND creator_id = p_user_id
  )
$function$
;
CREATE OR REPLACE FUNCTION public.prevent_blocked_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF public.sender_blocked_in_conversation(NEW.conversation_id, NEW.sender_id) THEN
    RAISE EXCEPTION 'You cannot message this person'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.prevent_blocked_participant()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF public.either_blocked(NEW.user_id, auth.uid()) THEN
    RAISE EXCEPTION 'You cannot message this person'
      USING ERRCODE = '42501';
  END IF;

  IF auth.uid() = NEW.user_id AND EXISTS (
    SELECT 1
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = NEW.conversation_id
      AND public.either_blocked(cp.user_id, NEW.user_id)
  ) THEN
    RAISE EXCEPTION 'You cannot message this person'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.scrub_unsent_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
 IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
  NEW.content := NULL;
  NEW.media_url := NULL;
  NEW.media_type := NULL;
  NEW.shared_post_id := NULL;
  NEW.shared_story_id := NULL;
  NEW.shared_profile_id := NULL;
  NEW.shared_from_message_id := NULL;
  NEW.shared_from_conversation_id := NULL;
 END IF;
 RETURN NEW;
END $function$
;
CREATE OR REPLACE FUNCTION public.sender_blocked_in_conversation(_conversation_id uuid, _sender uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = _conversation_id
      AND cp.user_id <> _sender
      AND public.either_blocked(cp.user_id, _sender)
  );
$function$
;
CREATE OR REPLACE FUNCTION public.update_conversation_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.conversations SET updated_at = NOW() WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$function$
;
