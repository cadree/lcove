-- Create table for music profiles (Spotify & Apple Music integration)
CREATE TABLE public.music_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  spotify_artist_id TEXT,
  spotify_artist_url TEXT,
  apple_music_artist_id TEXT,
  apple_music_artist_url TEXT,
  display_name TEXT,
  artist_image_url TEXT,
  genres TEXT[],
  top_tracks JSONB DEFAULT '[]'::jsonb,
  albums JSONB DEFAULT '[]'::jsonb,
  latest_release JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.music_profiles ENABLE ROW LEVEL SECURITY;

-- Public can view music profiles
CREATE POLICY "Music profiles are viewable by everyone"
ON public.music_profiles
FOR SELECT
USING (true);

-- Users can manage their own music profile
CREATE POLICY "Users can insert their own music profile"
ON public.music_profiles
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own music profile"
ON public.music_profiles
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own music profile"
ON public.music_profiles
FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_music_profiles_updated_at
BEFORE UPDATE ON public.music_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();