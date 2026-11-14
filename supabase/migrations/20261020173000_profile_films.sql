-- External film links on a profile. A paid film is still a network subscription.
-- This table only stores the link. The player refuses to load an embed while
-- that network is locked.

CREATE TABLE IF NOT EXISTS public.profile_films (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  title text NOT NULL,
  url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profile_films ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage their films" ON public.profile_films;
CREATE POLICY "Owners manage their films"
ON public.profile_films
FOR ALL
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Anyone can read film links" ON public.profile_films;
CREATE POLICY "Anyone can read film links"
ON public.profile_films
FOR SELECT
TO anon, authenticated
USING (true);
