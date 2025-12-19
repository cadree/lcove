-- Create partner_applications table for partnership submissions
CREATE TABLE public.partner_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  business_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('studio', 'venue', 'cafe', 'housing', 'equipment', 'transport', 'service', 'other')),
  description TEXT NOT NULL,
  contribution TEXT NOT NULL,
  member_benefits TEXT NOT NULL,
  website_url TEXT,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  city TEXT NOT NULL,
  state TEXT,
  country TEXT NOT NULL,
  address TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.partner_applications ENABLE ROW LEVEL SECURITY;

-- Users can view their own applications
CREATE POLICY "Users can view own applications"
ON public.partner_applications
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create applications
CREATE POLICY "Users can create applications"
ON public.partner_applications
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Admins can view all applications
CREATE POLICY "Admins can view all applications"
ON public.partner_applications
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update applications
CREATE POLICY "Admins can update applications"
ON public.partner_applications
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Create trigger for updated_at
CREATE TRIGGER update_partner_applications_updated_at
BEFORE UPDATE ON public.partner_applications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Prevent duplicate pending applications from same user
CREATE UNIQUE INDEX unique_pending_application_per_user 
ON public.partner_applications (user_id) 
WHERE status = 'pending';