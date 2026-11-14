-- Trips join by request: a traveler asks (with an optional note to the group), the
-- organizer approves or declines. Members see pending requests; the requester sees
-- their own. A trigger makes approval the only way onto a trip besides creating it,
-- so the old direct 'join' action can no longer skip the organizer.
-- Rollback: supabase/rollbacks/20261114171000_trip_join_requests.down.sql
CREATE TABLE public.creative_trip_join_requests (
 trip_id uuid NOT NULL REFERENCES public.creative_trips(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 note text NOT NULL DEFAULT '' CHECK(length(note)<=500),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','approved','declined')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(trip_id,user_id)
);
ALTER TABLE public.creative_trip_join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creative_trip_join_requests FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.creative_trip_join_requests FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.creative_trip_join_requests TO authenticated;
CREATE POLICY trip_join_requests_read ON public.creative_trip_join_requests FOR SELECT TO authenticated
 USING(user_id=auth.uid() OR EXISTS(SELECT 1 FROM public.creative_trip_members m WHERE m.trip_id=creative_trip_join_requests.trip_id AND m.user_id=auth.uid()));

-- Only the organizer (at creation) or an approved request puts someone on a trip.
CREATE FUNCTION public.creative_trip_member_gate() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.creative_trips WHERE id=NEW.trip_id AND organizer_id=NEW.user_id) THEN RETURN NEW; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.creative_trip_join_requests WHERE trip_id=NEW.trip_id AND user_id=NEW.user_id AND status='approved') THEN
  RAISE EXCEPTION 'Ask to join. The organizer approves new travelers';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER creative_trip_member_gate BEFORE INSERT ON public.creative_trip_members FOR EACH ROW EXECUTE FUNCTION public.creative_trip_member_gate();

CREATE FUNCTION public.creative_trip_request(p_trip uuid,p_note text DEFAULT '') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE me uuid:=auth.uid(); t public.creative_trips%ROWTYPE; note text:=trim(coalesce(p_note,'')); prior text; who text;
BEGIN
 IF me IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
 IF length(note)>500 THEN RAISE EXCEPTION 'Keep the note under 500 characters'; END IF;
 IF note<>'' AND public.objectionable_text(note) THEN RAISE EXCEPTION 'That text is not allowed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE user_id=me AND onboarding_completed AND access_status IS DISTINCT FROM 'banned' AND NOT coalesce(is_suspended,false)) THEN RAISE EXCEPTION 'Your profile is not eligible to join trips'; END IF;
 SELECT * INTO t FROM public.creative_trips WHERE id=p_trip FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Trip not found'; END IF;
 IF EXISTS(SELECT 1 FROM public.creative_trip_members WHERE trip_id=p_trip AND user_id=me) THEN RETURN jsonb_build_object('status','member'); END IF;
 IF EXISTS(SELECT 1 FROM public.creative_trip_members WHERE trip_id=p_trip AND public.either_blocked(me,user_id))
  OR NOT EXISTS(SELECT 1 FROM public.profiles_public WHERE user_id=t.organizer_id AND access_status IS DISTINCT FROM 'banned' AND NOT coalesce(is_suspended,false)) THEN
  RAISE EXCEPTION 'This trip is unavailable';
 END IF;
 IF t.status<>'planning' OR t.starts_on<current_date OR EXISTS(SELECT 1 FROM public.creative_trip_items WHERE trip_id=p_trip AND receipt_url IS NOT NULL) THEN
  RAISE EXCEPTION 'This trip is no longer accepting travelers';
 END IF;
 IF (SELECT count(*) FROM public.creative_trip_members WHERE trip_id=p_trip)>=t.capacity THEN RAISE EXCEPTION 'This trip is full'; END IF;
 SELECT status INTO prior FROM public.creative_trip_join_requests WHERE trip_id=p_trip AND user_id=me;
 -- A declined request stays declined; asking again does not re-notify the organizer.
 IF prior='declined' THEN RETURN jsonb_build_object('status','declined'); END IF;
 INSERT INTO public.creative_trip_join_requests(trip_id,user_id,note) VALUES(p_trip,me,note)
 ON CONFLICT(trip_id,user_id) DO UPDATE SET note=excluded.note,updated_at=now();
 IF prior IS NULL THEN
  SELECT coalesce(nullif(trim(display_name),''),'A creative') INTO who FROM public.profiles WHERE user_id=me;
  INSERT INTO public.notifications(user_id,type,title,body,data)
  VALUES(t.organizer_id,'trip_request','Trip request',coalesce(who,'A creative')||' asked to join '||t.title||'.',jsonb_build_object('path','/travel?trip='||t.id,'trip_id',t.id,'user_id',me));
 END IF;
 RETURN jsonb_build_object('status','pending');
END $$;

CREATE FUNCTION public.creative_trip_answer(p_trip uuid,p_user uuid,p_approve boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE me uuid:=auth.uid(); t public.creative_trips%ROWTYPE;
BEGIN
 SELECT * INTO t FROM public.creative_trips WHERE id=p_trip FOR UPDATE;
 IF NOT FOUND OR t.organizer_id IS DISTINCT FROM me THEN RAISE EXCEPTION 'Only the organizer can answer requests'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.creative_trip_join_requests WHERE trip_id=p_trip AND user_id=p_user AND status='pending') THEN RAISE EXCEPTION 'Request not found'; END IF;
 IF NOT coalesce(p_approve,false) THEN
  UPDATE public.creative_trip_join_requests SET status='declined',updated_at=now() WHERE trip_id=p_trip AND user_id=p_user;
  RETURN public.creative_trip_snapshot(p_trip);
 END IF;
 IF t.status<>'planning' OR t.starts_on<current_date OR EXISTS(SELECT 1 FROM public.creative_trip_items WHERE trip_id=p_trip AND receipt_url IS NOT NULL) THEN RAISE EXCEPTION 'This trip is no longer accepting travelers'; END IF;
 IF (SELECT count(*) FROM public.creative_trip_members WHERE trip_id=p_trip)>=t.capacity THEN RAISE EXCEPTION 'This trip is full'; END IF;
 IF EXISTS(SELECT 1 FROM public.creative_trip_members WHERE trip_id=p_trip AND public.either_blocked(p_user,user_id)) THEN RAISE EXCEPTION 'This traveler is unavailable'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE user_id=p_user AND onboarding_completed AND access_status IS DISTINCT FROM 'banned' AND NOT coalesce(is_suspended,false)) THEN RAISE EXCEPTION 'This traveler is unavailable'; END IF;
 UPDATE public.creative_trip_join_requests SET status='approved',updated_at=now() WHERE trip_id=p_trip AND user_id=p_user;
 INSERT INTO public.creative_trip_members(trip_id,user_id) VALUES(p_trip,p_user);
 INSERT INTO public.conversation_participants(conversation_id,user_id) VALUES(t.conversation_id,p_user) ON CONFLICT DO NOTHING;
 -- Same rule as joining: a new roster means new shares, so pledges and approvals reset.
 UPDATE public.creative_trips SET revision=revision+1 WHERE id=p_trip RETURNING * INTO t;
 UPDATE public.creative_trip_members SET approved_revision=NULL,pledge_cents=0 WHERE trip_id=p_trip;
 INSERT INTO public.creative_trip_audit(trip_id,actor_id,action,revision) VALUES(p_trip,me,'approved_traveler',t.revision);
 INSERT INTO public.notifications(user_id,type,title,body,data)
 VALUES(p_user,'trip_approved','You''re in',t.title||' approved your request. The group chat is open.',jsonb_build_object('path','/travel?trip='||t.id,'trip_id',t.id,'conversation_id',t.conversation_id));
 RETURN public.creative_trip_snapshot(p_trip);
END $$;

-- For members: who is asking. For anyone: my own request status on each trip.
CREATE FUNCTION public.creative_trip_requests(p_trip uuid DEFAULT NULL) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('trip_id',r.trip_id,'user_id',r.user_id,'note',r.note,'status',r.status,'created_at',r.created_at,
  'display_name',coalesce(p.display_name,'Creative'),'avatar_url',p.avatar_url) ORDER BY r.created_at),'[]'::jsonb)
 FROM public.creative_trip_join_requests r LEFT JOIN public.profiles_public p ON p.user_id=r.user_id
 WHERE auth.uid() IS NOT NULL AND (p_trip IS NULL OR r.trip_id=p_trip)
  AND (r.user_id=auth.uid() OR (r.status='pending' AND EXISTS(SELECT 1 FROM public.creative_trip_members m WHERE m.trip_id=r.trip_id AND m.user_id=auth.uid())))
  AND NOT EXISTS(SELECT 1 FROM public.creative_trip_members m WHERE m.trip_id=r.trip_id AND public.either_blocked(auth.uid(),m.user_id) AND r.user_id<>auth.uid());
$$;

REVOKE ALL ON FUNCTION public.creative_trip_member_gate(),public.creative_trip_request(uuid,text),public.creative_trip_answer(uuid,uuid,boolean),public.creative_trip_requests(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.creative_trip_member_gate() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.creative_trip_request(uuid,text),public.creative_trip_answer(uuid,uuid,boolean),public.creative_trip_requests(uuid) TO authenticated;
