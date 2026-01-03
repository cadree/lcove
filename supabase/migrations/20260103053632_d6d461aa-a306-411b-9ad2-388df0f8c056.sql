-- Add post_type column to posts table to distinguish portfolio posts from regular posts
ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS post_type TEXT NOT NULL DEFAULT 'regular';

-- Add index for efficient filtering by post_type
CREATE INDEX IF NOT EXISTS idx_posts_post_type ON public.posts(post_type);