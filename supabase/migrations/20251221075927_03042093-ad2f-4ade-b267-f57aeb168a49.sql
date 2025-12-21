-- Fix user_credits RLS policy to have explicit WITH CHECK
DROP POLICY IF EXISTS "System can manage credits" ON public.user_credits;

CREATE POLICY "Admins can manage credits"
ON public.user_credits
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Also ensure credit_ledger allows admin inserts
DROP POLICY IF EXISTS "System can create credit entries" ON public.credit_ledger;

CREATE POLICY "Admins can create credit entries"
ON public.credit_ledger
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admins can view all credit ledger entries
CREATE POLICY "Admins can view all credit entries"
ON public.credit_ledger
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));