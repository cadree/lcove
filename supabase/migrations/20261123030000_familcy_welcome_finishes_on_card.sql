-- Registering the ETHER Card finishes the welcome. Before this, the welcome
-- stayed open until a separate "Continue to Explore" tap, and every page load
-- in between was redirected to /welcome. Members who left for Apple Wallet or
-- tapped a tab were trapped (only the Create sheet, which is not a route, still
-- opened). This also releases members already stuck that way, including on
-- app builds that bundle the old client code.
BEGIN;

CREATE OR REPLACE FUNCTION public.register_my_ether_card()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE v_uid uuid := (SELECT auth.uid());
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id=v_uid AND p.access_status='active' AND p.onboarding_completed
      AND p.username ~ '^[a-z0-9_]{3,20}$'
      AND nullif(btrim(p.passion_title),'') IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Save a username and a creative passion to register your ETHER Card'
      USING ERRCODE='23514';
  END IF;
  UPDATE public.member_acceptance_events
  SET card_registered_at=coalesce(card_registered_at,now()),
      welcome_completed_at=coalesce(welcome_completed_at,now())
  WHERE applicant_user_id=v_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No pending welcome found for this account' USING ERRCODE='23514';
  END IF;
END;
$fn$;
REVOKE ALL ON FUNCTION public.register_my_ether_card() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.register_my_ether_card() TO authenticated,service_role;

UPDATE public.member_acceptance_events
SET welcome_completed_at=card_registered_at
WHERE card_registered_at IS NOT NULL AND welcome_completed_at IS NULL;

COMMIT;
