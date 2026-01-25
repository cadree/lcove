-- Create fund_distributions table to track real allocation data
CREATE TABLE public.fund_distributions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('community_grants', 'events_activations', 'education', 'infrastructure', 'operations')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  title TEXT NOT NULL,
  description TEXT,
  recipient_name TEXT,
  recipient_id UUID REFERENCES auth.users(id),
  proof_url TEXT,
  distributed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fund_distributions ENABLE ROW LEVEL SECURITY;

-- Everyone can view distributions (transparency)
CREATE POLICY "Fund distributions are viewable by everyone"
ON public.fund_distributions
FOR SELECT
USING (true);

-- Only admins can manage fund distributions
CREATE POLICY "Admins can insert fund distributions"
ON public.fund_distributions
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update fund distributions"
ON public.fund_distributions
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete fund distributions"
ON public.fund_distributions
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster queries
CREATE INDEX idx_fund_distributions_category ON public.fund_distributions(category);
CREATE INDEX idx_fund_distributions_distributed_at ON public.fund_distributions(distributed_at);

-- Add trigger for updated_at
CREATE TRIGGER update_fund_distributions_updated_at
BEFORE UPDATE ON public.fund_distributions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.fund_distributions;