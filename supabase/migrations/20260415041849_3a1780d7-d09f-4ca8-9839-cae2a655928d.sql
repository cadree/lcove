-- Exclusive tracks table
CREATE TABLE public.exclusive_tracks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  artist_user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  cover_image_url TEXT,
  audio_file_url TEXT,
  preview_clip_url TEXT,
  duration_seconds INTEGER,
  access_type TEXT NOT NULL DEFAULT 'purchase',
  price_cents INTEGER DEFAULT 0,
  description TEXT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.exclusive_tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published exclusive tracks"
  ON public.exclusive_tracks FOR SELECT
  USING (is_published = true);

CREATE POLICY "Artists can view their own tracks"
  ON public.exclusive_tracks FOR SELECT
  TO authenticated
  USING (artist_user_id = auth.uid());

CREATE POLICY "Artists can insert their own tracks"
  ON public.exclusive_tracks FOR INSERT
  TO authenticated
  WITH CHECK (artist_user_id = auth.uid());

CREATE POLICY "Artists can update their own tracks"
  ON public.exclusive_tracks FOR UPDATE
  TO authenticated
  USING (artist_user_id = auth.uid());

CREATE POLICY "Artists can delete their own tracks"
  ON public.exclusive_tracks FOR DELETE
  TO authenticated
  USING (artist_user_id = auth.uid());

CREATE TRIGGER update_exclusive_tracks_updated_at
  BEFORE UPDATE ON public.exclusive_tracks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Exclusive access rules table
CREATE TABLE public.exclusive_access_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  artist_user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  track_id UUID REFERENCES public.exclusive_tracks(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL DEFAULT 'purchase',
  label TEXT,
  description TEXT,
  amount_cents INTEGER DEFAULT 0,
  interval TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.exclusive_access_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active access rules"
  ON public.exclusive_access_rules FOR SELECT
  USING (is_active = true);

CREATE POLICY "Artists can view their own rules"
  ON public.exclusive_access_rules FOR SELECT
  TO authenticated
  USING (artist_user_id = auth.uid());

CREATE POLICY "Artists can insert their own rules"
  ON public.exclusive_access_rules FOR INSERT
  TO authenticated
  WITH CHECK (artist_user_id = auth.uid());

CREATE POLICY "Artists can update their own rules"
  ON public.exclusive_access_rules FOR UPDATE
  TO authenticated
  USING (artist_user_id = auth.uid());

CREATE POLICY "Artists can delete their own rules"
  ON public.exclusive_access_rules FOR DELETE
  TO authenticated
  USING (artist_user_id = auth.uid());

CREATE TRIGGER update_exclusive_access_rules_updated_at
  BEFORE UPDATE ON public.exclusive_access_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Exclusive track purchases table
CREATE TABLE public.exclusive_track_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  track_id UUID NOT NULL REFERENCES public.exclusive_tracks(id) ON DELETE CASCADE,
  buyer_user_id UUID NOT NULL,
  access_rule_id UUID REFERENCES public.exclusive_access_rules(id) ON DELETE SET NULL,
  stripe_payment_intent_id TEXT,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.exclusive_track_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own purchases"
  ON public.exclusive_track_purchases FOR SELECT
  TO authenticated
  USING (buyer_user_id = auth.uid());

CREATE POLICY "Artists can view purchases of their tracks"
  ON public.exclusive_track_purchases FOR SELECT
  TO authenticated
  USING (
    track_id IN (SELECT id FROM public.exclusive_tracks WHERE artist_user_id = auth.uid())
  );

CREATE POLICY "Service role can insert purchases"
  ON public.exclusive_track_purchases FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Artist subscriptions table
CREATE TABLE public.artist_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  artist_user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  subscriber_user_id UUID NOT NULL,
  stripe_subscription_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  amount_cents INTEGER NOT NULL DEFAULT 0,
  interval TEXT NOT NULL DEFAULT 'monthly',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.artist_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subscriptions"
  ON public.artist_subscriptions FOR SELECT
  TO authenticated
  USING (subscriber_user_id = auth.uid());

CREATE POLICY "Artists can view subscriptions to them"
  ON public.artist_subscriptions FOR SELECT
  TO authenticated
  USING (artist_user_id = auth.uid());

CREATE POLICY "Service role can manage subscriptions"
  ON public.artist_subscriptions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER update_artist_subscriptions_updated_at
  BEFORE UPDATE ON public.artist_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();