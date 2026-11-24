-- Rollback for 20261115120000_discovery_live_area.sql. Restores the three functions exactly as
-- they were on ether-prod on 2026-11-15 (read with pg_get_functiondef), then drops the area.
BEGIN;
DROP FUNCTION IF EXISTS public.discovery_live_area(text,double precision,double precision,integer);
CREATE OR REPLACE FUNCTION public.discovery_globe()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE me uuid:=auth.uid(); result jsonb;
BEGIN
 IF me IS NULL THEN RAISE EXCEPTION 'Sign in to discover creatives'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'user_id',x.user_id,
  'liked',x.liked,
  'live_city_key',x.live_city_key,
  'live_until',x.live_until,
  'deck',x.deck,
  'trip',(SELECT jsonb_build_object('city_key',t.city_key,'city_label',t.city_label,'starts_on',t.starts_on,'ends_on',t.ends_on)
   FROM public.creative_trip_members m JOIN public.creative_trips t ON t.id=m.trip_id
   WHERE m.user_id=x.user_id AND t.status IN('planning','booked') AND t.ends_on>=current_date
   AND (EXISTS(SELECT 1 FROM public.creative_trip_members v WHERE v.trip_id=t.id AND v.user_id=me)
    OR (t.status='planning' AND t.starts_on>=current_date
     AND NOT EXISTS(SELECT 1 FROM public.creative_trip_members b WHERE b.trip_id=t.id AND public.either_blocked(me,b.user_id))))
   ORDER BY t.starts_on,t.id LIMIT 1)
 ) ORDER BY x.user_id),'[]'::jsonb) INTO result
 FROM (
  SELECT p.user_id,s.liked,l.city_key live_city_key,l.expires_at live_until,
   -- Deck position. People who already connected with me lean toward the top, with a
   -- per-day jitter wide enough that others mix in, so the order never proves who did.
   row_number() OVER (ORDER BY
    (CASE WHEN EXISTS(SELECT 1 FROM public.creative_swipes i WHERE i.actor_id=p.user_id AND i.target_id=me AND i.liked) THEN 0 ELSE 1 END)
    + abs(hashtext(me::text||p.user_id::text||current_date::text))::numeric/2147483647*1.25,
    p.user_id)::int deck
  FROM (SELECT user_id FROM public.profiles_public WHERE onboarding_completed AND access_status IS DISTINCT FROM 'banned' AND NOT coalesce(is_suspended,false) LIMIT 5000) p
  LEFT JOIN public.discovery_preferences d ON d.user_id=p.user_id
  LEFT JOIN public.creative_swipes s ON s.actor_id=me AND s.target_id=p.user_id
  LEFT JOIN public.discovery_live_cities l ON l.user_id=p.user_id AND l.expires_at>now()
  WHERE coalesce(d.discoverable,true) AND NOT public.either_blocked(me,p.user_id)
 ) x;
 RETURN result;
END $function$;
CREATE OR REPLACE FUNCTION public.discovery_settings(p_discoverable boolean DEFAULT NULL::boolean, p_matches_only boolean DEFAULT NULL::boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE me uuid:=auth.uid(); result jsonb;
BEGIN
 IF me IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
 INSERT INTO public.discovery_preferences(user_id) VALUES(me) ON CONFLICT DO NOTHING;
 UPDATE public.discovery_preferences SET discoverable=coalesce(p_discoverable,discoverable), matches_only=coalesce(p_matches_only,matches_only) WHERE user_id=me;
 -- Hiding from discovery also ends any live city.
 IF p_discoverable IS FALSE THEN DELETE FROM public.discovery_live_cities WHERE user_id=me; END IF;
 SELECT to_jsonb(p)||jsonb_build_object('live_city_key',l.city_key,'live_until',l.expires_at) INTO result
 FROM public.discovery_preferences p LEFT JOIN public.discovery_live_cities l ON l.user_id=p.user_id AND l.expires_at>now()
 WHERE p.user_id=me;
 RETURN result;
END $function$;
CREATE OR REPLACE FUNCTION public.discovery_live_city(p_city_key text DEFAULT NULL::text, p_hours integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE me uuid:=auth.uid();
BEGIN
 IF me IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
 IF p_city_key IS NULL THEN
  DELETE FROM public.discovery_live_cities WHERE user_id=me;
 ELSE
  IF p_hours IS NULL OR p_hours<1 OR p_hours>168 THEN RAISE EXCEPTION 'Share your live city for 1 hour to 7 days'; END IF;
  IF p_city_key !~ '^[a-z0-9][^|]{0,79}\|[a-z]{2}$' THEN RAISE EXCEPTION 'Choose a city'; END IF;
  IF NOT public.discovery_eligible(me) THEN RAISE EXCEPTION 'Show yourself in discovery before sharing a live city'; END IF;
  INSERT INTO public.discovery_live_cities(user_id,city_key,expires_at) VALUES(me,p_city_key,now()+make_interval(hours=>p_hours))
  ON CONFLICT(user_id) DO UPDATE SET city_key=excluded.city_key,expires_at=excluded.expires_at,updated_at=now();
 END IF;
 RETURN public.discovery_settings();
END $function$;
ALTER TABLE public.discovery_live_cities DROP CONSTRAINT IF EXISTS discovery_live_area_pair, DROP COLUMN IF EXISTS area_lat, DROP COLUMN IF EXISTS area_lon;
COMMIT;
