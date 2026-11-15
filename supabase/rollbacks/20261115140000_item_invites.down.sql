-- Undo 20261115140000_item_invites.sql. Revert the app commit first, so no
-- client calls these RPCs after they are gone. Invite notices already sent
-- stay in notifications (type item_invite) and open their item by path.
-- Invite cards already posted stay as plain text lines ("Invited you to ...").
-- Members already added to project chats stay in them.
-- reviewApplication in the app adds members to the project chat again once
-- the app commit is reverted.
DROP TRIGGER IF EXISTS add_accepted_member_to_project_chat ON public.project_applications;
DROP TRIGGER IF EXISTS guard_invite_card ON public.messages;
ALTER TABLE IF EXISTS public.messages DROP COLUMN IF EXISTS shared_invite_id;
-- Prod's enforce_project_conversation as it was before this migration.
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
DROP FUNCTION IF EXISTS public.add_accepted_member_to_project_chat();
DROP FUNCTION IF EXISTS public.item_invite_apply(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.item_invite_card(uuid);
DROP FUNCTION IF EXISTS public.respond_item_invite(uuid, boolean);
DROP FUNCTION IF EXISTS public.send_item_invite(text, uuid, uuid);
DROP FUNCTION IF EXISTS public.post_item_invite_card(uuid, text);
DROP FUNCTION IF EXISTS public.item_invite_path(uuid);
DROP FUNCTION IF EXISTS public.item_invite_ticket_required(uuid);
DROP FUNCTION IF EXISTS public.guard_invite_card();
DROP FUNCTION IF EXISTS public.item_invite_targets(uuid, text);
DROP FUNCTION IF EXISTS public.item_invite_state(text, uuid, uuid, boolean, uuid);
DROP FUNCTION IF EXISTS public.item_invite_candidates(uuid);
DROP FUNCTION IF EXISTS public.invite_account_ok(uuid);
DROP FUNCTION IF EXISTS public.invite_city_token(text);
DROP TABLE IF EXISTS public.item_invites;
