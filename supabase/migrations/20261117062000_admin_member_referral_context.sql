-- Admin reviewers can see who introduced an applicant, without making
-- pending applicant identities or sponsor email addresses publicly readable.
BEGIN;
CREATE OR REPLACE FUNCTION public.get_member_referral_for_review(p_applicant uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE v_result jsonb;
BEGIN
  IF (SELECT auth.uid()) IS NULL
     OR NOT public.has_role((SELECT auth.uid()), 'admin') THEN
    RAISE EXCEPTION 'Administrator permission required' USING ERRCODE='42501';
  END IF;

  SELECT jsonb_build_object(
    'sponsor_user_id',r.sponsor_user_id,
    'sponsor_name',left(coalesce(nullif(btrim(p.display_name),''),'An ETHER creative'),80),
    'kind',r.introduction_kind,
    'introduced_at',r.created_at
  ) INTO v_result
  FROM public.member_referrals r
  JOIN public.profiles p ON p.user_id=r.sponsor_user_id
  WHERE r.applicant_user_id=p_applicant;

  RETURN v_result;
END;
$fn$;
REVOKE ALL ON FUNCTION public.get_member_referral_for_review(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_member_referral_for_review(uuid) TO authenticated,service_role;
COMMIT;
