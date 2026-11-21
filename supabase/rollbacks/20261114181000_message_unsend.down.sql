-- Rollback of 20261114181000_message_unsend.sql (unsend fails again after this).
DROP POLICY IF EXISTS "Users can update their own messages" ON public.messages;
CREATE POLICY "Users can update their own messages" ON public.messages
 FOR UPDATE TO public USING ((auth.uid() = sender_id));
DROP POLICY IF EXISTS "Users can view messages in chats they can read" ON public.messages;
CREATE POLICY "Users can view messages in chats they can read" ON public.messages
 FOR SELECT TO public USING ((can_read_conversation(conversation_id, auth.uid()) AND (deleted_at IS NULL) AND (NOT either_blocked(auth.uid(), sender_id))));
DROP TRIGGER IF EXISTS scrub_unsent_message ON public.messages;
DROP FUNCTION IF EXISTS public.scrub_unsent_message();
