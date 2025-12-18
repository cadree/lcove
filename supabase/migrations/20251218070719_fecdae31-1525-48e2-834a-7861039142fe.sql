-- Create blog_posts table for long-form content
CREATE TABLE public.blog_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  cover_image_url TEXT,
  excerpt TEXT,
  is_published BOOLEAN DEFAULT false,
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view published blogs" 
ON public.blog_posts 
FOR SELECT 
USING (is_published = true);

CREATE POLICY "Users can view own blogs" 
ON public.blog_posts 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own blogs" 
ON public.blog_posts 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own blogs" 
ON public.blog_posts 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own blogs" 
ON public.blog_posts 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create index for user_id
CREATE INDEX idx_blog_posts_user_id ON public.blog_posts(user_id);

-- Create index for published blogs
CREATE INDEX idx_blog_posts_published ON public.blog_posts(is_published, published_at DESC);