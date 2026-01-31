-- Add owner_user_id and location columns to brand_partnerships
ALTER TABLE public.brand_partnerships 
ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS application_id UUID REFERENCES public.partner_applications(id),
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS country TEXT,
ADD COLUMN IF NOT EXISTS gallery_images TEXT[];

-- Drop existing policies if any to avoid conflicts
DROP POLICY IF EXISTS "Partners can update own partnership" ON public.brand_partnerships;
DROP POLICY IF EXISTS "Partners can view own partnership" ON public.brand_partnerships;
DROP POLICY IF EXISTS "Admins can manage partnerships" ON public.brand_partnerships;
DROP POLICY IF EXISTS "Anyone can view active partnerships" ON public.brand_partnerships;

-- Enable RLS
ALTER TABLE public.brand_partnerships ENABLE ROW LEVEL SECURITY;

-- Public can view active partnerships
CREATE POLICY "Anyone can view active partnerships"
ON public.brand_partnerships
FOR SELECT
USING (is_active = true);

-- Partners can view and update their own partnership
CREATE POLICY "Partners can view own partnership"
ON public.brand_partnerships
FOR SELECT
USING (auth.uid() = owner_user_id);

CREATE POLICY "Partners can update own partnership"
ON public.brand_partnerships
FOR UPDATE
USING (auth.uid() = owner_user_id);

-- Admins can do everything
CREATE POLICY "Admins can manage partnerships"
ON public.brand_partnerships
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Add RLS to partner_applications if not exists
ALTER TABLE public.partner_applications ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies to ensure they're correct
DROP POLICY IF EXISTS "Users can view own applications" ON public.partner_applications;
DROP POLICY IF EXISTS "Users can create applications" ON public.partner_applications;
DROP POLICY IF EXISTS "Admins can view all applications" ON public.partner_applications;
DROP POLICY IF EXISTS "Admins can update applications" ON public.partner_applications;

CREATE POLICY "Users can view own applications"
ON public.partner_applications
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create applications"
ON public.partner_applications
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all applications"
ON public.partner_applications
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update applications"
ON public.partner_applications
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::app_role));