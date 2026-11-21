-- Applicants can request endorsements after signup. Links never grant access.
BEGIN;
CREATE TABLE public.membership_vouch_links (
 applicant_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid()
);
CREATE TABLE public.membership_vouches (
 applicant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 member_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 note text NOT NULL DEFAULT '' CHECK (length(note)<=280),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(applicant_id,member_id), CHECK(applicant_id<>member_id)
);
ALTER TABLE public.membership_vouch_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_vouches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.membership_vouch_links,public.membership_vouches FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.membership_vouch_links,public.membership_vouches TO service_role;
CREATE FUNCTION public.get_my_membership_vouch_link() RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE user_id=auth.uid() AND onboarding_completed AND access_status='pending' AND deleted_at IS NULL AND NOT coalesce(is_suspended,false)) THEN
 RAISE EXCEPTION 'Only applicants awaiting review can request a vouch' USING ERRCODE='42501'; END IF;
 INSERT INTO public.membership_vouch_links(applicant_id) VALUES(auth.uid()) ON CONFLICT DO NOTHING;
 SELECT token INTO result FROM public.membership_vouch_links WHERE applicant_id=auth.uid();
 RETURN result;
END $$;
CREATE FUNCTION public.membership_vouch_context(p_token uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to vouch' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE user_id=auth.uid() AND access_status='active' AND onboarding_completed AND deleted_at IS NULL AND NOT coalesce(is_suspended,false)) THEN
 RAISE EXCEPTION 'Only approved members can vouch' USING ERRCODE='42501'; END IF;
 SELECT jsonb_build_object('name',coalesce(p.display_name,'This creative'),'already_vouched',EXISTS(SELECT 1 FROM public.membership_vouches v WHERE v.applicant_id=p.user_id AND v.member_id=auth.uid())) INTO result
 FROM public.membership_vouch_links l JOIN public.profiles p ON p.user_id=l.applicant_id
 WHERE l.token=p_token AND p.access_status='pending' AND p.onboarding_completed AND p.deleted_at IS NULL AND NOT coalesce(p.is_suspended,false) AND p.user_id<>auth.uid();
 IF result IS NULL THEN RAISE EXCEPTION 'This vouch request is no longer available'; END IF;
 RETURN result;
END $$;
CREATE FUNCTION public.submit_membership_vouch(p_token uuid,p_note text DEFAULT '') RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE applicant uuid;
BEGIN
 PERFORM public.membership_vouch_context(p_token);
 SELECT l.applicant_id INTO applicant FROM public.membership_vouch_links l JOIN public.profiles p ON p.user_id=l.applicant_id
 WHERE l.token=p_token AND p.access_status='pending' FOR UPDATE OF p;
 IF applicant IS NULL THEN RAISE EXCEPTION 'This application is no longer pending'; END IF;
 IF length(coalesce(p_note,''))>280 THEN RAISE EXCEPTION 'Keep your note to 280 characters'; END IF;
 INSERT INTO public.membership_vouches(applicant_id,member_id,note) VALUES(applicant,auth.uid(),btrim(coalesce(p_note,''))) ON CONFLICT DO NOTHING;
END $$;
CREATE FUNCTION public.membership_vouches_for_review(p_applicant uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admins only' USING ERRCODE='42501'; END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('member_id',v.member_id,'name',coalesce(p.display_name,'ETHER member'),'note',v.note,'created_at',v.created_at) ORDER BY v.created_at) FROM public.membership_vouches v LEFT JOIN public.profiles p ON p.user_id=v.member_id WHERE v.applicant_id=p_applicant),'[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.get_my_membership_vouch_link(),public.membership_vouch_context(uuid),public.submit_membership_vouch(uuid,text),public.membership_vouches_for_review(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_membership_vouch_link(),public.membership_vouch_context(uuid),public.submit_membership_vouch(uuid,text),public.membership_vouches_for_review(uuid) TO authenticated;
-- Preserve the existing guard and add only the pending applicant's narrow RPC.
DO $$ DECLARE def text; BEGIN
 SELECT pg_get_functiondef('public.ether_pending_request_guard()'::regprocedure) INTO def;
 IF position('''/rpc/get_my_member_referral_code''' in def)=0 THEN RAISE EXCEPTION 'Unexpected pending guard; review before migrating'; END IF;
 EXECUTE replace(def,'''/rpc/get_my_member_referral_code''','''/rpc/get_my_membership_vouch_link'',''/rpc/get_my_member_referral_code''');
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
