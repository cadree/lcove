-- Add sms_enabled column to notification_preferences
ALTER TABLE public.notification_preferences 
ADD COLUMN IF NOT EXISTS sms_enabled boolean DEFAULT false;

-- Update default email_enabled to true for better initial engagement
ALTER TABLE public.notification_preferences 
ALTER COLUMN email_enabled SET DEFAULT true;