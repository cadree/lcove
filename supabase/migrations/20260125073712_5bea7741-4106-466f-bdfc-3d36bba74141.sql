-- Create table for tracking home item usage per user
CREATE TABLE public.home_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  item_id TEXT NOT NULL,
  click_count INTEGER NOT NULL DEFAULT 0,
  last_clicked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, item_id)
);

-- Create table for home preferences
CREATE TABLE public.home_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  auto_reorder BOOLEAN NOT NULL DEFAULT true,
  recent_visits JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.home_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.home_preferences ENABLE ROW LEVEL SECURITY;

-- RLS policies for home_usage
CREATE POLICY "Users can view their own home usage"
ON public.home_usage FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own home usage"
ON public.home_usage FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own home usage"
ON public.home_usage FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own home usage"
ON public.home_usage FOR DELETE
USING (auth.uid() = user_id);

-- RLS policies for home_preferences
CREATE POLICY "Users can view their own home preferences"
ON public.home_preferences FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own home preferences"
ON public.home_preferences FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own home preferences"
ON public.home_preferences FOR UPDATE
USING (auth.uid() = user_id);

-- Create updated_at trigger for both tables
CREATE TRIGGER update_home_usage_updated_at
BEFORE UPDATE ON public.home_usage
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_home_preferences_updated_at
BEFORE UPDATE ON public.home_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();