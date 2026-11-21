-- Expand content_reports.reason for Cadre's AI rule.
-- Timestamp is 20261020120100 so it does not share 20261020120000 with store_catalog_import.
-- Keeps 'AI-generated or fake content' so rows already stored still pass the check.
-- The app no longer offers that reason.
-- This file is not applied by the app. Apply it in a review environment.
-- Do not run it against the live database from a client or this repo's scripts.

ALTER TABLE public.content_reports DROP CONSTRAINT IF EXISTS content_reports_reason_check;

ALTER TABLE public.content_reports ADD CONSTRAINT content_reports_reason_check
  CHECK (reason IN (
    'Harassment or abuse',
    'Spam',
    'Hate or violence',
    'Sexual content',
    'Scam or fraud',
    'AI-generated or fake content',
    'Fake or AI-generated person',
    'Fully AI-generated scene passed off as real work',
    'AI slop / spam promotion',
    'Plagiarized or stolen work',
    'Other'
  ));
