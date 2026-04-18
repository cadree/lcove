CREATE OR REPLACE FUNCTION public.get_artist_payout_status(artist_user_id uuid)
RETURNS TABLE(payout_enabled boolean, has_connect_account boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    COALESCE(p.payout_enabled, false) as payout_enabled,
    (p.stripe_connect_account_id IS NOT NULL) as has_connect_account
  FROM public.profiles p
  WHERE p.user_id = artist_user_id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_artist_payout_status(uuid) TO anon, authenticated;