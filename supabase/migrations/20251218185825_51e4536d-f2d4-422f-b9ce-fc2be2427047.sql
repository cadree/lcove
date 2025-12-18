-- Create enum for content types
CREATE TYPE public.network_content_type AS ENUM ('short_film', 'feature_film', 'tv_show');

-- Create enum for submission status
CREATE TYPE public.submission_status AS ENUM ('pending', 'approved', 'rejected');

-- Create networks table (channels owned by creators)
CREATE TABLE public.networks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  banner_url TEXT,
  logo_url TEXT,
  is_paid BOOLEAN NOT NULL DEFAULT false,
  subscription_price NUMERIC DEFAULT 0,
  stripe_product_id TEXT,
  stripe_price_id TEXT,
  is_public BOOLEAN NOT NULL DEFAULT true,
  genre TEXT,
  subscriber_count INTEGER DEFAULT 0,
  total_views INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create content genres table
CREATE TABLE public.content_genres (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create network content table (films, shows, movies)
CREATE TABLE public.network_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  network_id UUID NOT NULL REFERENCES public.networks(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  cover_art_url TEXT,
  trailer_url TEXT,
  content_type network_content_type NOT NULL,
  runtime_minutes INTEGER,
  video_url TEXT,
  external_video_url TEXT,
  director TEXT,
  cast_members TEXT[],
  credits JSONB DEFAULT '{}',
  genre_tags TEXT[],
  is_featured BOOLEAN DEFAULT false,
  view_count INTEGER DEFAULT 0,
  release_date DATE,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create TV seasons table
CREATE TABLE public.tv_seasons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content_id UUID NOT NULL REFERENCES public.network_content(id) ON DELETE CASCADE,
  season_number INTEGER NOT NULL,
  title TEXT,
  description TEXT,
  cover_art_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(content_id, season_number)
);

-- Create TV episodes table
CREATE TABLE public.tv_episodes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  season_id UUID NOT NULL REFERENCES public.tv_seasons(id) ON DELETE CASCADE,
  episode_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  video_url TEXT,
  external_video_url TEXT,
  runtime_minutes INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(season_id, episode_number)
);

-- Create content submissions table
CREATE TABLE public.content_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  network_id UUID NOT NULL REFERENCES public.networks(id) ON DELETE CASCADE,
  submitter_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  content_type network_content_type NOT NULL,
  cover_art_url TEXT,
  trailer_url TEXT,
  video_url TEXT,
  external_video_url TEXT,
  runtime_minutes INTEGER,
  director TEXT,
  cast_members TEXT[],
  credits JSONB DEFAULT '{}',
  pitch_notes TEXT,
  status submission_status NOT NULL DEFAULT 'pending',
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create network subscriptions table
CREATE TABLE public.network_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  network_id UUID NOT NULL REFERENCES public.networks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  stripe_subscription_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(network_id, user_id)
);

-- Create watch history table
CREATE TABLE public.watch_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  content_id UUID REFERENCES public.network_content(id) ON DELETE CASCADE,
  episode_id UUID REFERENCES public.tv_episodes(id) ON DELETE CASCADE,
  progress_seconds INTEGER DEFAULT 0,
  duration_seconds INTEGER,
  completed BOOLEAN DEFAULT false,
  last_watched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, content_id, episode_id)
);

-- Enable RLS on all tables
ALTER TABLE public.networks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_genres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.network_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tv_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tv_episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.network_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watch_history ENABLE ROW LEVEL SECURITY;

-- Networks policies
CREATE POLICY "Anyone can view public networks" ON public.networks
  FOR SELECT USING (is_public = true);

CREATE POLICY "Owners can view own networks" ON public.networks
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Authenticated users can create networks" ON public.networks
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update own networks" ON public.networks
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Owners can delete own networks" ON public.networks
  FOR DELETE USING (auth.uid() = owner_id);

-- Content genres policies
CREATE POLICY "Anyone can view genres" ON public.content_genres
  FOR SELECT USING (true);

-- Network content policies
CREATE POLICY "Anyone can view published content on public networks" ON public.network_content
  FOR SELECT USING (
    is_published = true AND 
    EXISTS (SELECT 1 FROM public.networks WHERE id = network_id AND is_public = true)
  );

CREATE POLICY "Network owners can manage content" ON public.network_content
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.networks WHERE id = network_id AND owner_id = auth.uid())
  );

CREATE POLICY "Content creators can view own content" ON public.network_content
  FOR SELECT USING (auth.uid() = creator_id);

-- TV seasons policies
CREATE POLICY "Anyone can view seasons of published content" ON public.tv_seasons
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.network_content nc 
      JOIN public.networks n ON nc.network_id = n.id 
      WHERE nc.id = content_id AND nc.is_published = true AND n.is_public = true
    )
  );

CREATE POLICY "Network owners can manage seasons" ON public.tv_seasons
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.network_content nc 
      JOIN public.networks n ON nc.network_id = n.id 
      WHERE nc.id = content_id AND n.owner_id = auth.uid()
    )
  );

-- TV episodes policies
CREATE POLICY "Anyone can view episodes of published content" ON public.tv_episodes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tv_seasons s
      JOIN public.network_content nc ON s.content_id = nc.id
      JOIN public.networks n ON nc.network_id = n.id
      WHERE s.id = season_id AND nc.is_published = true AND n.is_public = true
    )
  );

CREATE POLICY "Network owners can manage episodes" ON public.tv_episodes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.tv_seasons s
      JOIN public.network_content nc ON s.content_id = nc.id
      JOIN public.networks n ON nc.network_id = n.id
      WHERE s.id = season_id AND n.owner_id = auth.uid()
    )
  );

-- Content submissions policies
CREATE POLICY "Submitters can view own submissions" ON public.content_submissions
  FOR SELECT USING (auth.uid() = submitter_id);

CREATE POLICY "Network owners can view submissions" ON public.content_submissions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.networks WHERE id = network_id AND owner_id = auth.uid())
  );

CREATE POLICY "Authenticated users can submit content" ON public.content_submissions
  FOR INSERT WITH CHECK (auth.uid() = submitter_id);

CREATE POLICY "Network owners can update submissions" ON public.content_submissions
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.networks WHERE id = network_id AND owner_id = auth.uid())
  );

-- Network subscriptions policies
CREATE POLICY "Users can view own subscriptions" ON public.network_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Network owners can view their subscribers" ON public.network_subscriptions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.networks WHERE id = network_id AND owner_id = auth.uid())
  );

CREATE POLICY "Users can subscribe to networks" ON public.network_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can manage subscriptions" ON public.network_subscriptions
  FOR ALL USING (true);

-- Watch history policies
CREATE POLICY "Users can view own watch history" ON public.watch_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own watch history" ON public.watch_history
  FOR ALL USING (auth.uid() = user_id);

-- Insert default genres
INSERT INTO public.content_genres (name) VALUES
  ('Drama'),
  ('Comedy'),
  ('Action'),
  ('Horror'),
  ('Thriller'),
  ('Sci-Fi'),
  ('Fantasy'),
  ('Documentary'),
  ('Romance'),
  ('Animation'),
  ('Indie'),
  ('Experimental'),
  ('Music'),
  ('Sports'),
  ('Biography');

-- Create indexes for performance
CREATE INDEX idx_network_content_network ON public.network_content(network_id);
CREATE INDEX idx_network_content_type ON public.network_content(content_type);
CREATE INDEX idx_tv_seasons_content ON public.tv_seasons(content_id);
CREATE INDEX idx_tv_episodes_season ON public.tv_episodes(season_id);
CREATE INDEX idx_watch_history_user ON public.watch_history(user_id);
CREATE INDEX idx_network_subscriptions_user ON public.network_subscriptions(user_id);
CREATE INDEX idx_content_submissions_network ON public.content_submissions(network_id);

-- Add updated_at trigger for networks
CREATE TRIGGER update_networks_updated_at
  BEFORE UPDATE ON public.networks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add updated_at trigger for network_content
CREATE TRIGGER update_network_content_updated_at
  BEFORE UPDATE ON public.network_content
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add updated_at trigger for network_subscriptions
CREATE TRIGGER update_network_subscriptions_updated_at
  BEFORE UPDATE ON public.network_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();