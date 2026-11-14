-- Manual migration. Opt-in city discovery, reciprocal likes and server-enforced DM privacy.
BEGIN;
CREATE TABLE public.discovery_preferences (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 discoverable boolean NOT NULL DEFAULT false,
 matches_only boolean NOT NULL DEFAULT false
);
CREATE TABLE public.creative_swipes (
 actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 target_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 liked boolean NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(actor_id,target_id), CHECK(actor_id<>target_id)
);
CREATE TABLE public.creative_matches (
 first_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 second_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 active boolean NOT NULL DEFAULT true,
 conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
 PRIMARY KEY(first_id,second_id), CHECK(first_id<second_id)
);
ALTER TABLE public.discovery_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creative_swipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creative_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_discovery_preferences ON public.discovery_preferences FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY own_swipes ON public.creative_swipes FOR SELECT TO authenticated USING(actor_id=auth.uid());
CREATE POLICY own_matches ON public.creative_matches FOR SELECT TO authenticated USING(auth.uid() IN(first_id,second_id));
-- No client write policies: all transitions go through the RPCs below.
GRANT SELECT ON public.discovery_preferences,public.creative_swipes,public.creative_matches TO authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.discovery_preferences,public.creative_swipes,public.creative_matches FROM anon,authenticated;

CREATE FUNCTION public.creative_matched(a uuid,b uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.creative_matches WHERE first_id=least(a,b) AND second_id=greatest(a,b) AND active)
 AND NOT public.either_blocked(a,b);
$$;
CREATE FUNCTION public.creative_dm_allowed(a uuid,b uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT a IS NOT NULL AND b IS NOT NULL AND NOT public.either_blocked(a,b)
 AND (NOT EXISTS(SELECT 1 FROM public.discovery_preferences WHERE user_id=b AND matches_only) OR public.creative_matched(a,b));
$$;
CREATE FUNCTION public.discovery_settings(p_discoverable boolean DEFAULT NULL,p_matches_only boolean DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE me uuid:=auth.uid(); result jsonb;
BEGIN
 IF me IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
 INSERT INTO public.discovery_preferences(user_id) VALUES(me) ON CONFLICT DO NOTHING;
 UPDATE public.discovery_preferences SET discoverable=coalesce(p_discoverable,discoverable), matches_only=coalesce(p_matches_only,matches_only) WHERE user_id=me;
 SELECT to_jsonb(p) INTO result FROM public.discovery_preferences p WHERE user_id=me;
 RETURN result;
END $$;

CREATE FUNCTION public.discovery_people(p_city text DEFAULT NULL,p_query text DEFAULT '',p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to discover creatives'; END IF;
 WITH eligible AS (
 SELECT p.user_id,p.display_name,p.avatar_url,p.bio,coalesce(nullif(p.city_display,''),p.city) city,
 coalesce(nullif(p.city_key,''),lower(coalesce(p.city_display,p.city))) city_key
 FROM public.profiles_public p JOIN public.discovery_preferences d ON d.user_id=p.user_id AND d.discoverable
 WHERE p.onboarding_completed AND p.access_status IS DISTINCT FROM 'banned' AND NOT coalesce(p.is_suspended,false)
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

-- Guard all routes that create/add participants, including legacy direct inserts.
CREATE FUNCTION public.enforce_creative_participant() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE conv public.conversations%ROWTYPE; peer record;
BEGIN
 IF TG_OP='UPDATE' AND (NEW.user_id<>OLD.user_id OR NEW.conversation_id<>OLD.conversation_id) THEN
  RAISE EXCEPTION 'Conversation membership cannot be moved';
 END IF;
 IF TG_OP='UPDATE' THEN RETURN NEW; END IF;
 SELECT * INTO conv FROM public.conversations WHERE id=NEW.conversation_id FOR UPDATE;
 IF conv.type='direct' THEN
  IF (SELECT count(*) FROM public.conversation_participants WHERE conversation_id=NEW.conversation_id AND user_id<>NEW.user_id)>=2 THEN RAISE EXCEPTION 'Direct chats have exactly two participants'; END IF;
  FOR peer IN SELECT user_id FROM public.conversation_participants WHERE conversation_id=NEW.conversation_id AND user_id<>NEW.user_id LOOP
   IF NOT public.creative_dm_allowed(peer.user_id,NEW.user_id) OR NOT public.creative_dm_allowed(NEW.user_id,peer.user_id) THEN
    RAISE EXCEPTION 'This person accepts DMs from mutual matches only. Match in Discover first.' USING ERRCODE='42501';
   END IF;
  END LOOP;
 ELSIF NEW.user_id IS DISTINCT FROM auth.uid() AND conv.project_id IS NULL
  AND NOT public.creative_dm_allowed(auth.uid(),NEW.user_id) THEN
  RAISE EXCEPTION 'This person must match with you or join the group themselves' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER creative_participant_privacy BEFORE INSERT OR UPDATE ON public.conversation_participants FOR EACH ROW EXECUTE FUNCTION public.enforce_creative_participant();
CREATE FUNCTION public.enforce_creative_message() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' AND (NEW.sender_id<>OLD.sender_id OR NEW.conversation_id<>OLD.conversation_id) THEN RAISE EXCEPTION 'Message identity cannot be changed'; END IF;
 -- Permit deletion/redaction, even after an unmatch.
 IF TG_OP='UPDATE' AND NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;
 IF EXISTS(SELECT 1 FROM public.conversations c JOIN public.conversation_participants p ON p.conversation_id=c.id
 WHERE c.id=NEW.conversation_id AND c.type='direct' AND p.user_id<>NEW.sender_id
 AND NOT public.creative_dm_allowed(NEW.sender_id,p.user_id)) THEN
 RAISE EXCEPTION 'This person accepts DMs from mutual matches only. Match in Discover first.' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER creative_message_privacy BEFORE INSERT OR UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.enforce_creative_message();

CREATE FUNCTION public.creative_swipe(p_target uuid,p_liked boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE me uuid:=auth.uid(); chat uuid; matched boolean:=false;
BEGIN
 IF me IS NULL OR p_target IS NULL OR me=p_target OR p_liked IS NULL THEN RAISE EXCEPTION 'Choose another creative'; END IF;
 IF public.either_blocked(me,p_target) THEN RAISE EXCEPTION 'This profile is unavailable'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE user_id=me AND onboarding_completed AND access_status IS DISTINCT FROM 'banned' AND NOT coalesce(is_suspended,false)) THEN RAISE EXCEPTION 'Your profile is not eligible for discovery'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.discovery_preferences WHERE user_id=me AND discoverable) THEN RAISE EXCEPTION 'Turn on discovery before matching'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles_public p JOIN public.discovery_preferences d ON d.user_id=p.user_id AND d.discoverable
 WHERE p.user_id=p_target AND p.onboarding_completed AND p.access_status IS DISTINCT FROM 'banned' AND NOT coalesce(p.is_suspended,false)) THEN RAISE EXCEPTION 'This profile is unavailable'; END IF;
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
CREATE FUNCTION public.creative_unmatch(p_target uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE me uuid:=auth.uid();
BEGIN
 IF me IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('ether-direct:'||least(me::text,p_target::text)||':'||greatest(me::text,p_target::text),0));
 UPDATE public.creative_matches SET active=false WHERE first_id=least(me,p_target) AND second_id=greatest(me,p_target);
 -- Remove both likes so a fresh reciprocal decision is required.
 DELETE FROM public.creative_swipes WHERE (actor_id=me AND target_id=p_target) OR (actor_id=p_target AND target_id=me);
END $$;
CREATE FUNCTION public.creative_match_list() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('user_id',p.user_id,'display_name',p.display_name,'conversation_id',m.conversation_id)),'[]'::jsonb)
 FROM public.creative_matches m JOIN public.profiles_public p ON p.user_id=CASE WHEN m.first_id=auth.uid() THEN m.second_id ELSE m.first_id END
 WHERE auth.uid() IN(m.first_id,m.second_id) AND m.active AND NOT public.either_blocked(m.first_id,m.second_id);
$$;
-- Blocking permanently clears the match, even if the block is later removed.
CREATE FUNCTION public.creative_block_match() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('ether-direct:'||least(NEW.blocker_id::text,NEW.blocked_id::text)||':'||greatest(NEW.blocker_id::text,NEW.blocked_id::text),0));
 UPDATE public.creative_matches SET active=false WHERE first_id=least(NEW.blocker_id,NEW.blocked_id) AND second_id=greatest(NEW.blocker_id,NEW.blocked_id);
 DELETE FROM public.creative_swipes WHERE (actor_id=NEW.blocker_id AND target_id=NEW.blocked_id) OR (actor_id=NEW.blocked_id AND target_id=NEW.blocker_id);
 RETURN NEW;
END $$;
CREATE TRIGGER creative_block AFTER INSERT ON public.user_blocks FOR EACH ROW EXECUTE FUNCTION public.creative_block_match();
REVOKE ALL ON FUNCTION public.creative_matched(uuid,uuid),public.creative_dm_allowed(uuid,uuid),public.enforce_creative_participant(),public.enforce_creative_message(),public.creative_block_match() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.discovery_settings(boolean,boolean),public.discovery_people(text,text,integer),public.creative_swipe(uuid,boolean),public.creative_unmatch(uuid),public.creative_match_list() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.discovery_settings(boolean,boolean),public.discovery_people(text,text,integer),public.creative_swipe(uuid,boolean),public.creative_unmatch(uuid),public.creative_match_list() TO authenticated;
CREATE OR REPLACE FUNCTION public.get_or_create_direct_conversation(p_other uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Sign in to send'
      USING ERRCODE = '42501';
  END IF;
  IF p_other IS NULL OR p_other = v_me THEN
    RAISE EXCEPTION 'Choose someone else'
      USING ERRCODE = '22023';
  END IF;
  IF public.has_blocked(v_me, p_other) OR public.has_blocked(p_other, v_me) THEN
    RAISE EXCEPTION 'You cannot message this person'
      USING ERRCODE = '42501';
  END IF;

  IF NOT public.creative_dm_allowed(v_me,p_other) OR NOT public.creative_dm_allowed(p_other,v_me) THEN
    RAISE EXCEPTION 'This person accepts DMs from mutual matches only. Match in Discover first.' USING ERRCODE='42501';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('ether-direct:' || least(v_me::text, p_other::text) || ':' || greatest(v_me::text, p_other::text), 0)
  );

  SELECT c.id INTO v_id
  FROM public.conversations c
  WHERE c.type = 'direct'
    AND c.project_id IS NULL
    AND (SELECT count(*) FROM public.conversation_participants cp WHERE cp.conversation_id=c.id)=2
    AND EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = c.id AND cp.user_id = v_me
    )
    AND EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = c.id AND cp.user_id = p_other
    )
  ORDER BY c.created_at ASC, c.id ASC
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  INSERT INTO public.conversations (type, created_by)
  VALUES ('direct', v_me)
  RETURNING id INTO v_id;

  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES (v_id, v_me), (v_id, p_other);

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_direct_conversation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_direct_conversation(uuid) TO authenticated, service_role;

CREATE FUNCTION public.create_group_with_privacy(p_name text,p_members uuid[]) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE me uuid:=auth.uid(); chat uuid; member uuid;
BEGIN
 IF me IS NULL OR length(trim(p_name)) NOT BETWEEN 1 AND 100 OR cardinality(p_members) NOT BETWEEN 2 AND 50 THEN RAISE EXCEPTION 'Add a group name and 2 to 50 people'; END IF;
 IF (SELECT count(DISTINCT x) FROM unnest(p_members) x WHERE x IS NOT NULL AND x<>me)<>cardinality(p_members) THEN RAISE EXCEPTION 'Choose distinct people other than yourself'; END IF;
 INSERT INTO public.conversations(type,name,created_by) VALUES('group',trim(p_name),me) RETURNING id INTO chat;
 INSERT INTO public.conversation_participants(conversation_id,user_id) VALUES(chat,me);
 FOREACH member IN ARRAY p_members LOOP
  IF NOT EXISTS(SELECT 1 FROM public.profiles_public WHERE user_id=member) THEN RAISE EXCEPTION 'Profile unavailable'; END IF;
  INSERT INTO public.conversation_participants(conversation_id,user_id) VALUES(chat,member);
 END LOOP;
 RETURN chat;
END $$;
REVOKE ALL ON FUNCTION public.create_group_with_privacy(text,uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_group_with_privacy(text,uuid[]) TO authenticated;
COMMIT;
