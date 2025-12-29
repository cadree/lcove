-- Add admin_enabled column to notification_preferences
ALTER TABLE public.notification_preferences 
ADD COLUMN IF NOT EXISTS admin_enabled boolean DEFAULT true;

-- Add comment for documentation
COMMENT ON COLUMN public.notification_preferences.admin_enabled IS 'Whether admin/system notifications are enabled';