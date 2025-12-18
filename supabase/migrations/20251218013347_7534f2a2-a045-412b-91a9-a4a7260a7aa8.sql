-- Create credit ledger table for tracking LC Credits
CREATE TABLE public.credit_ledger (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  balance_after DECIMAL(12,2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('earn', 'spend', 'transfer_in', 'transfer_out', 'payout_conversion', 'refund')),
  description TEXT NOT NULL,
  reference_type TEXT, -- 'project', 'application', 'payout', etc.
  reference_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user credits summary table
CREATE TABLE public.user_credits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  lifetime_earned DECIMAL(12,2) NOT NULL DEFAULT 0,
  lifetime_spent DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create payout methods table
CREATE TABLE public.payout_methods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('bank_account', 'debit_card', 'apple_pay')),
  stripe_payment_method_id TEXT,
  stripe_bank_account_id TEXT,
  last_four TEXT,
  brand TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create payouts table
CREATE TABLE public.payouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  payout_method_id UUID REFERENCES public.payout_methods(id),
  stripe_payout_id TEXT,
  stripe_transfer_id TEXT,
  project_id UUID REFERENCES public.projects(id),
  role_id UUID,
  error_message TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create transactions table for all money movements
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('project_payment', 'payout', 'credit_purchase', 'credit_redemption', 'refund')),
  amount DECIMAL(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Credit ledger policies
CREATE POLICY "Users can view own credit ledger"
ON public.credit_ledger FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can create credit entries"
ON public.credit_ledger FOR INSERT
WITH CHECK (true);

-- User credits policies
CREATE POLICY "Users can view own credits"
ON public.user_credits FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can view others credit balance"
ON public.user_credits FOR SELECT
USING (true);

CREATE POLICY "System can manage credits"
ON public.user_credits FOR ALL
USING (true);

-- Payout methods policies
CREATE POLICY "Users can view own payout methods"
ON public.payout_methods FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can add payout methods"
ON public.payout_methods FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own payout methods"
ON public.payout_methods FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own payout methods"
ON public.payout_methods FOR DELETE
USING (auth.uid() = user_id);

-- Payouts policies
CREATE POLICY "Users can view own payouts"
ON public.payouts FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can manage payouts"
ON public.payouts FOR ALL
USING (true);

-- Transactions policies
CREATE POLICY "Users can view own transactions"
ON public.transactions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can manage transactions"
ON public.transactions FOR ALL
USING (true);

-- Indexes
CREATE INDEX idx_credit_ledger_user ON public.credit_ledger(user_id);
CREATE INDEX idx_credit_ledger_created ON public.credit_ledger(created_at DESC);
CREATE INDEX idx_user_credits_user ON public.user_credits(user_id);
CREATE INDEX idx_payout_methods_user ON public.payout_methods(user_id);
CREATE INDEX idx_payouts_user ON public.payouts(user_id);
CREATE INDEX idx_payouts_status ON public.payouts(status);
CREATE INDEX idx_transactions_user ON public.transactions(user_id);
CREATE INDEX idx_transactions_status ON public.transactions(status);

-- Function to update user credits balance
CREATE OR REPLACE FUNCTION public.update_user_credits()
RETURNS TRIGGER AS $$
BEGIN
  -- Upsert user_credits record
  INSERT INTO public.user_credits (user_id, balance, lifetime_earned, lifetime_spent)
  VALUES (
    NEW.user_id,
    CASE WHEN NEW.amount > 0 THEN NEW.amount ELSE 0 END,
    CASE WHEN NEW.amount > 0 THEN NEW.amount ELSE 0 END,
    CASE WHEN NEW.amount < 0 THEN ABS(NEW.amount) ELSE 0 END
  )
  ON CONFLICT (user_id) DO UPDATE SET
    balance = user_credits.balance + NEW.amount,
    lifetime_earned = CASE WHEN NEW.amount > 0 THEN user_credits.lifetime_earned + NEW.amount ELSE user_credits.lifetime_earned END,
    lifetime_spent = CASE WHEN NEW.amount < 0 THEN user_credits.lifetime_spent + ABS(NEW.amount) ELSE user_credits.lifetime_spent END,
    updated_at = now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_credit_ledger_entry
AFTER INSERT ON public.credit_ledger
FOR EACH ROW
EXECUTE FUNCTION public.update_user_credits();

-- Trigger to update updated_at
CREATE TRIGGER update_user_credits_updated_at
BEFORE UPDATE ON public.user_credits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();