-- Create favorite_friends table for story filtering
CREATE TABLE public.favorite_friends (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  friend_user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, friend_user_id)
);

-- Enable RLS
ALTER TABLE public.favorite_friends ENABLE ROW LEVEL SECURITY;

-- Users can view their own favorites
CREATE POLICY "Users can view own favorites"
ON public.favorite_friends
FOR SELECT
USING (auth.uid() = user_id);

-- Users can add favorites
CREATE POLICY "Users can add favorites"
ON public.favorite_friends
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can remove favorites
CREATE POLICY "Users can remove favorites"
ON public.favorite_friends
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for fast lookups
CREATE INDEX idx_favorite_friends_user_id ON public.favorite_friends(user_id);

-- Enable realtime for story_views to fix view count updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.story_views;