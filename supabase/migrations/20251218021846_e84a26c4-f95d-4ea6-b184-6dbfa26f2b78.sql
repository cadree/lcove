-- Create live streams table for DJ sets
CREATE TABLE public.live_streams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  host_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  stream_type TEXT NOT NULL CHECK (stream_type IN ('webrtc', 'youtube', 'twitch', 'soundcloud')),
  external_url TEXT, -- For YouTube/Twitch/SoundCloud embeds
  thumbnail_url TEXT,
  is_live BOOLEAN DEFAULT false,
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  viewer_count INTEGER DEFAULT 0,
  total_tips INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create stream viewers table
CREATE TABLE public.stream_viewers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stream_id UUID NOT NULL REFERENCES public.live_streams(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  left_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(stream_id, viewer_id)
);

-- Create stream reactions table
CREATE TABLE public.stream_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stream_id UUID NOT NULL REFERENCES public.live_streams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create stream tips table
CREATE TABLE public.stream_tips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stream_id UUID NOT NULL REFERENCES public.live_streams(id) ON DELETE CASCADE,
  tipper_id UUID NOT NULL,
  host_id UUID NOT NULL,
  amount INTEGER NOT NULL,
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create studio bookings table
CREATE TABLE public.studio_bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES public.store_items(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL,
  owner_id UUID NOT NULL,
  requested_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  duration_hours INTEGER,
  total_price NUMERIC,
  credits_spent INTEGER DEFAULT 0,
  payment_type TEXT CHECK (payment_type IN ('cash', 'credits', 'hybrid')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'cancelled')),
  message TEXT,
  owner_notes TEXT,
  stripe_payment_intent_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create studio reviews table
CREATE TABLE public.studio_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES public.store_items(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.studio_bookings(id) ON DELETE SET NULL,
  reviewer_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(booking_id)
);

-- Enable RLS
ALTER TABLE public.live_streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stream_viewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stream_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stream_tips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_reviews ENABLE ROW LEVEL SECURITY;

-- Live streams policies
CREATE POLICY "Anyone can view live streams" ON public.live_streams
  FOR SELECT USING (true);

CREATE POLICY "Users can create streams" ON public.live_streams
  FOR INSERT WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Hosts can update own streams" ON public.live_streams
  FOR UPDATE USING (auth.uid() = host_id);

CREATE POLICY "Hosts can delete own streams" ON public.live_streams
  FOR DELETE USING (auth.uid() = host_id);

-- Stream viewers policies
CREATE POLICY "Anyone can view stream viewers" ON public.stream_viewers
  FOR SELECT USING (true);

CREATE POLICY "Users can join streams" ON public.stream_viewers
  FOR INSERT WITH CHECK (auth.uid() = viewer_id);

CREATE POLICY "Users can leave streams" ON public.stream_viewers
  FOR UPDATE USING (auth.uid() = viewer_id);

-- Stream reactions policies
CREATE POLICY "Anyone can view reactions" ON public.stream_reactions
  FOR SELECT USING (true);

CREATE POLICY "Users can react" ON public.stream_reactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Stream tips policies
CREATE POLICY "Users can view own tips" ON public.stream_tips
  FOR SELECT USING (auth.uid() = tipper_id OR auth.uid() = host_id);

CREATE POLICY "Users can tip" ON public.stream_tips
  FOR INSERT WITH CHECK (auth.uid() = tipper_id);

-- Studio bookings policies
CREATE POLICY "Users can view own bookings" ON public.studio_bookings
  FOR SELECT USING (auth.uid() = requester_id OR auth.uid() = owner_id);

CREATE POLICY "Users can request bookings" ON public.studio_bookings
  FOR INSERT WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Owners can update bookings" ON public.studio_bookings
  FOR UPDATE USING (auth.uid() = owner_id OR (auth.uid() = requester_id AND status = 'pending'));

-- Studio reviews policies
CREATE POLICY "Anyone can view reviews" ON public.studio_reviews
  FOR SELECT USING (true);

CREATE POLICY "Users can review after booking" ON public.studio_reviews
  FOR INSERT WITH CHECK (
    auth.uid() = reviewer_id AND
    EXISTS (
      SELECT 1 FROM public.studio_bookings b
      WHERE b.id = booking_id AND b.requester_id = auth.uid() AND b.status = 'completed'
    )
  );

-- Indexes
CREATE INDEX idx_live_streams_host ON public.live_streams(host_id);
CREATE INDEX idx_live_streams_live ON public.live_streams(is_live) WHERE is_live = true;
CREATE INDEX idx_stream_viewers_stream ON public.stream_viewers(stream_id);
CREATE INDEX idx_stream_tips_stream ON public.stream_tips(stream_id);
CREATE INDEX idx_studio_bookings_item ON public.studio_bookings(item_id);
CREATE INDEX idx_studio_bookings_requester ON public.studio_bookings(requester_id);
CREATE INDEX idx_studio_reviews_item ON public.studio_reviews(item_id);

-- Enable realtime for live streams
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_streams;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stream_reactions;

-- Trigger for updated_at
CREATE TRIGGER update_studio_bookings_updated_at
  BEFORE UPDATE ON public.studio_bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();