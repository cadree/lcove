-- Trip board: the shared plan inside a trip. Itinerary stops, inspiration photos,
-- and packing/shopping checklists. Only the trip's travelers can see or edit it.
-- Anyone on the trip adds and ticks items; you remove your own, the organizer can remove any.
-- Rollback: supabase/rollbacks/20261114172000_trip_board.down.sql
CREATE TABLE public.creative_trip_board (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 trip_id uuid NOT NULL REFERENCES public.creative_trips(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN('stop','photo','packing','shopping')),
 title text NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 140),
 detail text NOT NULL DEFAULT '' CHECK(length(detail)<=500),
 day date,
 at_time time,
 image_url text CHECK(image_url IS NULL OR (image_url ~ '^https://' AND length(image_url)<=2000)),
 done boolean NOT NULL DEFAULT false,
 created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(kind<>'photo' OR image_url IS NOT NULL),
 CHECK(kind='stop' OR (day IS NULL AND at_time IS NULL))
);
CREATE INDEX creative_trip_board_trip ON public.creative_trip_board(trip_id,kind,day,at_time,created_at);
ALTER TABLE public.creative_trip_board ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creative_trip_board FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.creative_trip_board FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,DELETE ON public.creative_trip_board TO authenticated;
GRANT UPDATE(title,detail,day,at_time,done) ON public.creative_trip_board TO authenticated;

CREATE FUNCTION public.creative_trip_member(p_trip uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.creative_trip_members WHERE trip_id=p_trip AND user_id=auth.uid());
$$;
CREATE FUNCTION public.creative_trip_open(p_trip uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.creative_trips WHERE id=p_trip AND status IN('planning','booked'));
$$;
CREATE FUNCTION public.creative_trip_organizer(p_trip uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.creative_trips WHERE id=p_trip AND organizer_id=auth.uid());
$$;
REVOKE ALL ON FUNCTION public.creative_trip_member(uuid),public.creative_trip_open(uuid),public.creative_trip_organizer(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.creative_trip_member(uuid),public.creative_trip_open(uuid),public.creative_trip_organizer(uuid) TO authenticated;

CREATE POLICY trip_board_read ON public.creative_trip_board FOR SELECT TO authenticated USING(public.creative_trip_member(trip_id));
CREATE POLICY trip_board_add ON public.creative_trip_board FOR INSERT TO authenticated
 WITH CHECK(created_by=auth.uid() AND public.creative_trip_member(trip_id) AND public.creative_trip_open(trip_id)
);
CREATE POLICY trip_board_edit ON public.creative_trip_board FOR UPDATE TO authenticated
 USING(public.creative_trip_member(trip_id) AND public.creative_trip_open(trip_id))
 WITH CHECK(public.creative_trip_member(trip_id));
CREATE POLICY trip_board_remove ON public.creative_trip_board FOR DELETE TO authenticated
 USING(public.creative_trip_member(trip_id) AND (created_by=auth.uid() OR public.creative_trip_organizer(trip_id)));

-- Text moderation runs here (definer) because members cannot call objectionable_text
-- directly. 200 board items per trip keeps it a plan, not a dumping ground.
CREATE FUNCTION public.creative_trip_board_cap() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF public.objectionable_text(NEW.title||' '||NEW.detail) THEN RAISE EXCEPTION 'That text is not allowed'; END IF;
 IF TG_OP='INSERT' AND (SELECT count(*) FROM public.creative_trip_board WHERE trip_id=NEW.trip_id)>=200 THEN RAISE EXCEPTION 'This trip board is full (200 items)'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER creative_trip_board_cap BEFORE INSERT OR UPDATE ON public.creative_trip_board FOR EACH ROW EXECUTE FUNCTION public.creative_trip_board_cap();
REVOKE ALL ON FUNCTION public.creative_trip_board_cap() FROM PUBLIC,anon,authenticated;
