-- ============================================
-- LC CREDIT DUAL ECONOMY SCHEMA (FIXED)
-- Genesis Credit (starter, burnable) + Earned Credit (contribution-backed)
-- ============================================

-- 1. Add dual credit columns to user_credits
ALTER TABLE user_credits
ADD COLUMN IF NOT EXISTS genesis_balance numeric DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS earned_balance numeric DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS genesis_lifetime_minted numeric DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS genesis_burned numeric DEFAULT 0 NOT NULL;

-- Migrate existing balances to earned_balance (existing users earned their credits)
UPDATE user_credits 
SET earned_balance = balance 
WHERE balance > 0 AND earned_balance = 0;

-- 2. Add credit type tracking to credit_ledger
ALTER TABLE credit_ledger
ADD COLUMN IF NOT EXISTS credit_type text DEFAULT 'earned' NOT NULL,
ADD COLUMN IF NOT EXISTS genesis_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS earned_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES profiles(user_id),
ADD COLUMN IF NOT EXISTS verification_type text;

-- Add check constraint for credit_type
ALTER TABLE credit_ledger 
ADD CONSTRAINT credit_ledger_credit_type_check 
CHECK (credit_type IN ('genesis', 'earned'));

-- 3. Create contribution verification table
CREATE TABLE IF NOT EXISTS credit_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  contribution_type text NOT NULL,
  reference_type text,
  reference_id uuid,
  amount_requested integer NOT NULL,
  amount_earned integer DEFAULT 0,
  status text DEFAULT 'pending' NOT NULL,
  verified_by uuid REFERENCES profiles(user_id),
  verified_at timestamptz,
  description text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT credit_contributions_status_check CHECK (status IN ('pending', 'verified', 'rejected')),
  CONSTRAINT credit_contributions_type_check CHECK (contribution_type IN ('project_work', 'event_hosting', 'event_participation', 'mentorship', 'community_help'))
);

-- 4. Create rate limiting table
CREATE TABLE IF NOT EXISTS credit_earning_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE UNIQUE,
  daily_earned integer DEFAULT 0 NOT NULL,
  weekly_earned integer DEFAULT 0 NOT NULL,
  last_daily_reset timestamptz DEFAULT now() NOT NULL,
  last_weekly_reset timestamptz DEFAULT now() NOT NULL,
  reputation_multiplier numeric DEFAULT 1.0 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- 5. Create function to grant genesis credits on new user creation
CREATE OR REPLACE FUNCTION grant_genesis_credits()
RETURNS trigger AS $$
BEGIN
  -- Insert or update user_credits with genesis balance
  INSERT INTO user_credits (user_id, genesis_balance, earned_balance, balance, genesis_lifetime_minted, lifetime_earned, lifetime_spent)
  VALUES (NEW.user_id, 100, 0, 100, 100, 0, 0)
  ON CONFLICT (user_id) DO UPDATE SET
    genesis_balance = user_credits.genesis_balance + 100,
    balance = user_credits.balance + 100,
    genesis_lifetime_minted = user_credits.genesis_lifetime_minted + 100;
  
  -- Log the genesis credit grant
  INSERT INTO credit_ledger (user_id, amount, balance_after, type, description, credit_type, genesis_amount, earned_amount)
  VALUES (NEW.user_id, 100, 100, 'earn', 'Genesis Credit - Welcome to ETHER', 'genesis', 100, 0);
  
  -- Initialize rate limiting for user
  INSERT INTO credit_earning_limits (user_id)
  VALUES (NEW.user_id)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for new profile creation
DROP TRIGGER IF EXISTS on_profile_created_grant_genesis ON profiles;
CREATE TRIGGER on_profile_created_grant_genesis
AFTER INSERT ON profiles
FOR EACH ROW
EXECUTE FUNCTION grant_genesis_credits();

-- 6. Create updated credit ledger trigger that handles dual credit types
CREATE OR REPLACE FUNCTION update_user_credits_dual()
RETURNS trigger AS $$
BEGIN
  -- Ensure user_credits row exists
  INSERT INTO user_credits (user_id, balance, genesis_balance, earned_balance, lifetime_earned, lifetime_spent)
  VALUES (NEW.user_id, 0, 0, 0, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  IF NEW.credit_type = 'genesis' THEN
    IF NEW.type = 'spend' OR NEW.type = 'transfer_out' THEN
      UPDATE user_credits SET
        genesis_balance = genesis_balance + NEW.genesis_amount,
        genesis_burned = genesis_burned + ABS(NEW.genesis_amount),
        balance = balance + NEW.amount,
        lifetime_spent = lifetime_spent + ABS(NEW.amount),
        updated_at = now()
      WHERE user_id = NEW.user_id;
    ELSE
      UPDATE user_credits SET
        genesis_balance = genesis_balance + NEW.genesis_amount,
        balance = balance + NEW.amount,
        updated_at = now()
      WHERE user_id = NEW.user_id;
    END IF;
  ELSE
    UPDATE user_credits SET
      earned_balance = earned_balance + COALESCE(NEW.earned_amount, NEW.amount),
      balance = balance + NEW.amount,
      lifetime_earned = CASE WHEN NEW.amount > 0 THEN lifetime_earned + NEW.amount ELSE lifetime_earned END,
      lifetime_spent = CASE WHEN NEW.amount < 0 THEN lifetime_spent + ABS(NEW.amount) ELSE lifetime_spent END,
      updated_at = now()
    WHERE user_id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop old trigger and create new one
DROP TRIGGER IF EXISTS on_credit_ledger_insert ON credit_ledger;
CREATE TRIGGER on_credit_ledger_insert
AFTER INSERT ON credit_ledger
FOR EACH ROW
EXECUTE FUNCTION update_user_credits_dual();

-- 7. Enable RLS on new tables
ALTER TABLE credit_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_earning_limits ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies for credit_contributions
CREATE POLICY "Users can view own contributions"
ON credit_contributions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can view contributions they need to verify"
ON credit_contributions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM projects p 
    WHERE p.id = credit_contributions.reference_id 
    AND p.creator_id = auth.uid()
    AND credit_contributions.reference_type = 'project'
  )
  OR
  EXISTS (
    SELECT 1 FROM events e 
    WHERE e.id = credit_contributions.reference_id 
    AND e.creator_id = auth.uid()
    AND credit_contributions.reference_type = 'event'
  )
);

CREATE POLICY "Users can create contribution claims"
ON credit_contributions FOR INSERT
WITH CHECK (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Verifiers can update contributions"
ON credit_contributions FOR UPDATE
USING (
  (reference_type = 'project' AND EXISTS (
    SELECT 1 FROM projects p WHERE p.id = reference_id AND p.creator_id = auth.uid()
  ))
  OR
  (reference_type = 'event' AND EXISTS (
    SELECT 1 FROM events e WHERE e.id = reference_id AND e.creator_id = auth.uid()
  ))
  OR
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- 9. RLS Policies for credit_earning_limits
CREATE POLICY "Users can view own earning limits"
ON credit_earning_limits FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can manage earning limits"
ON credit_earning_limits FOR ALL
USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- 10. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_credit_contributions_user_id ON credit_contributions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_contributions_status ON credit_contributions(status);
CREATE INDEX IF NOT EXISTS idx_credit_contributions_reference ON credit_contributions(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_credit_type ON credit_ledger(credit_type);
CREATE INDEX IF NOT EXISTS idx_credit_earning_limits_user_id ON credit_earning_limits(user_id);

-- 11. Add updated_at trigger for new tables
CREATE TRIGGER update_credit_contributions_updated_at
BEFORE UPDATE ON credit_contributions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_credit_earning_limits_updated_at
BEFORE UPDATE ON credit_earning_limits
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();