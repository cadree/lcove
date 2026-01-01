-- Create contact_contracts table for storing contracts
CREATE TABLE public.contact_contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pipeline_item_id UUID NOT NULL REFERENCES public.pipeline_items(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL,
  contract_number TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'signed', 'completed', 'cancelled')),
  
  -- Parties Involved
  provider_name TEXT,
  provider_address TEXT,
  provider_email TEXT,
  provider_phone TEXT,
  client_name TEXT,
  client_address TEXT,
  client_email TEXT,
  client_phone TEXT,
  
  -- Scope of Work
  scope_description TEXT,
  deliverables TEXT,
  timeline_milestones TEXT,
  exclusions TEXT,
  revisions_included INTEGER DEFAULT 2,
  revision_cost NUMERIC(10,2),
  
  -- Payment Terms
  total_price NUMERIC(10,2),
  payment_type TEXT CHECK (payment_type IN ('flat_fee', 'hourly', 'retainer', 'milestone')),
  payment_schedule TEXT,
  payment_methods TEXT,
  late_fee_percentage NUMERIC(5,2),
  refund_policy TEXT,
  
  -- Timeline
  project_start_date DATE,
  estimated_completion_date DATE,
  client_responsibilities TEXT,
  
  -- Ownership & IP
  ownership_before_payment TEXT DEFAULT 'Provider retains ownership until paid in full',
  ownership_after_payment TEXT DEFAULT 'Client receives full rights after payment',
  portfolio_rights BOOLEAN DEFAULT true,
  
  -- Confidentiality
  confidentiality_enabled BOOLEAN DEFAULT false,
  confidentiality_duration TEXT,
  confidentiality_terms TEXT,
  
  -- Termination
  termination_notice_days INTEGER DEFAULT 14,
  termination_terms TEXT,
  early_termination_fee NUMERIC(10,2),
  
  -- Legal
  limitation_of_liability TEXT,
  indemnification_terms TEXT,
  governing_law_state TEXT,
  governing_law_country TEXT DEFAULT 'USA',
  
  -- Force Majeure
  force_majeure_enabled BOOLEAN DEFAULT false,
  force_majeure_terms TEXT,
  
  -- Signatures
  provider_signature_url TEXT,
  provider_signed_at TIMESTAMPTZ,
  client_signature_url TEXT,
  client_signed_at TIMESTAMPTZ,
  
  -- Sending/Delivery
  sent_at TIMESTAMPTZ,
  sent_via TEXT CHECK (sent_via IN ('email', 'sms')),
  recipient_email TEXT,
  recipient_phone TEXT,
  
  -- PDF
  pdf_url TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contact_contracts ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own contracts"
ON public.contact_contracts FOR SELECT
USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can create their own contracts"
ON public.contact_contracts FOR INSERT
WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Users can update their own contracts"
ON public.contact_contracts FOR UPDATE
USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can delete their own contracts"
ON public.contact_contracts FOR DELETE
USING (auth.uid() = owner_user_id);

-- Public policy for clients to sign contracts via a token (they don't need to be logged in)
CREATE POLICY "Anyone can view contracts by id for signing"
ON public.contact_contracts FOR SELECT
USING (true);

CREATE POLICY "Anyone can update signature fields on contracts"
ON public.contact_contracts FOR UPDATE
USING (true)
WITH CHECK (
  -- Only allow updating signature fields
  client_signature_url IS NOT NULL OR client_signed_at IS NOT NULL
);

-- Index for faster queries
CREATE INDEX idx_contact_contracts_pipeline_item ON public.contact_contracts(pipeline_item_id);
CREATE INDEX idx_contact_contracts_owner ON public.contact_contracts(owner_user_id);

-- Trigger for updated_at
CREATE TRIGGER update_contact_contracts_updated_at
BEFORE UPDATE ON public.contact_contracts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();