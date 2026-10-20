-- External film links on a profile. Paid URLs stay null until a Stripe TEST
-- checkout writes an unlock. The list function is the only public read.

CREATE TABLE IF NOT EXISTS public.profile_films (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  title text NOT NULL,
  url text NOT NULL,
  price_cents integer NOT NULL DEFAULT 0 CHECK (price_cents >= 0 AND price_cents <= 500000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profile_film_unlocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  film_id uuid NOT NULL REFERENCES public.profile_films(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  stripe_session_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (film_id, user_id),
  UNIQUE (stripe_session_id)
);

ALTER TABLE public.profile_films ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_film_unlocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage their films" ON public.profile_films;
CREATE POLICY "Owners manage their films"
ON public.profile_films
FOR ALL
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Viewers read their unlocks" ON public.profile_film_unlocks;
CREATE POLICY "Viewers read their unlocks"
ON public.profile_film_unlocks
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.list_profile_films(p_owner uuid)
RETURNS TABLE (
  id uuid,
  title text,
  price_cents integer,
  locked boolean,
  url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    f.id,
    f.title,
    f.price_cents,
    CASE
      WHEN auth.uid() = f.owner_id THEN false
      WHEN f.price_cents = 0 THEN false
      WHEN EXISTS (
        SELECT 1 FROM public.profile_film_unlocks u
        WHERE u.film_id = f.id AND u.user_id = auth.uid()
      ) THEN false
      ELSE true
    END AS locked,
    CASE
      WHEN auth.uid() = f.owner_id OR f.price_cents = 0 OR EXISTS (
        SELECT 1 FROM public.profile_film_unlocks u
        WHERE u.film_id = f.id AND u.user_id = auth.uid()
      ) THEN f.url
      ELSE NULL
    END AS url
  FROM public.profile_films f
  WHERE f.owner_id = p_owner
  ORDER BY f.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.list_profile_films(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_profile_films(uuid) TO anon, authenticated;
