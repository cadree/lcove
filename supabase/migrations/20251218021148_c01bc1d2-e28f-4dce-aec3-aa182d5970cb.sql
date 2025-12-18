-- Create memberships table to track member status
CREATE TABLE public.memberships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('community', 'elite')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'past_due', 'trialing')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  monthly_amount NUMERIC DEFAULT 5,
  lifetime_contribution NUMERIC DEFAULT 0,
  grant_eligible BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Create membership contributions table for fund tracking
CREATE TABLE public.membership_contributions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  membership_id UUID REFERENCES public.memberships(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL,
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  stripe_invoice_id TEXT,
  allocated_to JSONB DEFAULT '{"grants": 0.4, "events": 0.2, "education": 0.15, "infrastructure": 0.15, "operations": 0.1}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_contributions ENABLE ROW LEVEL SECURITY;

-- Membership policies
CREATE POLICY "Users can view own membership"
ON public.memberships FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can manage memberships"
ON public.memberships FOR ALL
USING (true);

-- Contribution policies
CREATE POLICY "Users can view own contributions"
ON public.membership_contributions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can manage contributions"
ON public.membership_contributions FOR ALL
USING (true);

-- Indexes
CREATE INDEX idx_memberships_user ON public.memberships(user_id);
CREATE INDEX idx_memberships_status ON public.memberships(status);
CREATE INDEX idx_memberships_tier ON public.memberships(tier);
CREATE INDEX idx_contributions_user ON public.membership_contributions(user_id);
CREATE INDEX idx_contributions_period ON public.membership_contributions(period_start, period_end);

-- Trigger for updated_at
CREATE TRIGGER update_memberships_updated_at
BEFORE UPDATE ON public.memberships
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();