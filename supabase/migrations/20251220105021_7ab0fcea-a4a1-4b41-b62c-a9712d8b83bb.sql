-- Fix users who completed onboarding but still have pending status
UPDATE profiles
SET 
  access_status = CASE 
    WHEN mindset_level >= 2 THEN 'active'
    WHEN mindset_level = 1 THEN 'denied'
    ELSE 'active'  -- Default to active for users with no mindset_level who completed onboarding
  END,
  mindset_level = COALESCE(mindset_level, 2)  -- Set default mindset level for those who don't have one
WHERE onboarding_completed = true 
  AND (access_status IS NULL OR access_status = 'pending');