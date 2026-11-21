-- Unsend your own message.
-- The app soft-deletes (UPDATE messages SET deleted_at = now()), but the read policy
-- only shows rows with deleted_at IS NULL, and Postgres requires an updated row to stay
-- visible to its writer, so every unsend failed with "new row violates row-level
-- security policy". The same rule hid the change from the other side's realtime feed.
-- Now an unsend empties the message (text, media, shares) in the same update, and an
-- emptied tombstone stays readable to the chat, so the update succeeds and realtime
-- delivers it to everyone, whose app drops deleted rows. Older soft-deleted rows that
-- still hold content stay hidden. Only the sender can unsend (unchanged update policy).
-- Rollback: supabase/rollbacks/20261114181000_message_unsend.down.sql

CREATE OR REPLACE FUNCTION public.scrub_unsent_message()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
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
END $$;
DROP TRIGGER IF EXISTS scrub_unsent_message ON public.messages;
CREATE TRIGGER scrub_unsent_message BEFORE UPDATE OF deleted_at ON public.messages
 FOR EACH ROW EXECUTE FUNCTION public.scrub_unsent_message();

DROP POLICY IF EXISTS "Users can view messages in chats they can read" ON public.messages;
CREATE POLICY "Users can view messages in chats they can read" ON public.messages
 FOR SELECT TO public USING (
  can_read_conversation(conversation_id, auth.uid())
  AND (deleted_at IS NULL OR (content IS NULL AND media_url IS NULL AND shared_post_id IS NULL
   AND shared_story_id IS NULL AND shared_profile_id IS NULL AND shared_from_message_id IS NULL))
  AND NOT either_blocked(auth.uid(), sender_id));

-- Same rule as before, stated for the new row too: a message stays its sender's.
DROP POLICY IF EXISTS "Users can update their own messages" ON public.messages;
CREATE POLICY "Users can update their own messages" ON public.messages
 FOR UPDATE TO public USING (auth.uid() = sender_id) WITH CHECK (auth.uid() = sender_id);
