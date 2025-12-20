-- Add missing columns to profiles table for admin review
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS access_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS mindset_level integer;