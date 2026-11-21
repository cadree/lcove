import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { ledgerBalances } from "../_shared/credit-balances.ts";
import { httpStatusForError } from "../_shared/http-error.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: Record<string, unknown>) => {
  console.log(`[PURCHASE-EVENT-WITH-CREDITS] ${step}`, details ? JSON.stringify(details) : "");
};

type LedgerRow = Record<string, unknown>;

async function insertLedger(admin: SupabaseClient, row: LedgerRow) {
  const { error } = await admin.from("credit_ledger").insert(row);
  if (error) throw new Error(error.message);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user?.id) throw new Error("Authentication failed");
    const userId = userData.user.id;

    const { eventId } = await req.json();
    if (!eventId || typeof eventId !== "string") throw new Error("eventId is required");

    const { data: event, error: eventError } = await admin
      .from("events")
      .select("id, title, creator_id, ticket_type, credits_price, capacity")
      .eq("id", eventId)
      .single();
    if (eventError || !event) throw new Error("Event not found");

    const ticketType = event.ticket_type;
    if (ticketType !== "credits" && ticketType !== "hybrid") {
      throw new Error("This event cannot be purchased with credits");
    }
    const price = Number(event.credits_price || 0);
    if (!Number.isFinite(price) || price <= 0) {
      throw new Error("This event does not have a credit price");
    }

    const { data: existing } = await admin
      .from("event_rsvps")
      .select("id, status, ticket_purchased")
      .eq("event_id", eventId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing?.ticket_purchased) {
      return new Response(JSON.stringify({ success: true, alreadyPurchased: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (event.capacity) {
      const { count } = await admin
        .from("event_rsvps")
        .select("id", { count: "exact", head: true })
        .eq("event_id", eventId)
        .eq("status", "going");
      const alreadyGoing = existing?.status === "going";
      if (!alreadyGoing && (count || 0) >= event.capacity) {
        throw new Error("This event is sold out");
      }
    }

    let rsvpId = existing?.id as string | undefined;
    if (!rsvpId) {
      const { data: inserted, error: insertError } = await admin
        .from("event_rsvps")
        .insert({
          event_id: eventId,
          user_id: userId,
          status: "going",
          ticket_purchased: false,
          credits_spent: 0,
        })
        .select("id")
        .single();
      if (insertError || !inserted) throw new Error(insertError?.message || "Could not create RSVP");
      rsvpId = inserted.id;
    }

    const { data: claimed, error: claimError } = await admin
      .from("event_rsvps")
      .update({
        status: "going",
        ticket_purchased: true,
        credits_spent: price,
      })
      .eq("id", rsvpId)
      .or("ticket_purchased.eq.false,ticket_purchased.is.null")
      .select("id")
      .maybeSingle();
    if (claimError) throw new Error(claimError.message);
    if (!claimed) {
      return new Response(JSON.stringify({ success: true, alreadyPurchased: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const written: LedgerRow[] = [];
    try {
      const credits = await ledgerBalances(admin, userId);
      const balance = credits.balance;
      const genesis = credits.genesis_balance;
      const earned = credits.earned_balance;
      const available = Math.min(balance, genesis + earned);
      if (available < price) {
        throw new Error(`Insufficient credits. You have ${balance} LC, but need ${price} LC`);
      }

      const genesisSpend = Math.min(genesis, price);
      const earnedSpend = price - genesisSpend;
      if (earnedSpend > earned) {
        throw new Error(`Insufficient credits. You have ${balance} LC, but need ${price} LC`);
      }

      let running = balance;
      if (genesisSpend > 0) {
        running -= genesisSpend;
        const row = {
          user_id: userId,
          amount: -genesisSpend,
          balance_after: running,
          type: "spend",
          description: `Ticket purchase: ${event.title}`,
          reference_type: "event_ticket",
          reference_id: eventId,
          credit_type: "genesis",
          genesis_amount: -genesisSpend,
          earned_amount: 0,
        };
        await insertLedger(admin, row);
        written.push(row);
      }
      if (earnedSpend > 0) {
        running -= earnedSpend;
        const row = {
          user_id: userId,
          amount: -earnedSpend,
          balance_after: running,
          type: "spend",
          description: `Ticket purchase: ${event.title}`,
          reference_type: "event_ticket",
          reference_id: eventId,
          credit_type: "earned",
          genesis_amount: 0,
          earned_amount: -earnedSpend,
        };
        await insertLedger(admin, row);
        written.push(row);
      }

      const creatorId = event.creator_id as string | null;
      const creatorCredits = Math.floor(price * 0.95);
      if (creatorId && creatorId !== userId && creatorCredits > 0) {
        const creatorCreditsRow = await ledgerBalances(admin, creatorId);
        const creatorBalance = creatorCreditsRow.balance;
        const row = {
          user_id: creatorId,
          amount: creatorCredits,
          balance_after: creatorBalance + creatorCredits,
          type: "earn",
          description: `Ticket sale: ${event.title}`,
          reference_type: "event_ticket_sale",
          reference_id: eventId,
          credit_type: "earned",
          genesis_amount: 0,
          earned_amount: creatorCredits,
        };
        await insertLedger(admin, row);
        written.push(row);
      }

      log("Ticket purchased with credits", { eventId, price, creatorCredits });

      return new Response(JSON.stringify({ success: true, creditsSpent: price, creatorCredits }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    } catch (purchaseError) {
      await admin
        .from("event_rsvps")
        .update({ ticket_purchased: false, credits_spent: 0 })
        .eq("id", rsvpId);
      for (const row of written) {
        const amount = Number(row.amount);
        const creditType = String(row.credit_type);
        await insertLedger(admin, {
          user_id: row.user_id,
          amount: -amount,
          balance_after: 0,
          type: amount < 0 ? "refund" : "spend",
          description: `Reversed ticket purchase: ${event.title}`,
          reference_type: "event_ticket",
          reference_id: eventId,
          credit_type: creditType,
          genesis_amount: creditType === "genesis" ? -Number(row.genesis_amount || 0) : 0,
          earned_amount: creditType === "earned" ? -Number(row.earned_amount || 0) : 0,
        }).catch((reverseError) => {
          log("Failed to reverse ledger row", { message: String(reverseError) });
        });
      }
      throw purchaseError;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log("ERROR", { message });
    const status = httpStatusForError(error);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status,
    });
  }
});
