-- Create profile customization table for MySpace-style personalization
CREATE TABLE public.profile_customizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  background_type TEXT DEFAULT 'gradient', -- 'color', 'gradient', 'image'
  background_value TEXT DEFAULT 'from-primary/30 via-background to-accent/20',
  theme_accent_color TEXT DEFAULT NULL, -- custom accent color (HSL)
  profile_music_url TEXT DEFAULT NULL, -- URL to audio file
  profile_music_enabled BOOLEAN DEFAULT false,
  profile_music_title TEXT DEFAULT NULL,
  profile_music_artist TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profile_customizations ENABLE ROW LEVEL SECURITY;

-- Users can view anyone's profile customization (for visiting profiles)
CREATE POLICY "Anyone can view profile customizations"
ON public.profile_customizations
FOR SELECT
USING (true);

-- Users can only insert their own customization
CREATE POLICY "Users can insert their own customization"
ON public.profile_customizations
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can only update their own customization
CREATE POLICY "Users can update their own customization"
ON public.profile_customizations
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can only delete their own customization
CREATE POLICY "Users can delete their own customization"
ON public.profile_customizations
FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_profile_customizations_updated_at
BEFORE UPDATE ON public.profile_customizations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();