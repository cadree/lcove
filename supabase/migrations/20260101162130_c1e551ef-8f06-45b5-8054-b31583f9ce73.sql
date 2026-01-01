-- Add additional_parties column to store multiple parties as JSON array
ALTER TABLE public.contact_contracts 
ADD COLUMN additional_parties jsonb DEFAULT '[]'::jsonb;

-- Add comment explaining the structure
COMMENT ON COLUMN public.contact_contracts.additional_parties IS 'Array of additional parties: [{name, role, address, email, phone}]';