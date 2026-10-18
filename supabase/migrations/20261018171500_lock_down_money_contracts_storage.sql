-- Lock down open money writes, contract signing, store secrets, and storage paths.
-- Does not change profiles policies or profile queries.
-- Apply on the live project only after review. This file is not applied by the app.

-- ---------------------------------------------------------------------------
-- 1. Money tables: drop FOR ALL / client write policies.
--    Authenticated and anon keep the existing own-row (or participant) SELECT
--    policies. service_role bypasses RLS and is the only writer.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "System can manage payouts" ON public.payouts;
DROP POLICY IF EXISTS "System can manage escrow" ON public.escrow_holdings;
DROP POLICY IF EXISTS "System can manage reputation scores" ON public.reputation_scores;
DROP POLICY IF EXISTS "System can manage memberships" ON public.memberships;
DROP POLICY IF EXISTS "System can manage contributions" ON public.membership_contributions;
DROP POLICY IF EXISTS "System can manage subscriptions" ON public.network_subscriptions;
DROP POLICY IF EXISTS "Users can subscribe to networks" ON public.network_subscriptions;

-- Reputation stays publicly readable (existing SELECT policy). Writes do not.

-- Transactions: clients may read their own rows only. No insert/update/delete,
-- so a user cannot mark a row completed.
DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can update own transactions" ON public.transactions;
DROP POLICY IF EXISTS "System can manage transactions" ON public.transactions;

-- Credit ledger: stop client self-inserts that mint withdrawable balances.
-- Admins may still insert from the admin UI. Edge functions use service_role.
DROP POLICY IF EXISTS "Service role inserts credit entries" ON public.credit_ledger;
DROP POLICY IF EXISTS "Admins can create credit entries" ON public.credit_ledger;
CREATE POLICY "Admins can create credit entries"
ON public.credit_ledger
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.credit_ledger
  ADD COLUMN IF NOT EXISTS server_issued boolean NOT NULL DEFAULT false;

-- Invoker-rights trigger so current_user is the session role, not the owner.
CREATE OR REPLACE FUNCTION public.credit_ledger_mark_issuer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.server_issued := current_user IN ('service_role', 'postgres', 'supabase_admin');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS credit_ledger_mark_issuer ON public.credit_ledger;
CREATE TRIGGER credit_ledger_mark_issuer
BEFORE INSERT ON public.credit_ledger
FOR EACH ROW
EXECUTE FUNCTION public.credit_ledger_mark_issuer();

-- Historical rows that already came from a verifier or a known server source.
-- Self-awards (no verified_by, no source reference) stay non-withdrawable.
UPDATE public.credit_ledger
SET server_issued = true
WHERE credit_type = 'earned'
  AND (
    verified_by IS NOT NULL
    OR reference_type IN ('event_ticket_sale', 'store_order', 'studio_booking', 'stream_tip')
  );

-- Public fund totals without exposing membership or contribution rows.
CREATE OR REPLACE FUNCTION public.membership_fund_snapshot(
  p_start timestamptz DEFAULT NULL,
  p_end timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'collected', COALESCE((
      SELECT SUM(amount)
      FROM public.membership_contributions
      WHERE (p_start IS NULL OR created_at >= p_start)
        AND (p_end IS NULL OR created_at <= p_end)
    ), 0),
    'member_count', (
      SELECT COUNT(*)
      FROM public.memberships
      WHERE CASE
        WHEN p_start IS NULL AND p_end IS NULL THEN status = 'active'
        ELSE (p_start IS NULL OR created_at >= p_start)
         AND (p_end IS NULL OR created_at <= p_end)
      END
    )
  );
$$;

REVOKE ALL ON FUNCTION public.membership_fund_snapshot(timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.membership_fund_snapshot(timestamptz, timestamptz) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. contact_contracts: owner access, or an unguessable signing token.
-- ---------------------------------------------------------------------------

ALTER TABLE public.contact_contracts
  ADD COLUMN IF NOT EXISTS signing_token text;

UPDATE public.contact_contracts
SET signing_token = encode(gen_random_bytes(32), 'hex')
WHERE signing_token IS NULL OR length(signing_token) < 32;

ALTER TABLE public.contact_contracts
  ALTER COLUMN signing_token SET DEFAULT encode(gen_random_bytes(32), 'hex');

ALTER TABLE public.contact_contracts
  ALTER COLUMN signing_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_contact_contracts_signing_token
  ON public.contact_contracts (signing_token);

DROP POLICY IF EXISTS "Anyone can view contracts by id for signing" ON public.contact_contracts;
DROP POLICY IF EXISTS "Anyone can update signature fields on contracts" ON public.contact_contracts;

-- PostgREST sets request.headers to a JSON object. A missing or unusable value
-- returns null so owner queries still succeed when the header is absent.
CREATE OR REPLACE FUNCTION public.request_header(p_name text)
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  raw text;
  headers json;
BEGIN
  raw := current_setting('request.headers', true);
  IF raw IS NULL OR length(btrim(raw)) = 0 THEN
    RETURN NULL;
  END IF;
  BEGIN
    headers := raw::json;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
  RETURN NULLIF(headers->>p_name, '');
END;
$$;

CREATE POLICY "Signers can view contract with token"
ON public.contact_contracts
FOR SELECT
TO anon, authenticated
USING (
  signing_token IS NOT NULL
  AND length(signing_token) >= 32
  AND signing_token = public.request_header('x-signing-token')
);

CREATE POLICY "Signers can update contract with token"
ON public.contact_contracts
FOR UPDATE
TO anon, authenticated
USING (
  signing_token IS NOT NULL
  AND length(signing_token) >= 32
  AND signing_token = public.request_header('x-signing-token')
)
WITH CHECK (
  signing_token IS NOT NULL
  AND length(signing_token) >= 32
  AND signing_token = public.request_header('x-signing-token')
);

CREATE OR REPLACE FUNCTION public.contact_contracts_limit_signer_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT DISTINCT FROM OLD.owner_user_id THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM 'signed' THEN
    RAISE EXCEPTION 'signers may only mark a contract signed';
  END IF;

  IF (
    to_jsonb(NEW) - ARRAY['client_signature_url', 'client_signed_at', 'status', 'updated_at']
  ) IS DISTINCT FROM (
    to_jsonb(OLD) - ARRAY['client_signature_url', 'client_signed_at', 'status', 'updated_at']
  ) THEN
    RAISE EXCEPTION 'signers may only update signature fields';
  END IF;

  IF NEW.client_signature_url IS NULL OR NEW.client_signed_at IS NULL THEN
    RAISE EXCEPTION 'signature required';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contact_contracts_limit_signer_update ON public.contact_contracts;
CREATE TRIGGER contact_contracts_limit_signer_update
BEFORE UPDATE ON public.contact_contracts
FOR EACH ROW
EXECUTE FUNCTION public.contact_contracts_limit_signer_update();

-- ---------------------------------------------------------------------------
-- 6. Move store payment secrets off the publicly readable stores row.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.store_secrets (
  store_id uuid PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  shopify_access_token text,
  stripe_connect_account_id text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.store_secrets (store_id, shopify_access_token, stripe_connect_account_id)
SELECT id, shopify_access_token, stripe_connect_account_id
FROM public.stores
WHERE shopify_access_token IS NOT NULL OR stripe_connect_account_id IS NOT NULL
ON CONFLICT (store_id) DO UPDATE SET
  shopify_access_token = EXCLUDED.shopify_access_token,
  stripe_connect_account_id = EXCLUDED.stripe_connect_account_id,
  updated_at = now();

ALTER TABLE public.stores DROP COLUMN IF EXISTS shopify_access_token;
ALTER TABLE public.stores DROP COLUMN IF EXISTS stripe_connect_account_id;

ALTER TABLE public.store_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.store_secrets FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.store_secrets TO service_role;

COMMENT ON TABLE public.store_secrets IS
  'Store payment secrets. No policies and no grants for anon/authenticated. service_role only.';

-- ---------------------------------------------------------------------------
-- 7. Storage: owner-folder writes for media and board-uploads.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Authenticated users can upload media" ON storage.objects;
CREATE POLICY "Users can upload own media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can update own media" ON storage.objects;
CREATE POLICY "Users can update own media"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'media'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can upload board media" ON storage.objects;
CREATE POLICY "Users can upload own board media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'board-uploads'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can delete own board media" ON storage.objects;
CREATE POLICY "Users can delete own board media"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'board-uploads'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
