-- Update default values for notification_preferences to enable email by default
ALTER TABLE notification_preferences 
  ALTER COLUMN email_enabled SET DEFAULT true,
  ALTER COLUMN push_enabled SET DEFAULT true;

-- Update existing records that have never been touched to enable email
UPDATE notification_preferences 
SET email_enabled = true 
WHERE email_enabled = false 
  AND updated_at = created_at;

-- Ensure new users get a notification_preferences record automatically via trigger
CREATE OR REPLACE FUNCTION public.create_notification_preferences_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notification_preferences (user_id, email_enabled, push_enabled)
  VALUES (NEW.id, true, true)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop existing trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created_notification_prefs ON auth.users;

CREATE TRIGGER on_auth_user_created_notification_prefs
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_notification_preferences_for_new_user();