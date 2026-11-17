-- A pending applicant or accepted member can enter a creative's name/email and
-- queue one invitation using the same personal referral/vouch link as Share.
-- No automatic approval, no direct INSERT permissions, and strict abuse limits.
BEGIN;

CREATE TABLE public.member_invitation_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  recipient_name text NOT NULL,
  introduction_kind text NOT NULL CHECK (introduction_kind IN ('vouch','referral')),
  queued_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX member_invitation_emails_sponsor_recent_idx
  ON public.member_invitation_emails(sponsor_user_id, queued_at DESC);
CREATE INDEX member_invitation_emails_target_idx
  ON public.member_invitation_emails(sponsor_user_id, recipient_email, queued_at DESC);
ALTER TABLE public.member_invitation_emails ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.member_invitation_emails FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_invitation_emails TO service_role;

CREATE OR REPLACE FUNCTION public.send_member_referral_invite(
  p_name text, p_email text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_email text := lower(btrim(coalesce(p_email,'')));
  v_name text := btrim(regexp_replace(coalesce(p_name,''),'[[:cntrl:]]',' ','g'));
  v_sponsor_name text;
  v_sponsor_email text;
  v_kind text;
  v_code text;
  v_id uuid;
  v_invite_url text;
  v_email_body text;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id=v_uid AND u.email_confirmed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Sign in with a verified email to send invitations'
      USING ERRCODE='42501';
  END IF;

  SELECT left(coalesce(nullif(btrim(p.display_name),''),'An ETHER creative'),80),
    CASE WHEN p.access_status='active' THEN 'vouch' ELSE 'referral' END
  INTO v_sponsor_name, v_kind
  FROM public.profiles p
  WHERE p.user_id=v_uid
    AND p.onboarding_completed IS TRUE
    AND p.access_status IN ('active','pending');
  IF v_kind IS NULL THEN
    RAISE EXCEPTION 'Complete your application before inviting creatives'
      USING ERRCODE='42501';
  END IF;

  IF length(v_name)<1 OR length(v_name)>80 THEN
    RAISE EXCEPTION 'Enter the creative''s name (up to 80 characters)'
      USING ERRCODE='22023';
  END IF;

  IF length(v_email)>254
    OR v_email !~ '^[^[:space:]@<>]+@[^[:space:]@<>]+[.][^[:space:]@<>]+$' THEN
    RAISE EXCEPTION 'Enter a valid email address for your creative'
      USING ERRCODE='22023';
  END IF;

  SELECT lower(email) INTO v_sponsor_email FROM auth.users WHERE id=v_uid;
  IF v_email=v_sponsor_email THEN
    RAISE EXCEPTION 'Invite another creative rather than your own account'
      USING ERRCODE='22023';
  END IF;

  -- Serialize all invitations from one sponsor to prevent concurrent requests
  -- circumventing the daily or recipient-specific quotas.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_uid::text, 7717));
  IF (SELECT count(*) FROM public.member_invitation_emails i
      WHERE i.sponsor_user_id=v_uid
        AND i.queued_at>now()-interval '24 hours')>=10 THEN
    RAISE EXCEPTION 'You have sent 10 invitations in the last 24 hours. Try again tomorrow.'
      USING ERRCODE='22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.member_invitation_emails i
    WHERE i.sponsor_user_id=v_uid
      AND i.recipient_email=v_email
      AND i.queued_at>now()-interval '7 days'
  ) THEN
    RAISE EXCEPTION 'You already invited this creative recently. Try again in 7 days.'
      USING ERRCODE='22023';
  END IF;

  -- get_my_member_referral_code has its own eligibility check and issues a
  -- persistent token, so every email tracks the same sponsor through signup.
  v_code := public.get_my_member_referral_code();
  v_invite_url := 'https://etherbylcove.com/auth?tab=join&ref='||v_code;

  INSERT INTO public.member_invitation_emails(
    sponsor_user_id,recipient_email,recipient_name,introduction_kind
  ) VALUES (v_uid,v_email,v_name,v_kind)
  RETURNING id INTO v_id;

  v_email_body := concat_ws(E'\n',
    'Hi '||v_name||',',
    '',
    v_sponsor_name||' '||
      CASE WHEN v_kind='vouch' THEN 'is vouching for you' ELSE 'invited you' END||
      ' to apply to ETHER, a community for creatives.',
    '',
    'Start your ETHER application:',
    v_invite_url,
    '',
    'You will create your own account and submit an application for review.',
    'An invitation does not guarantee approval or immediate access.',
    '',
    'If you did not expect this invitation, you can ignore this email.',
    '',
    'ETHER by LCOVE'
  );

  PERFORM pgmq.send('transactional_emails',jsonb_build_object(
    'message_id','ether-member-invite-'||v_id::text,
    'idempotency_key','ether-member-invite-'||v_id::text,
    'to',v_email,
    'subject',v_sponsor_name||' invited you to ETHER',
    'text',v_email_body,
    'label','ether_member_invite',
    'queued_at',clock_timestamp()
  ));

  RETURN jsonb_build_object('queued',true);
END;
$fn$;
REVOKE ALL ON FUNCTION public.send_member_referral_invite(text,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.send_member_referral_invite(text,text)
  TO authenticated,service_role;

-- The pre-request guard previously blocked this EXACT functionality on
-- /pending, even though the referral RPC itself allowed pending members.
-- Whitelist only the three narrow referral RPCs; each checks eligibility.
CREATE OR REPLACE FUNCTION public.ether_pending_request_guard()
RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE path text:=current_setting('request.path',true);
BEGIN
  IF auth.role()='service_role' OR auth.uid() IS NULL OR public.ether_member_approved() THEN
    RETURN;
  END IF;
  IF path IN (
    '/profiles','/profiles_public','/user_roles','/passions','/skills',
    '/creative_roles','/user_passions','/user_skills','/user_creative_roles',
    '/questionnaire_responses','/rpc/claim_waitlist_invite',
    '/rpc/get_my_member_referral_code','/rpc/send_member_referral_invite',
    '/rpc/preview_member_referral'
  ) THEN RETURN; END IF;
  RAISE EXCEPTION 'Your application is awaiting approval.' USING ERRCODE='42501';
END;
$fn$;

COMMIT;
