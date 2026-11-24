-- "Delete Chat" in the Messages list hides the chat for the signed-in member
-- only. It never deletes the conversation, its messages or anyone's
-- membership, so it cannot break a project, a creative trip's budget or the
-- other members' history. The chat returns to the list when a newer message
-- arrives (like iMessage).
--
-- Why: the old client flow deleted messages, participants and then the
-- conversation. There is no DELETE policy on conversations, the creative-trip
-- trigger refuses to drop a trip member from the trip chat, and a project
-- owner's "owner view" chat has no participant row for them at all. So the
-- delete either raised an error or silently did nothing.
BEGIN;

CREATE TABLE public.conversation_hidden (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  hidden_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, conversation_id)
);
CREATE INDEX conversation_hidden_conversation_id_idx ON public.conversation_hidden(conversation_id);

ALTER TABLE public.conversation_hidden ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.conversation_hidden FROM PUBLIC, anon, authenticated;
GRANT SELECT, DELETE ON public.conversation_hidden TO authenticated;
GRANT ALL ON public.conversation_hidden TO service_role;

CREATE POLICY "Members read their own hidden chats" ON public.conversation_hidden
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Members unhide their own chats" ON public.conversation_hidden
  FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));
-- Same gate every other RLS table carries (20261116091000_pending_member_access).
CREATE POLICY ether_pending_access ON public.conversation_hidden AS RESTRICTIVE
  FOR ALL TO authenticated
  USING ((SELECT public.ether_member_approved()))
  WITH CHECK ((SELECT public.ether_member_approved()));

-- Writes go through this function so hidden_at is always the server's clock
-- and a member can only hide a chat they can actually read.
CREATE FUNCTION public.hide_conversation_for_me(p_conversation_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  uid uuid := auth.uid();
  stamp timestamptz := now();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to manage your chats' USING ERRCODE = '42501';
  END IF;
  IF NOT public.can_read_conversation(p_conversation_id, uid) THEN
    RAISE EXCEPTION 'Chat not found' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.conversation_hidden(user_id, conversation_id, hidden_at)
  VALUES (uid, p_conversation_id, stamp)
  ON CONFLICT (user_id, conversation_id) DO UPDATE SET hidden_at = EXCLUDED.hidden_at;
  RETURN stamp;
END
$fn$;
REVOKE ALL ON FUNCTION public.hide_conversation_for_me(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hide_conversation_for_me(uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
