-- Rollback for 20261122030000_hide_conversation_for_me.sql.
-- Hidden chats reappear in everyone's list. No conversation, message or
-- membership data is touched. Revert the web change first or together: the
-- client tolerates a missing table, but "Delete Chat" would then show an error.
BEGIN;
DROP FUNCTION IF EXISTS public.hide_conversation_for_me(uuid);
DROP TABLE IF EXISTS public.conversation_hidden;
NOTIFY pgrst, 'reload schema';
COMMIT;
