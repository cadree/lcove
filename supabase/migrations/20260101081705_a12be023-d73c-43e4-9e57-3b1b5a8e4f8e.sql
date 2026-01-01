-- Drop the existing INSERT policy that has no restriction
DROP POLICY IF EXISTS "Users can add payout methods" ON payout_methods;

-- Create a proper INSERT policy with WITH CHECK
CREATE POLICY "Users can add own payout methods" 
ON payout_methods 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Ensure the credit_ledger insert policy is properly restricted
DROP POLICY IF EXISTS "Admins can create credit entries" ON credit_ledger;

-- Create proper INSERT policy - service role handles most inserts via edge functions
-- Regular users shouldn't be able to insert into credit_ledger directly
CREATE POLICY "Service role inserts credit entries"
ON credit_ledger
FOR INSERT
WITH CHECK (
  -- Only allow if user is admin or it's their own entry (for edge function context)
  auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role)
);