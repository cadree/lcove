-- Swipe deck: people who already connected with you sit near the top of your deck.
-- discovery_globe gains a 'deck' position only; nothing says who connected first, and
-- a per-day jitter mixes others in so the order is not proof. Blocks, the hide-me
-- opt-out, bans and suspensions filter exactly as before.
-- Rollback: supabase/rollbacks/20261114161000_deck_incoming_first.down.sql
CREATE OR REPLACE FUNCTION public.discovery_globe() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
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
END $$;
