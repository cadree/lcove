-- Clients may RSVP, but only the service role may mark a ticket purchased
-- or record what was paid. purchase-event-with-credits and the Stripe
-- verification functions write these columns.

CREATE OR REPLACE FUNCTION public.event_rsvps_lock_ticket_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('service_role', 'postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.ticket_purchased, false)
       OR COALESCE(NEW.credits_spent, 0) <> 0
       OR NEW.stripe_payment_id IS NOT NULL THEN
      RAISE EXCEPTION 'ticket purchases are recorded by the server';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.ticket_purchased IS DISTINCT FROM OLD.ticket_purchased
     OR NEW.credits_spent IS DISTINCT FROM OLD.credits_spent
     OR NEW.stripe_payment_id IS DISTINCT FROM OLD.stripe_payment_id THEN
    RAISE EXCEPTION 'ticket purchases are recorded by the server';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS event_rsvps_lock_ticket_fields ON public.event_rsvps;
CREATE TRIGGER event_rsvps_lock_ticket_fields
BEFORE INSERT OR UPDATE ON public.event_rsvps
FOR EACH ROW
EXECUTE FUNCTION public.event_rsvps_lock_ticket_fields();
