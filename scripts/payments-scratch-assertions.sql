-- Assertions for the payments migration. Runs on a throwaway database
-- after every file in supabase/migrations. Never point this at production.

DO $$
DECLARE
  v_buyer uuid := '11111111-1111-4111-8111-111111111111';
  v_seller uuid := '22222222-2222-4222-8222-222222222222';
  v_store uuid;
  v_item uuid;
  v_order uuid;
  v_buyer_balance numeric;
  v_seller_earned numeric;
  v_types text;
  v_treasury integer;
  v_inventory integer;
  v_collected numeric;
  v_event uuid;
  v_tier uuid;
  v_ticket uuid;
  v_sold integer;
  v_again boolean;
  v_snapshot jsonb;
BEGIN
  INSERT INTO public.stores (user_id, name, accepts_credits, accepts_cash)
  VALUES (v_seller, 'Scratch Store', true, true)
  RETURNING id INTO v_store;

  INSERT INTO public.store_items (
    store_id, type, title, price, credits_price, inventory_count
  ) VALUES (
    v_store, 'product', 'Tape', 20, 10, 5
  ) RETURNING id INTO v_item;

  INSERT INTO public.user_credits (
    user_id, balance, genesis_balance, earned_balance, lifetime_earned, lifetime_spent
  ) VALUES (
    v_buyer, 100, 0, 100, 100, 0
  );

  BEGIN
    INSERT INTO public.credit_ledger (user_id, amount, balance_after, type, description)
    VALUES (v_buyer, -1, 99, 'sale', 'rejected type');
    RAISE EXCEPTION 'credit_ledger accepted type sale';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  v_order := (public.complete_store_credit_purchase(v_buyer, v_item, 2)->>'order_id')::uuid;

  SELECT balance INTO v_buyer_balance FROM public.user_credits WHERE user_id = v_buyer;
  SELECT earned_balance INTO v_seller_earned FROM public.user_credits WHERE user_id = v_seller;
  SELECT inventory_count INTO v_inventory FROM public.store_items WHERE id = v_item;
  SELECT string_agg(DISTINCT type, ',' ORDER BY type) INTO v_types
  FROM public.credit_ledger WHERE reference_id = v_order;
  SELECT count(*) INTO v_treasury FROM public.platform_treasury WHERE source_id = v_order;

  IF v_buyer_balance <> 80 THEN
    RAISE EXCEPTION 'buyer balance %, expected 80', v_buyer_balance;
  END IF;
  IF v_seller_earned <> 16 THEN
    RAISE EXCEPTION 'seller earned %, expected 16', v_seller_earned;
  END IF;
  IF v_inventory <> 3 THEN
    RAISE EXCEPTION 'inventory %, expected 3', v_inventory;
  END IF;
  IF v_types <> 'earn,spend' THEN
    RAISE EXCEPTION 'ledger types %, expected earn,spend', v_types;
  END IF;
  IF v_treasury <> 1 THEN
    RAISE EXCEPTION 'treasury rows %, expected 1', v_treasury;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.credit_ledger
    WHERE reference_id = v_order
      AND type = 'earn'
      AND (credit_type <> 'earned' OR earned_amount <> 16)
  ) THEN
    RAISE EXCEPTION 'seller earn row missing earned_amount';
  END IF;

  BEGIN
    PERFORM public.complete_store_credit_purchase(v_buyer, v_item, 20);
    RAISE EXCEPTION 'oversized credit purchase was committed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%Insufficient credits%' AND SQLERRM NOT LIKE '%Insufficient inventory%' THEN
      RAISE;
    END IF;
  END;

  IF (SELECT count(*) FROM public.store_orders WHERE item_id = v_item) <> 1 THEN
    RAISE EXCEPTION 'failed purchase left an order';
  END IF;
  IF (SELECT inventory_count FROM public.store_items WHERE id = v_item) <> 3 THEN
    RAISE EXCEPTION 'failed purchase changed inventory';
  END IF;

  INSERT INTO public.store_orders (
    store_id, buyer_id, item_id, quantity, total_price, payment_type, status, platform_fee
  ) VALUES (
    v_store, v_buyer, v_item, 1, 20, 'cash', 'pending', 4
  ) RETURNING id INTO v_order;

  INSERT INTO public.platform_treasury (source_type, source_id, amount, credits_amount, description)
  VALUES ('store_order', v_order, 4, 0, 'pre-payment fee');

  IF public.cancel_pending_store_order(v_order) IS NOT TRUE THEN
    RAISE EXCEPTION 'cancel did not report success';
  END IF;
  IF (SELECT status FROM public.store_orders WHERE id = v_order) <> 'cancelled' THEN
    RAISE EXCEPTION 'order was not cancelled';
  END IF;
  IF EXISTS (SELECT 1 FROM public.platform_treasury WHERE source_id = v_order) THEN
    RAISE EXCEPTION 'pre-payment treasury row survived cancel';
  END IF;

  INSERT INTO public.membership_contributions (user_id, amount, period_start, period_end)
  VALUES (v_buyer, 10, now(), now());
  INSERT INTO public.donations (amount, mode, status) VALUES (5, 'one_time', 'paid');
  INSERT INTO public.donations (amount, mode, status) VALUES (9, 'one_time', 'refunded');
  v_snapshot := public.membership_fund_snapshot();
  v_collected := (v_snapshot->>'collected')::numeric;
  IF v_collected <> 15 THEN
    RAISE EXCEPTION 'fund snapshot collected %, expected 15', v_collected;
  END IF;

  INSERT INTO public.events (creator_id, title, city, start_date)
  VALUES (v_seller, 'Scratch Night', 'Austin', now())
  RETURNING id INTO v_event;

  INSERT INTO public.ticket_tiers (event_id, name, price_cents, quantity_sold)
  VALUES (v_event, 'General', 1000, 0)
  RETURNING id INTO v_tier;

  INSERT INTO public.ticket_orders (
    event_id, purchaser_user_id, quantity, subtotal_cents, total_cents,
    payment_method, payment_status
  ) VALUES (
    v_event, v_buyer, 2, 2000, 2000, 'stripe', 'pending'
  ) RETURNING id INTO v_ticket;

  INSERT INTO public.event_attendees (event_id, order_id, tier_id, attendee_name, status)
  VALUES (v_event, v_ticket, v_tier, 'Buyer', 'registered');

  IF public.confirm_event_ticket_order(v_ticket, 'pi_scratch') IS NOT TRUE THEN
    RAISE EXCEPTION 'ticket confirm did not transition';
  END IF;
  v_again := public.confirm_event_ticket_order(v_ticket, 'pi_scratch');
  IF v_again IS NOT FALSE THEN
    RAISE EXCEPTION 'second ticket confirm was not a no-op';
  END IF;
  SELECT quantity_sold INTO v_sold FROM public.ticket_tiers WHERE id = v_tier;
  IF v_sold <> 2 THEN
    RAISE EXCEPTION 'quantity_sold %, expected 2', v_sold;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.event_rsvps
    WHERE event_id = v_event AND user_id = v_buyer AND ticket_purchased = true
  ) THEN
    RAISE EXCEPTION 'ticket confirm did not mark the rsvp';
  END IF;

  INSERT INTO public.processed_stripe_events (event_id, event_type)
  VALUES ('evt_scratch', 'checkout.session.completed');
  BEGIN
    INSERT INTO public.processed_stripe_events (event_id, event_type)
    VALUES ('evt_scratch', 'checkout.session.completed');
    RAISE EXCEPTION 'duplicate stripe event id was accepted';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;
END $$;

-- A signed-in member cannot call the credit purchase function or insert a donation.
SET ROLE authenticated;
DO $$
BEGIN
  BEGIN
    PERFORM public.complete_store_credit_purchase(
      '11111111-1111-4111-8111-111111111111',
      '11111111-1111-4111-8111-111111111111',
      1
    );
    RAISE EXCEPTION 'authenticated role executed complete_store_credit_purchase';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  BEGIN
    INSERT INTO public.donations (amount, mode, status) VALUES (1, 'one_time', 'paid');
    RAISE EXCEPTION 'authenticated role inserted a donation';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END $$;
RESET ROLE;
