-- Free listening is explicit: legacy zero-price subscriber tracks stay locked.
-- Keep originals in music-private; the app exposes no free download action.
ALTER TABLE public.exclusive_tracks
  ADD CONSTRAINT exclusive_tracks_free_listening
  CHECK (access_type IS DISTINCT FROM 'free' OR
    (price_cents IS NOT DISTINCT FROM 0 AND allow_downloads IS FALSE)) NOT VALID;

CREATE OR REPLACE FUNCTION public.can_read_private_music(p_object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    split_part(p_object_name, '/', 1) = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.exclusive_tracks t
      WHERE t.audio_file_path = p_object_name
        AND (
          (t.access_type = 'free' AND t.price_cents = 0 AND t.is_published = true)
          OR EXISTS (
            SELECT 1 FROM public.exclusive_track_purchases p
            WHERE p.track_id = t.id AND p.buyer_user_id = auth.uid()
              AND p.payment_status = 'paid'
          )
          OR EXISTS (
            SELECT 1 FROM public.artist_subscriptions s
            WHERE s.artist_user_id = t.artist_user_id AND s.subscriber_user_id = auth.uid()
              AND s.status = 'active'
              AND (s.current_period_end IS NULL OR s.current_period_end > now())
          )
        )
    )
  );
$$;
REVOKE ALL ON FUNCTION public.can_read_private_music(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_read_private_music(text) TO anon, authenticated, service_role;
