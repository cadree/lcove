-- Private groups: join only by invite or an approved request.
-- The insert policy on conversation_participants allowed "user_id = auth.uid()" for any
-- conversation, so anyone holding a group id (from a link) could add themselves to a
-- private group, or to anyone's chat. Now:
--  * the conversation's creator, or an owner/moderator, adds people (invites, approvals);
--  * you add yourself only to a public group, or where your join request was approved;
--  * self-joins are plain members, a join request cannot be filed pre-approved, and
--    nobody can raise their own role afterwards.
-- Existing members are untouched. join_group() is the one call the app uses to join.
-- Rollback: supabase/rollbacks/20261114180000_private_group_joins.down.sql

CREATE OR REPLACE FUNCTION public.is_conversation_admin(p_conversation_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT p_user_id IS NOT NULL AND EXISTS (
  SELECT 1 FROM public.conversation_participants
  WHERE conversation_id = p_conversation_id AND user_id = p_user_id
   AND role IN ('owner'::public.group_member_role, 'moderator'::public.group_member_role));
$$;

CREATE OR REPLACE FUNCTION public.can_self_join_conversation(p_conversation_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS (
  SELECT 1 FROM public.conversations c
  WHERE c.id = p_conversation_id
   AND ((c.type = 'group' AND c.visibility = 'public'::public.group_visibility)
    OR EXISTS (SELECT 1 FROM public.collective_join_requests r
     WHERE r.conversation_id = c.id AND r.user_id = auth.uid() AND r.status = 'approved')));
$$;

REVOKE ALL ON FUNCTION public.is_conversation_admin(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_self_join_conversation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_conversation_admin(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_self_join_conversation(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Users can add participants to conversations they created" ON public.conversation_participants;
DROP POLICY IF EXISTS "Members join by invite, approval or an open group" ON public.conversation_participants;
CREATE POLICY "Members join by invite, approval or an open group" ON public.conversation_participants
 FOR INSERT TO public WITH CHECK (
  EXISTS (SELECT 1 FROM public.conversations c
   WHERE c.id = conversation_participants.conversation_id AND c.created_by = auth.uid())
  OR (public.is_conversation_admin(conversation_id, auth.uid()) AND role IS DISTINCT FROM 'owner'::public.group_member_role)
  OR (user_id = auth.uid() AND role = 'member'::public.group_member_role
   AND public.can_self_join_conversation(conversation_id)));

-- A request is filed as pending; only an owner or moderator decides it.
DROP POLICY IF EXISTS "Users can create requests" ON public.collective_join_requests;
DROP POLICY IF EXISTS "Users file pending join requests" ON public.collective_join_requests;
CREATE POLICY "Users file pending join requests" ON public.collective_join_requests
 FOR INSERT TO public WITH CHECK (
  auth.uid() = user_id AND coalesce(status, 'pending') = 'pending'
  AND reviewed_by IS NULL AND reviewed_at IS NULL);

-- Members may mute or mark read, but not promote themselves.
CREATE OR REPLACE FUNCTION public.guard_participant_role()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
 IF NEW.role IS DISTINCT FROM OLD.role AND current_user IN ('authenticated', 'anon') THEN
  RAISE EXCEPTION 'Only the group owner can change roles' USING ERRCODE = '42501';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_participant_role ON public.conversation_participants;
CREATE TRIGGER guard_participant_role BEFORE UPDATE OF role ON public.conversation_participants
 FOR EACH ROW EXECUTE FUNCTION public.guard_participant_role();

-- Join a group: public groups and approved requests join at once, anything else files
-- (or keeps) a pending request. Returns 'member', 'joined' or 'requested'.
CREATE OR REPLACE FUNCTION public.join_group(p_conversation_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE me uuid := auth.uid(); conv public.conversations%ROWTYPE;
BEGIN
 IF me IS NULL THEN RAISE EXCEPTION 'Sign in to join' USING ERRCODE = '42501'; END IF;
 SELECT * INTO conv FROM public.conversations WHERE id = p_conversation_id;
 IF NOT FOUND OR conv.type <> 'group' THEN RAISE EXCEPTION 'Group not found' USING ERRCODE = 'P0002'; END IF;
 IF public.is_conversation_participant(p_conversation_id, me) THEN RETURN 'member'; END IF;
 IF public.can_self_join_conversation(p_conversation_id) THEN
  INSERT INTO public.conversation_participants(conversation_id, user_id, role)
  VALUES (p_conversation_id, me, 'member');
  RETURN 'joined';
 END IF;
 INSERT INTO public.collective_join_requests(conversation_id, user_id)
 VALUES (p_conversation_id, me) ON CONFLICT (conversation_id, user_id) DO NOTHING;
 RETURN 'requested';
END $$;
REVOKE ALL ON FUNCTION public.join_group(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_group(uuid) TO authenticated, service_role;
