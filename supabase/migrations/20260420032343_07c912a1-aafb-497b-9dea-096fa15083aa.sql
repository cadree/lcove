
-- Tags table
CREATE TABLE public.event_attendee_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_user_id uuid NOT NULL,
  attendee_email text,
  attendee_user_id uuid,
  tag text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_attendee_tags_identity_check CHECK (attendee_email IS NOT NULL OR attendee_user_id IS NOT NULL)
);

CREATE INDEX idx_eat_host_email ON public.event_attendee_tags(host_user_id, attendee_email);
CREATE INDEX idx_eat_host_user ON public.event_attendee_tags(host_user_id, attendee_user_id);
CREATE UNIQUE INDEX uq_eat_host_email_tag ON public.event_attendee_tags(host_user_id, lower(attendee_email), lower(tag)) WHERE attendee_email IS NOT NULL;

ALTER TABLE public.event_attendee_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hosts manage their own attendee tags"
ON public.event_attendee_tags FOR ALL
USING (auth.uid() = host_user_id)
WITH CHECK (auth.uid() = host_user_id);

-- Notes table
CREATE TABLE public.event_attendee_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_user_id uuid NOT NULL,
  attendee_email text,
  attendee_user_id uuid,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_attendee_notes_identity_check CHECK (attendee_email IS NOT NULL OR attendee_user_id IS NOT NULL)
);

CREATE INDEX idx_ean_host_email ON public.event_attendee_notes(host_user_id, attendee_email);
CREATE INDEX idx_ean_host_user ON public.event_attendee_notes(host_user_id, attendee_user_id);

ALTER TABLE public.event_attendee_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hosts manage their own attendee notes"
ON public.event_attendee_notes FOR ALL
USING (auth.uid() = host_user_id)
WITH CHECK (auth.uid() = host_user_id);

CREATE TRIGGER trg_ean_updated_at
BEFORE UPDATE ON public.event_attendee_notes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RPC: Aggregated CRM profile
CREATE OR REPLACE FUNCTION public.get_attendee_crm_profile(
  p_email text,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_email text := lower(coalesce(p_email, ''));
  v_identity jsonb;
  v_stats jsonb;
  v_orders jsonb;
  v_events jsonb;
  v_tags jsonb;
  v_note jsonb;
  v_managed_event_ids uuid[];
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- All events caller can manage
  SELECT array_agg(e.id) INTO v_managed_event_ids
  FROM public.events e
  WHERE public.can_manage_event(e.id, v_caller);

  IF v_managed_event_ids IS NULL THEN
    v_managed_event_ids := ARRAY[]::uuid[];
  END IF;

  -- Identity (profile join if user_id known)
  IF p_user_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'user_id', p.user_id,
      'display_name', p.display_name,
      'avatar_url', p.avatar_url,
      'username', p.username,
      'city', p.city,
      'phone', p.phone,
      'social_links', p.social_links,
      'joined_at', p.created_at,
      'email', v_email
    ) INTO v_identity
    FROM public.profiles p
    WHERE p.user_id = p_user_id
    LIMIT 1;
  END IF;

  IF v_identity IS NULL THEN
    v_identity := jsonb_build_object(
      'user_id', p_user_id,
      'display_name', NULL,
      'avatar_url', NULL,
      'username', NULL,
      'city', NULL,
      'phone', NULL,
      'social_links', NULL,
      'joined_at', NULL,
      'email', v_email
    );
  END IF;

  -- Stats over host's events
  WITH att AS (
    SELECT a.*, e.title AS event_title, e.start_date
    FROM public.event_attendees a
    JOIN public.events e ON e.id = a.event_id
    WHERE a.event_id = ANY(v_managed_event_ids)
      AND (
        (p_user_id IS NOT NULL AND a.attendee_user_id = p_user_id)
        OR (v_email <> '' AND lower(a.attendee_email) = v_email)
      )
  ),
  ord AS (
    SELECT o.*
    FROM public.ticket_orders o
    WHERE o.event_id = ANY(v_managed_event_ids)
      AND (
        (p_user_id IS NOT NULL AND o.purchaser_user_id = p_user_id)
        OR (v_email <> '' AND lower(o.purchaser_email) = v_email)
      )
  )
  SELECT jsonb_build_object(
    'tickets_purchased', (SELECT count(*) FROM att),
    'events_attended', (SELECT count(DISTINCT event_id) FROM att WHERE status = 'checked_in'),
    'rsvp_count', (SELECT count(DISTINCT event_id) FROM att),
    'no_show_count', (SELECT count(*) FROM att WHERE status = 'confirmed' AND start_date < now() - interval '1 day'),
    'lifetime_spend_cents', COALESCE((SELECT sum(total_cents - COALESCE(refund_amount_cents, 0)) FROM ord WHERE payment_status IN ('paid','succeeded','complete','completed')), 0),
    'first_event', (SELECT jsonb_build_object('id', event_id, 'title', event_title, 'date', start_date) FROM att ORDER BY start_date ASC NULLS LAST LIMIT 1),
    'last_event', (SELECT jsonb_build_object('id', event_id, 'title', event_title, 'date', start_date) FROM att ORDER BY start_date DESC NULLS LAST LIMIT 1)
  ) INTO v_stats;

  -- Order history
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', o.id,
    'event_id', o.event_id,
    'event_title', e.title,
    'event_date', e.start_date,
    'quantity', o.quantity,
    'subtotal_cents', o.subtotal_cents,
    'total_cents', o.total_cents,
    'currency', o.currency,
    'payment_method', o.payment_method,
    'payment_status', o.payment_status,
    'refund_amount_cents', o.refund_amount_cents,
    'refunded_at', o.refunded_at,
    'created_at', o.created_at,
    'stripe_payment_intent_id', o.stripe_payment_intent_id
  ) ORDER BY o.created_at DESC), '[]'::jsonb) INTO v_orders
  FROM public.ticket_orders o
  JOIN public.events e ON e.id = o.event_id
  WHERE o.event_id = ANY(v_managed_event_ids)
    AND (
      (p_user_id IS NOT NULL AND o.purchaser_user_id = p_user_id)
      OR (v_email <> '' AND lower(o.purchaser_email) = v_email)
    );

  -- Event history (attendee rows + tier)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', a.id,
    'event_id', a.event_id,
    'event_title', e.title,
    'event_date', e.start_date,
    'event_venue', e.venue,
    'tier_id', a.tier_id,
    'tier_name', t.name,
    'ticket_number', a.ticket_number,
    'status', a.status,
    'created_at', a.created_at
  ) ORDER BY e.start_date DESC NULLS LAST), '[]'::jsonb) INTO v_events
  FROM public.event_attendees a
  JOIN public.events e ON e.id = a.event_id
  LEFT JOIN public.ticket_tiers t ON t.id = a.tier_id
  WHERE a.event_id = ANY(v_managed_event_ids)
    AND (
      (p_user_id IS NOT NULL AND a.attendee_user_id = p_user_id)
      OR (v_email <> '' AND lower(a.attendee_email) = v_email)
    );

  -- Tags (caller's own)
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'tag', tag, 'created_at', created_at) ORDER BY created_at), '[]'::jsonb)
  INTO v_tags
  FROM public.event_attendee_tags
  WHERE host_user_id = v_caller
    AND (
      (p_user_id IS NOT NULL AND attendee_user_id = p_user_id)
      OR (v_email <> '' AND lower(attendee_email) = v_email)
    );

  -- Note (single, latest)
  SELECT jsonb_build_object('id', id, 'note', note, 'updated_at', updated_at)
  INTO v_note
  FROM public.event_attendee_notes
  WHERE host_user_id = v_caller
    AND (
      (p_user_id IS NOT NULL AND attendee_user_id = p_user_id)
      OR (v_email <> '' AND lower(attendee_email) = v_email)
    )
  ORDER BY updated_at DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'identity', v_identity,
    'stats', v_stats,
    'orders', v_orders,
    'events', v_events,
    'tags', v_tags,
    'note', v_note
  );
END;
$$;

-- Upsert helper for note (one per host+attendee)
CREATE OR REPLACE FUNCTION public.upsert_attendee_note(
  p_email text,
  p_user_id uuid,
  p_note text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT id INTO v_id
  FROM public.event_attendee_notes
  WHERE host_user_id = v_caller
    AND (
      (p_user_id IS NOT NULL AND attendee_user_id = p_user_id)
      OR (p_email IS NOT NULL AND lower(attendee_email) = lower(p_email))
    )
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.event_attendee_notes (host_user_id, attendee_email, attendee_user_id, note)
    VALUES (v_caller, lower(p_email), p_user_id, p_note)
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.event_attendee_notes
    SET note = p_note, updated_at = now()
    WHERE id = v_id;
  END IF;

  RETURN v_id;
END;
$$;
