-- Message requests: writing to someone you have not matched with lands in their
-- quiet Requests list. No notification, no push. If you later match, the request
-- moves into your new chat as its first message. Blocking either way removes it.
-- Rollback: supabase/rollbacks/20261114170000_message_requests.down.sql
CREATE TABLE public.message_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 body text NOT NULL CHECK(length(trim(body)) BETWEEN 1 AND 500),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','ignored','delivered')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(sender_id,recipient_id), CHECK(sender_id<>recipient_id)
);
CREATE INDEX message_requests_recipient ON public.message_requests(recipient_id,status,updated_at DESC);
ALTER TABLE public.message_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_requests FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.message_requests FROM PUBLIC,anon,authenticated;
-- Reads only. Every write goes through the functions below.
GRANT SELECT ON public.message_requests TO authenticated;
CREATE POLICY message_requests_read ON public.message_requests FOR SELECT TO authenticated
 USING(auth.uid() IN(sender_id,recipient_id) AND NOT public.either_blocked(sender_id,recipient_id));

CREATE FUNCTION public.send_message_request(p_recipient uuid,p_body text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE me uuid:=auth.uid(); body text:=trim(coalesce(p_body,'')); chat uuid;
BEGIN
 IF me IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
 IF p_recipient IS NULL OR p_recipient=me THEN RAISE EXCEPTION 'Choose another creative'; END IF;
 IF length(body) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Write 1 to 500 characters'; END IF;
 IF public.objectionable_text(body) THEN RAISE EXCEPTION 'That text is not allowed'; END IF;
 IF public.either_blocked(me,p_recipient) THEN RAISE EXCEPTION 'This profile is unavailable'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE user_id=me AND onboarding_completed AND access_status IS DISTINCT FROM 'banned' AND NOT coalesce(is_suspended,false)) THEN RAISE EXCEPTION 'Your profile is not eligible to message'; END IF;
 IF NOT public.discovery_eligible(p_recipient) THEN RAISE EXCEPTION 'This profile is unavailable'; END IF;
 -- Already matched: there is a chat; the app opens it instead.
 SELECT conversation_id INTO chat FROM public.creative_matches
  WHERE first_id=least(me,p_recipient) AND second_id=greatest(me,p_recipient) AND active AND conversation_id IS NOT NULL;
 IF chat IS NOT NULL THEN RETURN jsonb_build_object('status','matched','conversation_id',chat); END IF;
 IF NOT EXISTS(SELECT 1 FROM public.message_requests WHERE sender_id=me AND recipient_id=p_recipient)
  AND (SELECT count(*) FROM public.message_requests WHERE sender_id=me AND created_at>now()-interval '1 day')>=20 THEN
  RAISE EXCEPTION 'You have sent a lot of requests today. Try again tomorrow';
 END IF;
 -- Re-sending replaces your earlier note. An ignored request stays ignored (the sender is never told);
 -- one delivered before an unmatch starts over as pending.
 INSERT INTO public.message_requests(sender_id,recipient_id,body) VALUES(me,p_recipient,body)
 ON CONFLICT(sender_id,recipient_id) DO UPDATE SET body=excluded.body,updated_at=now(),
  status=CASE WHEN public.message_requests.status='delivered' THEN 'pending' ELSE public.message_requests.status END;
 RETURN jsonb_build_object('status','sent','conversation_id',null);
END $$;

-- Incoming requests (pending only) with who sent them, and what I have sent (shown as sent, whatever they chose).
CREATE FUNCTION public.message_request_inbox() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object(
  'incoming',coalesce((SELECT jsonb_agg(jsonb_build_object('id',r.id,'user_id',r.sender_id,'body',r.body,'sent_at',r.updated_at,
    'display_name',coalesce(p.display_name,'Creative'),'avatar_url',p.avatar_url,'city',coalesce(p.city_display,p.city)) ORDER BY r.updated_at DESC)
   FROM public.message_requests r JOIN public.profiles_public p ON p.user_id=r.sender_id
   WHERE r.recipient_id=auth.uid() AND r.status='pending' AND NOT public.either_blocked(r.sender_id,r.recipient_id)
    AND p.access_status IS DISTINCT FROM 'banned' AND NOT coalesce(p.is_suspended,false)),'[]'::jsonb),
  'outgoing',coalesce((SELECT jsonb_agg(jsonb_build_object('id',r.id,'user_id',r.recipient_id,'body',r.body,'sent_at',r.updated_at) ORDER BY r.updated_at DESC)
   FROM public.message_requests r WHERE r.sender_id=auth.uid() AND r.status<>'delivered' AND NOT public.either_blocked(r.sender_id,r.recipient_id)),'[]'::jsonb))
 WHERE auth.uid() IS NOT NULL;
$$;

CREATE FUNCTION public.ignore_message_request(p_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 UPDATE public.message_requests SET status='ignored',updated_at=now() WHERE id=p_id AND recipient_id=auth.uid() AND status='pending';
 IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
END $$;

-- When a match gets its chat, waiting requests between the two become its first messages.
CREATE FUNCTION public.deliver_message_requests() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r record;
BEGIN
 IF NOT NEW.active OR NEW.conversation_id IS NULL THEN RETURN NEW; END IF;
 FOR r IN SELECT * FROM public.message_requests
  WHERE status IN('pending','ignored') AND ((sender_id=NEW.first_id AND recipient_id=NEW.second_id) OR (sender_id=NEW.second_id AND recipient_id=NEW.first_id))
  ORDER BY created_at FOR UPDATE LOOP
  INSERT INTO public.messages(conversation_id,sender_id,content) VALUES(NEW.conversation_id,r.sender_id,r.body);
  UPDATE public.message_requests SET status='delivered',updated_at=now() WHERE id=r.id;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER creative_match_delivers_requests AFTER INSERT OR UPDATE OF conversation_id,active ON public.creative_matches
 FOR EACH ROW EXECUTE FUNCTION public.deliver_message_requests();

CREATE FUNCTION public.block_clears_message_requests() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 DELETE FROM public.message_requests WHERE (sender_id=NEW.blocker_id AND recipient_id=NEW.blocked_id) OR (sender_id=NEW.blocked_id AND recipient_id=NEW.blocker_id);
 RETURN NEW;
END $$;
CREATE TRIGGER block_clears_message_requests AFTER INSERT ON public.user_blocks FOR EACH ROW EXECUTE FUNCTION public.block_clears_message_requests();

REVOKE ALL ON FUNCTION public.send_message_request(uuid,text),public.message_request_inbox(),public.ignore_message_request(uuid),
 public.deliver_message_requests(),public.block_clears_message_requests() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.send_message_request(uuid,text),public.message_request_inbox(),public.ignore_message_request(uuid) TO authenticated;
