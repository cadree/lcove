-- Manual migration. People discovery v2:
-- * Every eligible member appears on the globe and in the swipe deck at their
--   profile city by default. "Hide me from the globe and deck" is the opt-out.
-- * Optional live city: explicit opt-in, city-level only (a GeoNames city key,
--   never coordinates), expires after 1-168 hours, and can be turned off at once.
-- * Travel badges come from upcoming trips the viewer could already see.
BEGIN;

ALTER TABLE public.discovery_preferences ALTER COLUMN discoverable SET DEFAULT true;

-- A city key such as "miami|fl" or "tokyo|jp". The app shows a label from its own
-- GeoNames list, so no free text from other members is ever displayed here.
CREATE TABLE public.discovery_live_cities (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 city_key text NOT NULL CHECK (city_key ~ '^[a-z0-9][^|]{0,79}\|[a-z]{2}$'),
 expires_at timestamptz NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.discovery_live_cities ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_live_city ON public.discovery_live_cities FOR SELECT TO authenticated USING(user_id=auth.uid());
REVOKE ALL ON public.discovery_live_cities FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.discovery_live_cities TO authenticated;
-- Only SELECT is needed on the PR #87 tables; RLS already limits rows.
REVOKE TRUNCATE,REFERENCES,TRIGGER ON public.discovery_preferences,public.creative_swipes,public.creative_matches FROM anon,authenticated;

CREATE FUNCTION public.discovery_hidden(u uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.discovery_preferences WHERE user_id=u AND NOT discoverable);
$$;
CREATE FUNCTION public.discovery_eligible(u uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.profiles_public p WHERE p.user_id=u AND p.onboarding_completed
 AND p.access_status IS DISTINCT FROM 'banned' AND NOT coalesce(p.is_suspended,false))
 AND NOT public.discovery_hidden(u);
$$;

CREATE OR REPLACE FUNCTION public.discovery_settings(p_discoverable boolean DEFAULT NULL,p_matches_only boolean DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
END $$;

CREATE FUNCTION public.discovery_live_city(p_city_key text DEFAULT NULL,p_hours integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
END $$;

-- Everyone the viewer can discover, with the signals the globe and deck need.
-- Profile fields come from profiles_public, which members can already read.
CREATE FUNCTION public.discovery_globe() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
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

-- Same contract as before; hidden members are the only ones left out now.
CREATE OR REPLACE FUNCTION public.discovery_people(p_city text DEFAULT NULL,p_query text DEFAULT '',p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to discover creatives'; END IF;
 WITH eligible AS (
 SELECT p.user_id,p.display_name,p.avatar_url,p.bio,coalesce(nullif(p.city_display,''),p.city) city,
 coalesce(nullif(p.city_key,''),lower(coalesce(p.city_display,p.city))) city_key
 FROM public.profiles_public p LEFT JOIN public.discovery_preferences d ON d.user_id=p.user_id
 WHERE coalesce(d.discoverable,true) AND p.onboarding_completed AND p.access_status IS DISTINCT FROM 'banned' AND NOT coalesce(p.is_suspended,false)
 AND NOT public.either_blocked(auth.uid(),p.user_id)
 ), cities AS (
 SELECT city_key,min(city) label,count(*) count,(array_agg(avatar_url ORDER BY user_id) FILTER(WHERE avatar_url IS NOT NULL))[1] image
 FROM eligible WHERE city IS NOT NULL AND city<>'' GROUP BY city_key
 ), people AS (
 SELECT e.*,s.liked FROM eligible e LEFT JOIN public.creative_swipes s ON s.actor_id=auth.uid() AND s.target_id=e.user_id
 WHERE e.user_id<>auth.uid() AND (p_city IS NULL OR e.city_key=p_city)
 AND (coalesce(e.display_name,'')||' '||coalesce(e.bio,'')||' '||coalesce(e.city,'')) ILIKE '%'||left(coalesce(p_query,''),100)||'%'
 ORDER BY e.user_id LIMIT 30 OFFSET greatest(0,least(coalesce(p_offset,0),100000))
 ) SELECT jsonb_build_object('cities',coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY count DESC,label) FROM cities c),'[]'::jsonb),
 'people',coalesce((SELECT jsonb_agg(to_jsonb(p)) FROM people p),'[]'::jsonb)) INTO result;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.creative_swipe(p_target uuid,p_liked boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE me uuid:=auth.uid(); chat uuid; matched boolean:=false;
BEGIN
 IF me IS NULL OR p_target IS NULL OR me=p_target OR p_liked IS NULL THEN RAISE EXCEPTION 'Choose another creative'; END IF;
 IF public.either_blocked(me,p_target) THEN RAISE EXCEPTION 'This profile is unavailable'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE user_id=me AND onboarding_completed AND access_status IS DISTINCT FROM 'banned' AND NOT coalesce(is_suspended,false)) THEN RAISE EXCEPTION 'Your profile is not eligible for discovery'; END IF;
 IF public.discovery_hidden(me) THEN RAISE EXCEPTION 'Show yourself in discovery to like profiles'; END IF;
 IF NOT public.discovery_eligible(p_target) THEN RAISE EXCEPTION 'This profile is unavailable'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('ether-direct:'||least(me::text,p_target::text)||':'||greatest(me::text,p_target::text),0));
 INSERT INTO public.creative_swipes(actor_id,target_id,liked) VALUES(me,p_target,p_liked)
 ON CONFLICT(actor_id,target_id) DO UPDATE SET liked=excluded.liked,created_at=now();
 IF p_liked AND EXISTS(SELECT 1 FROM public.creative_swipes WHERE actor_id=p_target AND target_id=me AND liked) THEN
  INSERT INTO public.creative_matches(first_id,second_id,active) VALUES(least(me,p_target),greatest(me,p_target),true)
  ON CONFLICT(first_id,second_id) DO UPDATE SET active=true;
  chat:=public.get_or_create_direct_conversation(p_target);
  UPDATE public.creative_matches SET conversation_id=chat WHERE first_id=least(me,p_target) AND second_id=greatest(me,p_target);
  matched:=true;
 END IF;
 RETURN jsonb_build_object('matched',matched,'conversation_id',chat);
END $$;

REVOKE ALL ON FUNCTION public.discovery_hidden(uuid),public.discovery_eligible(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.discovery_live_city(text,integer),public.discovery_globe() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.discovery_live_city(text,integer),public.discovery_globe() TO authenticated;
COMMIT;
