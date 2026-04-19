
-- =========================================
-- PHASE 1: Event Ticketing Data Model
-- =========================================

-- 1. Extend events table with type system
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS event_type text NOT NULL DEFAULT 'free_rsvp'
    CHECK (event_type IN ('free_rsvp','paid_ticket','invite_only','approval_required','donation','hybrid')),
  ADD COLUMN IF NOT EXISTS requires_approval boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS waitlist_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

-- Backfill event_type from legacy ticket_type
UPDATE public.events
SET event_type = CASE
  WHEN ticket_type = 'paid' OR (ticket_price IS NOT NULL AND ticket_price > 0) THEN 'paid_ticket'
  WHEN ticket_type = 'credits' THEN 'paid_ticket'
  ELSE 'free_rsvp'
END
WHERE event_type = 'free_rsvp';

-- =========================================
-- 2. ticket_tiers
-- =========================================
CREATE TABLE IF NOT EXISTS public.ticket_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price_cents integer NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  currency text NOT NULL DEFAULT 'usd',
  credits_price integer NOT NULL DEFAULT 0 CHECK (credits_price >= 0),
  capacity integer,
  quantity_sold integer NOT NULL DEFAULT 0,
  sale_starts_at timestamptz,
  sale_ends_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_tiers_event ON public.ticket_tiers(event_id);

ALTER TABLE public.ticket_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active tiers for public events"
ON public.ticket_tiers FOR SELECT
USING (
  is_active = true
  AND EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.is_public = true)
);

CREATE POLICY "Event creator can view all tiers"
ON public.ticket_tiers FOR SELECT
USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.creator_id = auth.uid()));

CREATE POLICY "Event creator can manage tiers"
ON public.ticket_tiers FOR ALL
USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.creator_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.creator_id = auth.uid()));

CREATE TRIGGER update_ticket_tiers_updated_at
BEFORE UPDATE ON public.ticket_tiers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- 3. ticket_orders
-- =========================================
CREATE TABLE IF NOT EXISTS public.ticket_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  purchaser_user_id uuid,
  purchaser_name text,
  purchaser_email text,
  purchaser_phone text,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  subtotal_cents integer NOT NULL DEFAULT 0,
  total_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'usd',
  credits_spent integer NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'free'
    CHECK (payment_method IN ('free','stripe','credits','comp','external')),
  payment_status text NOT NULL DEFAULT 'paid'
    CHECK (payment_status IN ('pending','paid','failed','refunded','partial_refund','cancelled')),
  stripe_session_id text,
  stripe_payment_intent_id text,
  refunded_at timestamptz,
  refund_amount_cents integer NOT NULL DEFAULT 0,
  source text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_orders_event ON public.ticket_orders(event_id);
CREATE INDEX IF NOT EXISTS idx_ticket_orders_purchaser ON public.ticket_orders(purchaser_user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_orders_stripe ON public.ticket_orders(stripe_session_id);

ALTER TABLE public.ticket_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Purchaser can view own orders"
ON public.ticket_orders FOR SELECT
USING (auth.uid() IS NOT NULL AND purchaser_user_id = auth.uid());

CREATE POLICY "Event creator can view all orders"
ON public.ticket_orders FOR SELECT
USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.creator_id = auth.uid()));

CREATE POLICY "Authenticated users can create their own orders"
ON public.ticket_orders FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND purchaser_user_id = auth.uid());

CREATE POLICY "Event creator can update orders"
ON public.ticket_orders FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.creator_id = auth.uid()));

CREATE TRIGGER update_ticket_orders_updated_at
BEFORE UPDATE ON public.ticket_orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- 4. event_attendees
-- =========================================
CREATE TABLE IF NOT EXISTS public.event_attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.ticket_orders(id) ON DELETE CASCADE,
  tier_id uuid REFERENCES public.ticket_tiers(id) ON DELETE SET NULL,
  attendee_user_id uuid,
  attendee_name text,
  attendee_email text,
  attendee_phone text,
  status text NOT NULL DEFAULT 'registered'
    CHECK (status IN ('interested','registered','approved','waitlisted','cancelled','no_show','refunded')),
  qr_code text NOT NULL DEFAULT encode(gen_random_bytes(16),'hex'),
  ticket_number text NOT NULL DEFAULT to_char(now(),'YYYYMMDD') || '-' || substr(replace(gen_random_uuid()::text,'-',''),1,8),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS event_attendees_qr_code_unique ON public.event_attendees(qr_code);
CREATE INDEX IF NOT EXISTS idx_event_attendees_event ON public.event_attendees(event_id);
CREATE INDEX IF NOT EXISTS idx_event_attendees_order ON public.event_attendees(order_id);
CREATE INDEX IF NOT EXISTS idx_event_attendees_user ON public.event_attendees(attendee_user_id);
CREATE INDEX IF NOT EXISTS idx_event_attendees_status ON public.event_attendees(status);

ALTER TABLE public.event_attendees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Attendee can view own ticket"
ON public.event_attendees FOR SELECT
USING (auth.uid() IS NOT NULL AND attendee_user_id = auth.uid());

CREATE POLICY "Purchaser can view attendees from their orders"
ON public.event_attendees FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.ticket_orders o WHERE o.id = order_id AND o.purchaser_user_id = auth.uid())
);

CREATE POLICY "Event creator can view all attendees"
ON public.event_attendees FOR SELECT
USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.creator_id = auth.uid()));

CREATE POLICY "Event creator can manage attendees"
ON public.event_attendees FOR ALL
USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.creator_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.creator_id = auth.uid()));

CREATE POLICY "Purchaser can insert attendees on their orders"
ON public.event_attendees FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.ticket_orders o WHERE o.id = order_id AND o.purchaser_user_id = auth.uid())
);

CREATE TRIGGER update_event_attendees_updated_at
BEFORE UPDATE ON public.event_attendees
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- 5. event_check_ins
-- =========================================
CREATE TABLE IF NOT EXISTS public.event_check_ins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  attendee_id uuid NOT NULL REFERENCES public.event_attendees(id) ON DELETE CASCADE,
  checked_in_by uuid,
  method text NOT NULL DEFAULT 'qr' CHECK (method IN ('qr','manual','self')),
  device_info text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS event_check_ins_attendee_unique ON public.event_check_ins(attendee_id);
CREATE INDEX IF NOT EXISTS idx_event_check_ins_event ON public.event_check_ins(event_id);

ALTER TABLE public.event_check_ins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Event creator can view check-ins"
ON public.event_check_ins FOR SELECT
USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.creator_id = auth.uid()));

CREATE POLICY "Event creator can create check-ins"
ON public.event_check_ins FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.creator_id = auth.uid())
);

CREATE POLICY "Attendee can view own check-in"
ON public.event_check_ins FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.event_attendees a WHERE a.id = attendee_id AND a.attendee_user_id = auth.uid())
);

-- =========================================
-- 6. BACKFILL existing event_rsvps -> ticket_orders + event_attendees
-- =========================================
DO $$
DECLARE
  r RECORD;
  v_order_id uuid;
  v_event RECORD;
BEGIN
  FOR r IN
    SELECT er.*
    FROM public.event_rsvps er
    WHERE NOT EXISTS (
      -- skip if already backfilled (matched by stripe id or guest email + event)
      SELECT 1 FROM public.ticket_orders o
      WHERE o.event_id = er.event_id
        AND (
          (er.stripe_payment_id IS NOT NULL AND o.stripe_session_id = er.stripe_payment_id)
          OR (er.user_id IS NOT NULL AND o.purchaser_user_id = er.user_id)
          OR (er.guest_email IS NOT NULL AND o.purchaser_email = er.guest_email)
        )
    )
  LOOP
    SELECT id, ticket_price, creator_id INTO v_event FROM public.events WHERE id = r.event_id;
    IF v_event.id IS NULL THEN CONTINUE; END IF;

    INSERT INTO public.ticket_orders (
      event_id, purchaser_user_id, purchaser_name, purchaser_email, purchaser_phone,
      quantity, subtotal_cents, total_cents, currency, credits_spent,
      payment_method, payment_status, stripe_session_id, created_at, updated_at
    ) VALUES (
      r.event_id, r.user_id, r.guest_name, r.guest_email, r.guest_phone,
      1,
      CASE WHEN r.ticket_purchased THEN COALESCE(ROUND(v_event.ticket_price * 100)::int, 0) ELSE 0 END,
      CASE WHEN r.ticket_purchased THEN COALESCE(ROUND(v_event.ticket_price * 100)::int, 0) ELSE 0 END,
      'usd',
      COALESCE(r.credits_spent, 0),
      CASE
        WHEN r.stripe_payment_id IS NOT NULL THEN 'stripe'
        WHEN COALESCE(r.credits_spent,0) > 0 THEN 'credits'
        ELSE 'free'
      END,
      CASE
        WHEN r.status = 'going' AND (r.ticket_purchased OR r.stripe_payment_id IS NULL) THEN 'paid'
        WHEN r.status = 'cancelled' THEN 'cancelled'
        ELSE 'paid'
      END,
      r.stripe_payment_id,
      r.created_at, r.updated_at
    ) RETURNING id INTO v_order_id;

    INSERT INTO public.event_attendees (
      event_id, order_id, attendee_user_id, attendee_name, attendee_email, attendee_phone,
      status, created_at, updated_at
    ) VALUES (
      r.event_id, v_order_id, r.user_id, r.guest_name, r.guest_email, r.guest_phone,
      CASE
        WHEN r.status = 'going' THEN 'registered'
        WHEN r.status = 'interested' THEN 'interested'
        WHEN r.status = 'cancelled' THEN 'cancelled'
        ELSE 'registered'
      END,
      r.created_at, r.updated_at
    );
  END LOOP;
END $$;

-- =========================================
-- 7. Realtime
-- =========================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_tiers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_attendees;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_check_ins;
