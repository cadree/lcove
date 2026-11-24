-- Widen community_fund_fees.source_type.
-- Production already has this check from a manual change, so this file
-- drops and recreates it. A second run ends on the same definition.
-- Not applied by the app. Apply it on a staging copy first.

ALTER TABLE public.community_fund_fees
  DROP CONSTRAINT IF EXISTS community_fund_fees_source_type_check;

ALTER TABLE public.community_fund_fees
  ADD CONSTRAINT community_fund_fees_source_type_check
  CHECK (source_type IN (
    'network_subscription',
    'studio_booking',
    'contact_invoice',
    'stream_gift',
    'project_payment'
  ));
