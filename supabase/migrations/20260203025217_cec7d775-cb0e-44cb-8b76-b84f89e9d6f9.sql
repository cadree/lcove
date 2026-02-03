-- Create table to store private calendar feed tokens for hosts
CREATE TABLE public.host_calendar_feeds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_accessed_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Enable RLS
ALTER TABLE public.host_calendar_feeds ENABLE ROW LEVEL SECURITY;

-- Users can only see their own feed tokens
CREATE POLICY "Users can view their own feed tokens"
ON public.host_calendar_feeds
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own feed tokens
CREATE POLICY "Users can create their own feed tokens"
ON public.host_calendar_feeds
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own feed tokens
CREATE POLICY "Users can update their own feed tokens"
ON public.host_calendar_feeds
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own feed tokens
CREATE POLICY "Users can delete their own feed tokens"
ON public.host_calendar_feeds
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for fast token lookups
CREATE INDEX idx_host_calendar_feeds_token ON public.host_calendar_feeds(token) WHERE is_active = true;