-- Add Peerspace integration column to stores table
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS peerspace_url text;