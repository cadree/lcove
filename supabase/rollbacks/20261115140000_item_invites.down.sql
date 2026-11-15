-- Undo 20261115140000_item_invites.sql. Revert the app commit first, so no
-- client calls these RPCs after they are gone. Invite notices already sent
-- stay in notifications (type item_invite) and open their item by path.
DROP FUNCTION IF EXISTS public.respond_item_invite(uuid, boolean);
DROP FUNCTION IF EXISTS public.send_item_invite(text, uuid, uuid);
DROP FUNCTION IF EXISTS public.item_invite_targets(uuid, text);
DROP FUNCTION IF EXISTS public.item_invite_state(text, uuid, uuid, boolean, uuid);
DROP FUNCTION IF EXISTS public.item_invite_candidates(uuid);
DROP FUNCTION IF EXISTS public.invite_account_ok(uuid);
DROP FUNCTION IF EXISTS public.invite_city_token(text);
DROP TABLE IF EXISTS public.item_invites;
