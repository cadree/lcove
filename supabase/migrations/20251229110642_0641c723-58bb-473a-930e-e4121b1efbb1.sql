-- Drop the old check constraint
ALTER TABLE public.admin_actions DROP CONSTRAINT IF EXISTS admin_actions_action_type_check;

-- Add the updated check constraint with all action types
ALTER TABLE public.admin_actions 
ADD CONSTRAINT admin_actions_action_type_check 
CHECK (action_type = ANY (ARRAY[
  'suspend'::text, 
  'unsuspend'::text, 
  'warn'::text, 
  'remove'::text, 
  'approve_onboarding'::text, 
  'deny_onboarding'::text, 
  'override'::text,
  'change_status_active'::text,
  'change_status_denied'::text,
  'change_status_banned'::text,
  'remove_user'::text,
  'adjust_credits'::text,
  'toggle_admin'::text,
  'bulk_award_credits'::text
]));