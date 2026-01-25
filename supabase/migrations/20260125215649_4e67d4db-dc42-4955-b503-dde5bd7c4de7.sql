-- Add Stripe Connect fields to stores table
ALTER TABLE public.stores
ADD COLUMN IF NOT EXISTS stripe_connect_account_id TEXT,
ADD COLUMN IF NOT EXISTS payout_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS payout_method TEXT DEFAULT 'stripe';

-- Add revenue tracking to store_orders
ALTER TABLE public.store_orders
ADD COLUMN IF NOT EXISTS seller_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS platform_fee NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS seller_payout_status TEXT DEFAULT 'pending';

-- Add revenue tracking to studio_bookings
ALTER TABLE public.studio_bookings
ADD COLUMN IF NOT EXISTS seller_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS platform_fee NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS seller_payout_status TEXT DEFAULT 'pending';

-- Create platform treasury table to track platform earnings
CREATE TABLE IF NOT EXISTS public.platform_treasury (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_type TEXT NOT NULL, -- 'store_order', 'studio_booking', 'network_subscription'
  source_id UUID NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  credits_amount INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on platform_treasury
ALTER TABLE public.platform_treasury ENABLE ROW LEVEL SECURITY;

-- Only admins can view platform treasury
CREATE POLICY "Admins can view platform treasury" 
ON public.platform_treasury 
FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'));

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_platform_treasury_source 
ON public.platform_treasury(source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_platform_treasury_created 
ON public.platform_treasury(created_at DESC);