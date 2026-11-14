import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { COMMUNITY_FUND_FEE_PERCENT } from "../_shared/fees.mjs";
import { destinationCharge, testStripe, verifiedDestination } from "../_shared/creator-connect.mjs";
import { httpStatusForError } from "../_shared/http-error.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "");
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Not authenticated" }, 401);
    const { data: userData, error: userError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userError || !userData.user) return json({ error: "Not authenticated" }, 401);

    const { invoiceId } = await req.json();
    if (!invoiceId) return json({ error: "Invoice is required" }, 400);

    const { data: invoice, error } = await admin
      .from("contact_invoices")
      .select("id, title, total, currency, status, owner_user_id")
      .eq("id", invoiceId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!invoice) return json({ error: "Invoice not found" }, 404);
    if (invoice.owner_user_id !== userData.user.id) return json({ error: "Only the sender can create a pay link" }, 403);
    if (invoice.status === "paid") return json({ error: "This invoice is already paid" }, 400);
    const total = Number(invoice.total);
    if (!Number.isFinite(total) || total <= 0) return json({ error: "Invoice total must be greater than zero" }, 400);

    const destination = await verifiedDestination(admin, invoice.owner_user_id);
    if (!destination) {
      return json({
        needs_connect: true,
        error: "Set up payouts in Wallet before sending a pay link. Card payments need charges and transfers enabled on your Stripe account.",
      });
    }

    const amountCents = Math.round(total * 100);
    const stripe = testStripe();
    const origin = req.headers.get("origin") || "";
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{
        quantity: 1,
        price_data: {
          currency: (invoice.currency || "usd").toLowerCase(),
          unit_amount: amountCents,
          product_data: { name: invoice.title || "Invoice" },
        },
      }],
      success_url: `${origin}/pipeline?invoice=paid`,
      cancel_url: `${origin}/pipeline?invoice=cancel`,
      metadata: {
        type: "contact_invoice",
        invoice_id: invoice.id,
        owner_user_id: invoice.owner_user_id,
        fee_percent: String(COMMUNITY_FUND_FEE_PERCENT),
      },
      payment_intent_data: destinationCharge(destination, amountCents),
    });

    await admin.from("contact_invoices").update({
      payment_url: session.url,
      stripe_session_id: session.id,
    }).eq("id", invoice.id);

    return json({ url: session.url, fee_percent: COMMUNITY_FUND_FEE_PERCENT });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, httpStatusForError(error));
  }
});
