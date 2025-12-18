-- Add new columns to posts table for Instagram-style features
ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS location text,
ADD COLUMN IF NOT EXISTS collaborators uuid[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS alt_text text,
ADD COLUMN IF NOT EXISTS comments_enabled boolean DEFAULT true;

-- Create index for collaborators array for efficient querying
CREATE INDEX IF NOT EXISTS idx_posts_collaborators ON public.posts USING GIN(collaborators);

-- Create index for user_id for faster profile queries
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON public.posts(user_id);

-- Create index for created_at for feed ordering
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts(created_at DESC);