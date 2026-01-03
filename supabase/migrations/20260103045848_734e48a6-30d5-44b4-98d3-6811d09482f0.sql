-- Create a table for platform reviews (testimonials from real users about Ether)
CREATE TABLE public.platform_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  content TEXT NOT NULL,
  is_approved BOOLEAN NOT NULL DEFAULT false,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.platform_reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can view approved reviews
CREATE POLICY "Anyone can view approved platform reviews"
ON public.platform_reviews
FOR SELECT
USING (is_approved = true);

-- Authenticated users can create reviews
CREATE POLICY "Authenticated users can create platform reviews"
ON public.platform_reviews
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can view their own reviews (even unapproved)
CREATE POLICY "Users can view own platform reviews"
ON public.platform_reviews
FOR SELECT
USING (auth.uid() = user_id);

-- Users can update their own reviews
CREATE POLICY "Users can update own platform reviews"
ON public.platform_reviews
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own reviews
CREATE POLICY "Users can delete own platform reviews"
ON public.platform_reviews
FOR DELETE
USING (auth.uid() = user_id);

-- Admins can manage all reviews
CREATE POLICY "Admins can manage platform reviews"
ON public.platform_reviews
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster approved reviews lookup
CREATE INDEX idx_platform_reviews_approved ON public.platform_reviews(is_approved, is_featured);

-- Create trigger for updated_at
CREATE TRIGGER update_platform_reviews_updated_at
BEFORE UPDATE ON public.platform_reviews
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();