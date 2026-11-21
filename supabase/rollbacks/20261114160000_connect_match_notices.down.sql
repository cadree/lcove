-- Rollback for 20261114160000_connect_match_notices.sql: restores creative_swipe
-- from 20261114120000_people_discovery_v2.sql. Match notifications already sent stay.
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
DELETE FROM public.ether_schema_migrations WHERE version = '20261114160000_connect_match_notices.sql';
