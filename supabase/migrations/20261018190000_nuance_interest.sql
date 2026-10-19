-- Interest list for Nuance by LCOVE.
-- This file is not applied by the app. Apply it in a review environment.

CREATE TABLE public.nuance_interest (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  item text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nuance_interest_email_item_key UNIQUE (email, item),
  CONSTRAINT nuance_interest_email_check
    CHECK (email ~* '^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$'),
  CONSTRAINT nuance_interest_item_check
    CHECK (item = 'gold-legacy-necklace')
);

CREATE OR REPLACE FUNCTION public.nuance_interest_normalize()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.email := lower(trim(NEW.email));
  NEW.item := lower(trim(NEW.item));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS nuance_interest_normalize ON public.nuance_interest;
CREATE TRIGGER nuance_interest_normalize
  BEFORE INSERT OR UPDATE ON public.nuance_interest
  FOR EACH ROW
  EXECUTE FUNCTION public.nuance_interest_normalize();

ALTER TABLE public.nuance_interest ENABLE ROW LEVEL SECURITY;

-- Guests insert the email they type. Signed-in members can insert only
-- the email on their account. Nobody can read the list except admins.
CREATE POLICY "Anyone can insert their own nuance interest"
  ON public.nuance_interest
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    auth.uid() IS NULL
    OR lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

CREATE POLICY "Admins can read nuance interest"
  ON public.nuance_interest
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

REVOKE ALL ON TABLE public.nuance_interest FROM PUBLIC;
REVOKE ALL ON TABLE public.nuance_interest FROM anon, authenticated;
GRANT INSERT ON TABLE public.nuance_interest TO anon, authenticated;
GRANT SELECT ON TABLE public.nuance_interest TO authenticated;
