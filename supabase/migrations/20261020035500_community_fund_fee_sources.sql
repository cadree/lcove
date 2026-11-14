-- Allow invoice, gift, and project payment fees in the community fund ledger.
ALTER TABLE public.community_fund_fees DROP CONSTRAINT IF EXISTS community_fund_fees_source_type_check;
ALTER TABLE public.community_fund_fees ADD CONSTRAINT community_fund_fees_source_type_check
  CHECK (source_type = ANY (ARRAY['network_subscription'::text, 'studio_booking'::text, 'contact_invoice'::text, 'stream_gift'::text, 'project_payment'::text]));
