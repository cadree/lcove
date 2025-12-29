-- Add new notification preference columns for projects and events
ALTER TABLE public.notification_preferences
ADD COLUMN IF NOT EXISTS new_projects_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS new_events_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS application_updates_enabled boolean DEFAULT true;