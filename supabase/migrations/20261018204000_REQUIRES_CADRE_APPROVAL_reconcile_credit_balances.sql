-- =============================================================================
-- CADRE APPROVAL REQUIRED BEFORE APPLYING TO PRODUCTION
-- =============================================================================
-- One-time reconciliation. This file rewrites public.user_credits from
-- public.credit_ledger. It does not insert or delete ledger rows.
--
-- Why: grant_genesis_credits used to write a 100 balance and also insert a
-- ledger row. The ledger trigger added 100 again, so new users showed
-- balance 200 while the ledger said 100. Other rows with earned_amount 0
-- added amount to balance and 0 to the earned pool.
--
-- What it does:
--   1. Recomputes genesis_balance and earned_balance with ledger_entry_deltas
--      (the same rule as update_user_credits_dual).
--   2. Sets balance = genesis_balance + earned_balance.
--   3. For users who have no ledger rows, only repairs a broken sum.
--   4. Adds CHECK (balance = genesis_balance + earned_balance).
--
-- Do not apply this on the live database until Cadre has reviewed a backup.
-- Scratch tests apply it to an empty database, then insert users and check
-- that a new signup is 100, not 200.
-- =============================================================================

UPDATE public.user_credits uc
SET
  genesis_balance = d.genesis_balance,
  earned_balance = d.earned_balance,
  balance = d.genesis_balance + d.earned_balance,
  genesis_lifetime_minted = GREATEST(uc.genesis_lifetime_minted, d.genesis_minted),
  genesis_burned = d.genesis_burned,
  lifetime_earned = d.lifetime_earned,
  lifetime_spent = d.lifetime_spent,
  updated_at = now()
FROM (
  SELECT
    l.user_id,
    COALESCE(SUM(x.genesis_delta), 0) AS genesis_balance,
    COALESCE(SUM(x.earned_delta), 0) AS earned_balance,
    COALESCE(SUM(CASE WHEN x.genesis_delta > 0 THEN x.genesis_delta ELSE 0 END), 0) AS genesis_minted,
    COALESCE(SUM(
      CASE
        WHEN l.credit_type = 'genesis' AND l.type IN ('spend', 'transfer_out') THEN ABS(x.genesis_delta)
        ELSE 0
      END
    ), 0) AS genesis_burned,
    COALESCE(SUM(CASE WHEN x.earned_delta > 0 THEN x.earned_delta ELSE 0 END), 0) AS lifetime_earned,
    COALESCE(SUM(CASE WHEN l.amount < 0 THEN ABS(l.amount) ELSE 0 END), 0) AS lifetime_spent
  FROM public.credit_ledger l
  CROSS JOIN LATERAL public.ledger_entry_deltas(
    l.credit_type, l.amount, l.genesis_amount, l.earned_amount
  ) x
  GROUP BY l.user_id
) d
WHERE uc.user_id = d.user_id;

-- Users with no ledger row keep their pools. Only the sum is repaired so the
-- check below can be added. This does not mint or burn credits.
UPDATE public.user_credits uc
SET
  balance = genesis_balance + earned_balance,
  updated_at = now()
WHERE balance IS DISTINCT FROM (genesis_balance + earned_balance)
  AND NOT EXISTS (
    SELECT 1 FROM public.credit_ledger l WHERE l.user_id = uc.user_id
  );

ALTER TABLE public.user_credits
  DROP CONSTRAINT IF EXISTS user_credits_balance_matches_pools;

ALTER TABLE public.user_credits
  ADD CONSTRAINT user_credits_balance_matches_pools
  CHECK (balance = genesis_balance + earned_balance);

-- Read-only check Cadre can run after the rewrite:
--   SELECT * FROM public.user_credits_pool_check WHERE NOT pools_match;
CREATE OR REPLACE VIEW public.user_credits_pool_check AS
SELECT
  user_id,
  balance,
  genesis_balance,
  earned_balance,
  (balance = genesis_balance + earned_balance) AS pools_match
FROM public.user_credits;

GRANT SELECT ON public.user_credits_pool_check TO authenticated, service_role;
