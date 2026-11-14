-- Planning only. These tables never represent held funds or payment authorization.
BEGIN;
CREATE TABLE public.creative_trips (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_id uuid NOT NULL DEFAULT gen_random_uuid(), organizer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 city_key text NOT NULL, city_label text NOT NULL, title text NOT NULL CHECK(length(title) BETWEEN 3 AND 100),
 starts_on date NOT NULL, ends_on date NOT NULL CHECK(ends_on>=starts_on),
 capacity integer NOT NULL CHECK(capacity BETWEEN 2 AND 20), notes text NOT NULL DEFAULT '' CHECK(length(notes)<=2000),
 currency text NOT NULL DEFAULT 'USD' CHECK(currency='USD'), revision integer NOT NULL DEFAULT 1,
 status text NOT NULL DEFAULT 'planning' CHECK(status IN('planning','booked','completed','cancelled')),
 UNIQUE(organizer_id,request_id),
 conversation_id uuid NOT NULL UNIQUE REFERENCES public.conversations(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.creative_trip_members (
 trip_id uuid NOT NULL REFERENCES public.creative_trips(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, pledge_cents bigint NOT NULL DEFAULT 0 CHECK(pledge_cents BETWEEN 0 AND 100000000),
 reported_paid_cents bigint NOT NULL DEFAULT 0 CHECK(reported_paid_cents BETWEEN 0 AND 100000000),
 approved_revision integer, PRIMARY KEY(trip_id,user_id)
);
CREATE TABLE public.creative_trip_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), trip_id uuid NOT NULL REFERENCES public.creative_trips(id) ON DELETE CASCADE,
 label text NOT NULL CHECK(length(label) BETWEEN 1 AND 120), estimate_cents bigint NOT NULL CHECK(estimate_cents BETWEEN 1 AND 100000000),
 quote_url text NOT NULL DEFAULT '' CHECK(length(quote_url)<=2000),
 receipt_url text CHECK(length(receipt_url)<=2000), actual_cents bigint CHECK(actual_cents>0), purchased_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 CHECK(actual_cents IS NULL OR actual_cents<=estimate_cents)
);
CREATE TABLE public.creative_receipt_votes (
 item_id uuid NOT NULL REFERENCES public.creative_trip_items(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, approved boolean NOT NULL, PRIMARY KEY(item_id,user_id)
);
CREATE TABLE public.creative_trip_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, trip_id uuid NOT NULL REFERENCES public.creative_trips(id),
 actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, action text NOT NULL, revision integer NOT NULL, details jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.creative_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creative_trip_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creative_trip_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creative_receipt_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creative_trip_audit ENABLE ROW LEVEL SECURITY;
-- No direct access. RPCs constrain reads and writes to the necessary audience.
REVOKE ALL ON public.creative_trips,public.creative_trip_members,public.creative_trip_items,public.creative_receipt_votes,public.creative_trip_audit FROM anon,authenticated;

CREATE FUNCTION public.creative_trip_snapshot(p_trip uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t public.creative_trips%ROWTYPE; result jsonb;
BEGIN
 SELECT * INTO t FROM public.creative_trips WHERE id=p_trip;
 IF NOT EXISTS(SELECT 1 FROM public.creative_trip_members WHERE trip_id=p_trip AND user_id=auth.uid()) THEN RAISE EXCEPTION 'Join this trip to view its budget'; END IF;
 WITH totals AS (SELECT coalesce(sum(estimate_cents),0)::bigint total FROM public.creative_trip_items WHERE trip_id=p_trip),
 members AS (
 SELECT m.*,coalesce(p.display_name,'Creative') display_name,
 (totals.total/count(*) OVER())::bigint + CASE WHEN row_number() OVER(ORDER BY m.user_id)<=mod(totals.total,count(*) OVER()) THEN 1 ELSE 0 END share_cents
 FROM public.creative_trip_members m CROSS JOIN totals LEFT JOIN public.profiles_public p ON p.user_id=m.user_id WHERE m.trip_id=p_trip
 ), items AS (
 SELECT i.*,coalesce((SELECT jsonb_agg(jsonb_build_object('user_id',v.user_id,'approved',v.approved)) FROM public.creative_receipt_votes v WHERE v.item_id=i.id),'[]'::jsonb) votes
 FROM public.creative_trip_items i WHERE i.trip_id=p_trip
 ) SELECT to_jsonb(t)||jsonb_build_object('total_cents',(SELECT total FROM totals),
 'members',(SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY user_id),'[]'::jsonb) FROM members m),
 'items',(SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY id),'[]'::jsonb) FROM items i),
 'audit',(SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY id DESC),'[]'::jsonb) FROM (SELECT action,actor_id,revision,details,created_at,id FROM public.creative_trip_audit WHERE trip_id=p_trip ORDER BY id DESC LIMIT 50) a)) INTO result;
 RETURN result;
END $$;

CREATE FUNCTION public.creative_trip_list(p_city text DEFAULT NULL,p_start date DEFAULT NULL,p_end date DEFAULT NULL) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY starts_on,id),'[]'::jsonb) FROM (
 SELECT t.id,t.city_key,t.city_label,t.title,t.starts_on,t.ends_on,t.capacity,t.notes,t.status,t.organizer_id,t.conversation_id,
 EXISTS(SELECT 1 FROM public.creative_trip_members WHERE trip_id=t.id AND user_id=auth.uid()) joined,
 (SELECT count(*) FROM public.creative_trip_members WHERE trip_id=t.id) member_count,
 (SELECT coalesce(jsonb_agg(jsonb_build_object('user_id',m.user_id,'display_name',coalesce(p.display_name,'Creative'))),'[]'::jsonb)
 FROM public.creative_trip_members m LEFT JOIN public.profiles_public p ON p.user_id=m.user_id WHERE m.trip_id=t.id) roster
 FROM public.creative_trips t WHERE auth.uid() IS NOT NULL
 AND (EXISTS(SELECT 1 FROM public.creative_trip_members WHERE trip_id=t.id AND user_id=auth.uid()) OR
 (t.status='planning' AND t.starts_on>=current_date AND EXISTS(SELECT 1 FROM public.profiles_public p WHERE p.user_id=t.organizer_id AND p.access_status IS DISTINCT FROM 'banned' AND NOT coalesce(p.is_suspended,false)) AND NOT EXISTS(SELECT 1 FROM public.creative_trip_members WHERE trip_id=t.id AND public.either_blocked(auth.uid(),user_id))))
 AND (p_city IS NULL OR t.city_key=p_city) AND (p_start IS NULL OR t.ends_on>=p_start) AND (p_end IS NULL OR t.starts_on<=p_end)
 ORDER BY t.starts_on,t.id LIMIT 100
 ) x;
$$;

CREATE FUNCTION public.creative_trip_action(p_action text,p_trip uuid DEFAULT NULL,p_data jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE me uuid:=auth.uid(); t public.creative_trips%ROWTYPE; item public.creative_trip_items%ROWTYPE;
 tid uuid:=p_trip; chat uuid; n integer; total bigint; share bigint; value bigint; snap jsonb; invalidate boolean:=false; booked boolean;
BEGIN
 IF me IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
 IF p_action IN('create','join') AND NOT EXISTS(SELECT 1 FROM public.profiles WHERE user_id=me AND onboarding_completed AND access_status IS DISTINCT FROM 'banned' AND NOT coalesce(is_suspended,false)) THEN RAISE EXCEPTION 'Your profile is not eligible to join trips'; END IF;
 IF p_action='create' THEN
  IF p_data->>'request_id' IS NOT NULL THEN
   PERFORM pg_advisory_xact_lock(hashtextextended('ether-trip:'||me::text||':'||(p_data->>'request_id'),0));
   SELECT id INTO tid FROM public.creative_trips WHERE organizer_id=me AND request_id=(p_data->>'request_id')::uuid;
   IF tid IS NOT NULL THEN RETURN public.creative_trip_snapshot(tid); END IF;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE user_id=me AND onboarding_completed AND access_status IS DISTINCT FROM 'banned' AND NOT coalesce(is_suspended,false)) THEN RAISE EXCEPTION 'Your profile is not eligible to organize trips'; END IF;
  IF public.objectionable_text(coalesce(p_data->>'title','')||' '||coalesce(p_data->>'notes','')) THEN RAISE EXCEPTION 'That text is not allowed'; END IF;
  IF coalesce(length(p_data->>'city_key'),0) NOT BETWEEN 1 AND 200 OR coalesce(length(p_data->>'city_label'),0) NOT BETWEEN 1 AND 200
   OR (p_data->>'starts_on')::date<current_date THEN RAISE EXCEPTION 'Choose a destination and future dates'; END IF;
  INSERT INTO public.conversations(type,name,created_by) VALUES('group',left(p_data->>'title',100),me) RETURNING id INTO chat;
  INSERT INTO public.creative_trips(request_id,organizer_id,city_key,city_label,title,starts_on,ends_on,capacity,notes,conversation_id)
  VALUES(coalesce((p_data->>'request_id')::uuid,gen_random_uuid()),me,p_data->>'city_key',p_data->>'city_label',trim(p_data->>'title'),(p_data->>'starts_on')::date,(p_data->>'ends_on')::date,(p_data->>'capacity')::integer,coalesce(p_data->>'notes',''),chat) RETURNING id INTO tid;
  INSERT INTO public.creative_trip_members(trip_id,user_id) VALUES(tid,me);
  INSERT INTO public.conversation_participants(conversation_id,user_id) VALUES(chat,me);
  INSERT INTO public.creative_trip_audit(trip_id,actor_id,action,revision) VALUES(tid,me,'created',1);
  RETURN public.creative_trip_snapshot(tid);
 END IF;
 SELECT * INTO t FROM public.creative_trips WHERE id=tid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Trip not found'; END IF;
 IF t.status IN('cancelled','completed') THEN RAISE EXCEPTION 'This trip is closed'; END IF;
 SELECT EXISTS(SELECT 1 FROM public.creative_trip_items WHERE trip_id=tid AND receipt_url IS NOT NULL) INTO booked;
 IF p_action='join' THEN
  IF EXISTS(SELECT 1 FROM public.creative_trip_members WHERE trip_id=tid AND user_id=me) THEN RETURN public.creative_trip_snapshot(tid); END IF;
  IF NOT EXISTS(SELECT 1 FROM public.profiles_public WHERE user_id=t.organizer_id AND access_status IS DISTINCT FROM 'banned' AND NOT coalesce(is_suspended,false)) THEN RAISE EXCEPTION 'This trip is unavailable'; END IF;
  IF t.status<>'planning' OR booked OR t.starts_on<current_date THEN RAISE EXCEPTION 'This trip is no longer accepting travelers'; END IF;
  IF EXISTS(SELECT 1 FROM public.creative_trip_members WHERE trip_id=tid AND public.either_blocked(me,user_id)) THEN RAISE EXCEPTION 'This trip is unavailable'; END IF;
  IF (SELECT count(*) FROM public.creative_trip_members WHERE trip_id=tid)>=t.capacity THEN RAISE EXCEPTION 'This trip is full'; END IF;
  INSERT INTO public.creative_trip_members(trip_id,user_id) VALUES(tid,me);
  INSERT INTO public.conversation_participants(conversation_id,user_id) VALUES(t.conversation_id,me) ON CONFLICT DO NOTHING;
  invalidate:=true;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM public.creative_trip_members WHERE trip_id=tid AND user_id=me) THEN RAISE EXCEPTION 'Join this trip first'; END IF;
  SELECT count(*) INTO n FROM public.creative_trip_members WHERE trip_id=tid;
  SELECT coalesce(sum(estimate_cents),0) INTO total FROM public.creative_trip_items WHERE trip_id=tid;
  SELECT total/n+CASE WHEN (SELECT count(*) FROM public.creative_trip_members WHERE trip_id=tid AND user_id<=me)<=mod(total,n) THEN 1 ELSE 0 END INTO share;
  CASE p_action
  WHEN 'leave' THEN
   IF booked OR me=t.organizer_id THEN RAISE EXCEPTION 'The organizer or a traveler with recorded bookings must cancel or settle the trip instead'; END IF;
   DELETE FROM public.creative_trip_members WHERE trip_id=tid AND user_id=me;
   DELETE FROM public.conversation_participants WHERE conversation_id=t.conversation_id AND user_id=me;
   invalidate:=true;
  WHEN 'add_item' THEN
   IF public.objectionable_text(p_data->>'label') THEN RAISE EXCEPTION 'That text is not allowed'; END IF;
   IF me<>t.organizer_id OR booked THEN RAISE EXCEPTION 'Only the organizer can edit a budget before bookings'; END IF;
   IF (SELECT count(*) FROM public.creative_trip_items WHERE trip_id=tid)>=30 THEN RAISE EXCEPTION 'Maximum 30 budget items'; END IF;
   IF coalesce(p_data->>'quote_url','')<>'' AND (p_data->>'quote_url') !~ '^https://' THEN RAISE EXCEPTION 'Quote links must use HTTPS'; END IF;
   value:=(p_data->>'estimate_cents')::bigint;
   IF total+value>100000000 THEN RAISE EXCEPTION 'Trip budget exceeds the supported limit'; END IF;
   INSERT INTO public.creative_trip_items(trip_id,label,estimate_cents,quote_url) VALUES(tid,trim(p_data->>'label'),value,coalesce(p_data->>'quote_url',''));
   invalidate:=true;
  WHEN 'remove_item' THEN
   IF me<>t.organizer_id OR booked THEN RAISE EXCEPTION 'Only the organizer can edit a budget before bookings'; END IF;
   DELETE FROM public.creative_trip_items WHERE id=(p_data->>'item_id')::uuid AND trip_id=tid;
   invalidate:=true;
  WHEN 'pledge' THEN
   IF booked THEN RAISE EXCEPTION 'Pledges are locked after a booking is recorded'; END IF;
   value:=(p_data->>'cents')::bigint;
   IF value<0 OR value>share THEN RAISE EXCEPTION 'Pledge must be between zero and your share'; END IF;
   UPDATE public.creative_trip_members SET pledge_cents=value,approved_revision=NULL WHERE trip_id=tid AND user_id=me;
  WHEN 'approve_budget' THEN
   IF (p_data->>'revision')::integer IS DISTINCT FROM t.revision THEN RAISE EXCEPTION 'Budget changed. Review it again'; END IF;
   IF total<=0 OR n<2 OR (SELECT pledge_cents FROM public.creative_trip_members WHERE trip_id=tid AND user_id=me)<share THEN RAISE EXCEPTION 'At least two travelers and your full pledge are required'; END IF;
   UPDATE public.creative_trip_members SET approved_revision=t.revision WHERE trip_id=tid AND user_id=me;
  WHEN 'report_paid' THEN
   value:=(p_data->>'cents')::bigint;
   IF value<0 OR value>share THEN RAISE EXCEPTION 'Reported payment must be between zero and your share'; END IF;
   UPDATE public.creative_trip_members SET reported_paid_cents=value WHERE trip_id=tid AND user_id=me;
  WHEN 'record_receipt' THEN
   IF (p_data->>'revision')::integer IS DISTINCT FROM t.revision THEN RAISE EXCEPTION 'Budget changed. Review it again'; END IF;
   IF n<2 OR total<=0 OR EXISTS(SELECT 1 FROM public.creative_trip_members WHERE trip_id=tid AND approved_revision IS DISTINCT FROM t.revision) THEN RAISE EXCEPTION 'Everyone must approve this budget first'; END IF;
   SELECT * INTO item FROM public.creative_trip_items WHERE id=(p_data->>'item_id')::uuid AND trip_id=tid;
   IF NOT FOUND OR item.receipt_url IS NOT NULL THEN RAISE EXCEPTION 'Receipt already recorded or item not found'; END IF;
   IF coalesce(p_data->>'receipt_url','') !~ '^https://' THEN RAISE EXCEPTION 'Provide an HTTPS receipt link accessible to your group'; END IF;
   value:=(p_data->>'actual_cents')::bigint;
   IF value<=0 OR value>item.estimate_cents THEN RAISE EXCEPTION 'Actual cost must be within the approved estimate'; END IF;
   UPDATE public.creative_trip_items SET receipt_url=p_data->>'receipt_url',actual_cents=value,purchased_by=me WHERE id=item.id;
  WHEN 'confirm_receipt' THEN
   SELECT * INTO item FROM public.creative_trip_items WHERE id=(p_data->>'item_id')::uuid AND trip_id=tid;
   IF NOT FOUND OR item.receipt_url IS NULL THEN RAISE EXCEPTION 'Record the receipt first'; END IF;
   INSERT INTO public.creative_receipt_votes(item_id,user_id,approved) VALUES(item.id,me,(p_data->>'approved')::boolean)
   ON CONFLICT(item_id,user_id) DO UPDATE SET approved=excluded.approved;
   IF NOT EXISTS(SELECT 1 FROM public.creative_trip_items i WHERE i.trip_id=tid AND (i.receipt_url IS NULL OR
    (SELECT count(*) FROM public.creative_receipt_votes v JOIN public.creative_trip_members m ON m.user_id=v.user_id AND m.trip_id=tid WHERE v.item_id=i.id AND v.approved)<n)) THEN
    UPDATE public.creative_trips SET status='booked' WHERE id=tid;
   ELSE UPDATE public.creative_trips SET status='planning' WHERE id=tid; END IF;
  WHEN 'cancel' THEN
   IF me<>t.organizer_id THEN RAISE EXCEPTION 'Only the organizer can cancel'; END IF;
   UPDATE public.creative_trips SET status='cancelled' WHERE id=tid;
  WHEN 'complete' THEN
   IF me<>t.organizer_id OR t.status<>'booked' OR t.ends_on>current_date THEN RAISE EXCEPTION 'Complete after the trip ends and all receipts are confirmed'; END IF;
   UPDATE public.creative_trips SET status='completed' WHERE id=tid;
  ELSE RAISE EXCEPTION 'Unknown trip action';
  END CASE;
 END IF;
 IF invalidate THEN
  UPDATE public.creative_trips SET revision=revision+1 WHERE id=tid RETURNING * INTO t;
  -- Reset promises rather than silently applying them to a different roster/budget.
  UPDATE public.creative_trip_members SET approved_revision=NULL,pledge_cents=0 WHERE trip_id=tid;
 END IF;
 INSERT INTO public.creative_trip_audit(trip_id,actor_id,action,revision,details) VALUES(tid,me,p_action,t.revision,jsonb_strip_nulls(jsonb_build_object('cents',p_data->'cents','item_id',p_data->'item_id','actual_cents',p_data->'actual_cents','approved',p_data->'approved')));
 IF p_action='leave' THEN RETURN jsonb_build_object('left',true); END IF;
 snap:=public.creative_trip_snapshot(tid);
 RETURN snap;
END $$;

-- A trip membership is the sole authority for joining its conversation.
CREATE FUNCTION public.enforce_creative_trip_chat() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE tid uuid;
BEGIN
 SELECT id INTO tid FROM public.creative_trips WHERE conversation_id=coalesce(NEW.conversation_id,OLD.conversation_id);
 IF tid IS NULL THEN RETURN coalesce(NEW,OLD); END IF;
 IF TG_OP='DELETE' THEN
  IF EXISTS(SELECT 1 FROM public.creative_trip_members WHERE trip_id=tid AND user_id=OLD.user_id) THEN RAISE EXCEPTION 'Leave from the trip planner so the budget can be updated'; END IF;
  RETURN OLD;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.creative_trip_members WHERE trip_id=tid AND user_id=NEW.user_id) THEN RAISE EXCEPTION 'Join through the trip planner'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER creative_trip_chat_membership BEFORE INSERT OR UPDATE OR DELETE ON public.conversation_participants FOR EACH ROW EXECUTE FUNCTION public.enforce_creative_trip_chat();
REVOKE ALL ON FUNCTION public.creative_trip_snapshot(uuid),public.creative_trip_list(text,date,date),public.creative_trip_action(text,uuid,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.enforce_creative_trip_chat() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.creative_trip_snapshot(uuid),public.creative_trip_list(text,date,date),public.creative_trip_action(text,uuid,jsonb) TO authenticated;

CREATE FUNCTION public.creative_trip_for_chat(p_chat uuid) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT t.id FROM public.creative_trips t JOIN public.creative_trip_members m ON m.trip_id=t.id AND m.user_id=auth.uid() WHERE t.conversation_id=p_chat;
$$;
REVOKE ALL ON FUNCTION public.creative_trip_for_chat(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.creative_trip_for_chat(uuid) TO authenticated;
-- Account deletion must not be blocked by a planning pledge or leave orphaned approvals.
CREATE FUNCTION public.purge_creative_travel(target uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 UPDATE public.creative_trips SET status='cancelled', revision=revision+1
 WHERE status NOT IN('cancelled','completed') AND id IN(SELECT trip_id FROM public.creative_trip_members WHERE user_id=target);
 UPDATE public.creative_trips SET organizer_id=NULL,title='Cancelled creative trip',notes='' WHERE organizer_id=target;
 UPDATE public.creative_trip_items SET purchased_by=NULL,receipt_url=NULL,actual_cents=NULL WHERE purchased_by=target;
 DELETE FROM public.creative_receipt_votes WHERE user_id=target;
 DELETE FROM public.creative_trip_members WHERE user_id=target;
 UPDATE public.creative_trip_audit SET actor_id=NULL WHERE actor_id=target;
END $$;
ALTER FUNCTION public.purge_user_personal_data(uuid) RENAME TO purge_user_personal_data_before_creative;
CREATE FUNCTION public.purge_user_personal_data(target uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM public.purge_creative_travel(target);
 PERFORM public.purge_user_personal_data_before_creative(target);
END $$;
CREATE FUNCTION public.creative_account_deleted() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN PERFORM public.purge_creative_travel(OLD.id); RETURN OLD; END $$;
CREATE TRIGGER creative_account_deleted BEFORE DELETE ON auth.users FOR EACH ROW EXECUTE FUNCTION public.creative_account_deleted();
REVOKE ALL ON FUNCTION public.purge_creative_travel(uuid),public.creative_account_deleted(),public.purge_user_personal_data(uuid),public.purge_user_personal_data_before_creative(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.purge_user_personal_data(uuid) TO service_role;

-- Restrictive policies protect the trip chat even if a legacy permissive policy
-- allows public collective reads. Organizers cannot turn a trip into a public hub.
CREATE FUNCTION public.creative_can_read_chat(p_chat uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT NOT EXISTS(SELECT 1 FROM public.creative_trips WHERE conversation_id=p_chat)
 OR EXISTS(SELECT 1 FROM public.creative_trips t JOIN public.creative_trip_members m ON m.trip_id=t.id WHERE t.conversation_id=p_chat AND m.user_id=auth.uid());
$$;
REVOKE ALL ON FUNCTION public.creative_can_read_chat(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.creative_can_read_chat(uuid) TO authenticated,anon;
CREATE POLICY creative_trip_chat_read ON public.conversations AS RESTRICTIVE FOR SELECT USING(public.creative_can_read_chat(id));
CREATE POLICY creative_trip_members_read ON public.conversation_participants AS RESTRICTIVE FOR SELECT USING(public.creative_can_read_chat(conversation_id));
CREATE POLICY creative_trip_messages_read ON public.messages AS RESTRICTIVE FOR SELECT USING(public.creative_can_read_chat(conversation_id));
CREATE FUNCTION public.creative_trip_chat_private() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.creative_trips WHERE conversation_id=OLD.id) AND
 (NEW.visibility IS DISTINCT FROM OLD.visibility OR NEW.project_id IS DISTINCT FROM OLD.project_id OR NEW.type IS DISTINCT FROM OLD.type
 OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.is_community_hub IS DISTINCT FROM OLD.is_community_hub) THEN
 RAISE EXCEPTION 'Trip chats must stay private and attached to their trip'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER creative_trip_chat_private BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.creative_trip_chat_private();
REVOKE ALL ON FUNCTION public.creative_trip_chat_private() FROM PUBLIC,anon,authenticated;
COMMIT;
