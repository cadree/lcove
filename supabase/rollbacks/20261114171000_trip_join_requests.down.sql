-- Rollback for 20261114171000_trip_join_requests.sql. Restores direct joins; pending requests are dropped.
DROP TRIGGER IF EXISTS creative_trip_member_gate ON public.creative_trip_members;
DROP FUNCTION IF EXISTS public.creative_trip_member_gate();
DROP FUNCTION IF EXISTS public.creative_trip_requests(uuid);
DROP FUNCTION IF EXISTS public.creative_trip_answer(uuid,uuid,boolean);
DROP FUNCTION IF EXISTS public.creative_trip_request(uuid,text);
DROP TABLE IF EXISTS public.creative_trip_join_requests;
DELETE FROM public.ether_schema_migrations WHERE version = '20261114171000_trip_join_requests.sql';
