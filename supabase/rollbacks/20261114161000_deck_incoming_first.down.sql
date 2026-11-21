-- Rollback for 20261114161000_deck_incoming_first.sql: restores discovery_globe from people_discovery_v2.
CREATE OR REPLACE FUNCTION public.discovery_globe() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE me uuid:=auth.uid(); result jsonb;
BEGIN
 IF me IS NULL THEN RAISE EXCEPTION 'Sign in to discover creatives'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'user_id',p.user_id,
  'liked',s.liked,
  'live_city_key',l.city_key,
  'live_until',l.expires_at,
  'trip',(SELECT jsonb_build_object('city_key',t.city_key,'city_label',t.city_label,'starts_on',t.starts_on,'ends_on',t.ends_on)
   FROM public.creative_trip_members m JOIN public.creative_trips t ON t.id=m.trip_id
   WHERE m.user_id=p.user_id AND t.status IN('planning','booked') AND t.ends_on>=current_date
   AND (EXISTS(SELECT 1 FROM public.creative_trip_members v WHERE v.trip_id=t.id AND v.user_id=me)
    OR (t.status='planning' AND t.starts_on>=current_date
     AND NOT EXISTS(SELECT 1 FROM public.creative_trip_members b WHERE b.trip_id=t.id AND public.either_blocked(me,b.user_id))))
   ORDER BY t.starts_on,t.id LIMIT 1)
 ) ORDER BY p.user_id),'[]'::jsonb) INTO result
 FROM (SELECT user_id FROM public.profiles_public WHERE onboarding_completed AND access_status IS DISTINCT FROM 'banned' AND NOT coalesce(is_suspended,false) LIMIT 5000) p
 LEFT JOIN public.discovery_preferences d ON d.user_id=p.user_id
 LEFT JOIN public.creative_swipes s ON s.actor_id=me AND s.target_id=p.user_id
 LEFT JOIN public.discovery_live_cities l ON l.user_id=p.user_id AND l.expires_at>now()
 WHERE coalesce(d.discoverable,true) AND NOT public.either_blocked(me,p.user_id);
 RETURN result;
END $$;
DELETE FROM public.ether_schema_migrations WHERE version = '20261114161000_deck_incoming_first.sql';
