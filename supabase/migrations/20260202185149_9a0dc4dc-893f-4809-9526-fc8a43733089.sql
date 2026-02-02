-- Create function to safely increment stream tips (avoids race conditions)
CREATE OR REPLACE FUNCTION public.increment_stream_tips(p_stream_id UUID, p_tip_amount INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE live_streams 
  SET total_tips = COALESCE(total_tips, 0) + p_tip_amount
  WHERE id = p_stream_id;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public;

-- Fix overly permissive transactions policy
-- Drop the "System can manage transactions" policy that uses USING (true)
DROP POLICY IF EXISTS "System can manage transactions" ON public.transactions;

-- Create proper RLS policies for transactions
-- Only the user can view their own transactions
CREATE POLICY "Users can insert own transactions"
ON public.transactions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Only allow updates by owner
CREATE POLICY "Users can update own transactions"
ON public.transactions
FOR UPDATE
USING (auth.uid() = user_id);

-- No delete policy - transactions should be immutable for audit trail