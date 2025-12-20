-- Create admin_announcements table
CREATE TABLE public.admin_announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  target_audience JSONB NOT NULL DEFAULT '{"type": "all"}'::jsonb,
  sent_by UUID NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  recipient_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_announcements ENABLE ROW LEVEL SECURITY;

-- Only admins can view announcements
CREATE POLICY "Admins can view announcements"
ON public.admin_announcements
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can create announcements
CREATE POLICY "Admins can create announcements"
ON public.admin_announcements
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create function to get user emails safely (admin only)
CREATE OR REPLACE FUNCTION public.get_user_emails_for_admin()
RETURNS TABLE (
  user_id UUID,
  email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow admins to call this function
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;
  
  RETURN QUERY
  SELECT au.id as user_id, au.email::text
  FROM auth.users au;
END;
$$;

-- Create function to get all user data for admin dashboard
CREATE OR REPLACE FUNCTION public.get_admin_user_data()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  display_name TEXT,
  phone TEXT,
  city TEXT,
  mindset_level INTEGER,
  access_status TEXT,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow admins to call this function
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;
  
  RETURN QUERY
  SELECT 
    p.user_id,
    au.email::text,
    p.display_name,
    p.phone,
    p.city,
    p.mindset_level,
    p.access_status,
    p.created_at
  FROM public.profiles p
  LEFT JOIN auth.users au ON au.id = p.user_id;
END;
$$;