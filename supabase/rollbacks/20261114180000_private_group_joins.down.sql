-- Rollback of 20261114180000_private_group_joins.sql: restores the previous policies.
-- Note: this reopens the hole where anyone with a group id can add themselves.
DROP FUNCTION IF EXISTS public.join_group(uuid);
DROP TRIGGER IF EXISTS guard_participant_role ON public.conversation_participants;
DROP FUNCTION IF EXISTS public.guard_participant_role();
DROP POLICY IF EXISTS "Users file pending join requests" ON public.collective_join_requests;
DROP POLICY IF EXISTS "Users can create requests" ON public.collective_join_requests;
CREATE POLICY "Users can create requests" ON public.collective_join_requests
 FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Members join by invite, approval or an open group" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can add participants to conversations they created" ON public.conversation_participants;
CREATE POLICY "Users can add participants to conversations they created" ON public.conversation_participants
 FOR INSERT TO public WITH CHECK (((EXISTS ( SELECT 1
   FROM public.conversations
  WHERE ((conversations.id = conversation_participants.conversation_id) AND (conversations.created_by = auth.uid())))) OR (user_id = auth.uid())));
DROP FUNCTION IF EXISTS public.can_self_join_conversation(uuid);
DROP FUNCTION IF EXISTS public.is_conversation_admin(uuid, uuid);
