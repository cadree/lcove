-- Drop the duplicate trigger that calls the OLD update_user_credits function
-- (We keep the on_credit_ledger_insert trigger that calls update_user_credits_dual)
DROP TRIGGER IF EXISTS on_credit_ledger_entry ON public.credit_ledger;

-- Initialize user_credits for any existing users who are missing records
-- Grant them 100 genesis credits as the system intends
INSERT INTO public.user_credits (user_id, genesis_balance, earned_balance, balance, genesis_lifetime_minted, lifetime_earned, lifetime_spent)
SELECT p.user_id, 100, 0, 100, 100, 0, 0
FROM public.profiles p
WHERE NOT EXISTS (SELECT 1 FROM public.user_credits uc WHERE uc.user_id = p.user_id)
  AND p.onboarding_completed = true
ON CONFLICT (user_id) DO NOTHING;

-- Add a validation trigger to prevent negative balances
CREATE OR REPLACE FUNCTION public.validate_credit_balances()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.genesis_balance < 0 THEN
    RAISE EXCEPTION 'Genesis balance cannot be negative';
  END IF;
  IF NEW.earned_balance < 0 THEN
    RAISE EXCEPTION 'Earned balance cannot be negative';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS validate_credit_balances_trigger ON public.user_credits;
CREATE TRIGGER validate_credit_balances_trigger
  BEFORE UPDATE ON public.user_credits
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_credit_balances();