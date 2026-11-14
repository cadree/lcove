-- Rollback for 20261114172000_trip_board.sql. Drops the board and its items.
DROP TABLE IF EXISTS public.creative_trip_board;
DROP FUNCTION IF EXISTS public.creative_trip_board_cap();
DROP FUNCTION IF EXISTS public.creative_trip_member(uuid);
DROP FUNCTION IF EXISTS public.creative_trip_open(uuid);
DROP FUNCTION IF EXISTS public.creative_trip_organizer(uuid);
DELETE FROM public.ether_schema_migrations WHERE version = '20261114172000_trip_board.sql';
