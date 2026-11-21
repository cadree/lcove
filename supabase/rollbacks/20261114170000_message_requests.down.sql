-- Rollback for 20261114170000_message_requests.sql. Drops pending requests; delivered ones already live in chats.
DROP TRIGGER IF EXISTS block_clears_message_requests ON public.user_blocks;
DROP TRIGGER IF EXISTS creative_match_delivers_requests ON public.creative_matches;
DROP FUNCTION IF EXISTS public.block_clears_message_requests();
DROP FUNCTION IF EXISTS public.deliver_message_requests();
DROP FUNCTION IF EXISTS public.ignore_message_request(uuid);
DROP FUNCTION IF EXISTS public.message_request_inbox();
DROP FUNCTION IF EXISTS public.send_message_request(uuid,text);
DROP TABLE IF EXISTS public.message_requests;
DELETE FROM public.ether_schema_migrations WHERE version = '20261114170000_message_requests.sql';
