-- Fan challenge completions table
CREATE TABLE public.fan_challenge_completions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  artist_user_id UUID NOT NULL,
  track_id UUID NULL REFERENCES public.exclusive_tracks(id) ON DELETE CASCADE,
  access_rule_id UUID NOT NULL REFERENCES public.exclusive_access_rules(id) ON DELETE CASCADE,
  challenge_type TEXT NOT NULL DEFAULT 'other',
  proof_url TEXT NULL,
  proof_text TEXT NULL,
  verified BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'completed',
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ NULL,
  revoked_reason TEXT NULL,
  CONSTRAINT fan_challenge_status_chk CHECK (status IN ('completed','flagged','revoked')),
  CONSTRAINT fan_challenge_unique_per_rule UNIQUE (user_id, access_rule_id)
);

CREATE INDEX idx_fan_challenge_user_track ON public.fan_challenge_completions(user_id, track_id);
CREATE INDEX idx_fan_challenge_artist_track ON public.fan_challenge_completions(artist_user_id, track_id);
CREATE INDEX idx_fan_challenge_status ON public.fan_challenge_completions(status);

ALTER TABLE public.fan_challenge_completions ENABLE ROW LEVEL SECURITY;

-- SELECT: completer or artist owner
CREATE POLICY "Users view own completions"
ON public.fan_challenge_completions FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR auth.uid() = artist_user_id);

-- INSERT: must be self, must reference an active challenge rule belonging to the artist
CREATE POLICY "Users insert own completion via active rule"
ON public.fan_challenge_completions FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.exclusive_access_rules r
    WHERE r.id = access_rule_id
      AND r.artist_user_id = fan_challenge_completions.artist_user_id
      AND r.rule_type = 'challenge'
      AND r.is_active = true
  )
);

-- UPDATE: artist owner only (revoke / flag)
CREATE POLICY "Artist updates completions"
ON public.fan_challenge_completions FOR UPDATE
TO authenticated
USING (auth.uid() = artist_user_id);

-- DELETE: artist owner only
CREATE POLICY "Artist deletes completions"
ON public.fan_challenge_completions FOR DELETE
TO authenticated
USING (auth.uid() = artist_user_id);

-- Public unlock counter
CREATE OR REPLACE FUNCTION public.get_challenge_unlock_count(p_track_id UUID)
RETURNS BIGINT
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::BIGINT
  FROM public.fan_challenge_completions
  WHERE track_id = p_track_id
    AND status = 'completed';
$$;

GRANT EXECUTE ON FUNCTION public.get_challenge_unlock_count(UUID) TO anon, authenticated;