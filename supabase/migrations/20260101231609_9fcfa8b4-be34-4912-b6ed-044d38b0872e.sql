-- Create newsletter_signups table
CREATE TABLE public.newsletter_signups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.newsletter_signups ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (public signup)
CREATE POLICY "Anyone can subscribe to newsletter"
ON public.newsletter_signups
FOR INSERT
WITH CHECK (true);

-- Only admins can view signups
CREATE POLICY "Admins can view newsletter signups"
ON public.newsletter_signups
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create creator_applications table
CREATE TABLE public.creator_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  portfolio_url TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.creator_applications ENABLE ROW LEVEL SECURITY;

-- Allow anyone to submit an application
CREATE POLICY "Anyone can submit creator application"
ON public.creator_applications
FOR INSERT
WITH CHECK (true);

-- Only admins can view applications
CREATE POLICY "Admins can view creator applications"
ON public.creator_applications
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update application status
CREATE POLICY "Admins can update creator applications"
ON public.creator_applications
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));