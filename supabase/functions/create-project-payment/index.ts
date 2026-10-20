import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { COMMUNITY_FUND_FEE_PERCENT } from "../_shared/fees.mjs";
import { destinationCharge, testStripe, verifiedDestination } from "../_shared/creator-connect.mjs";

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

    const { milestoneId } = await req.json();
    if (!milestoneId) return json({ error: "Milestone is required" }, 400);

    const { data: milestone, error } = await admin
      .from("project_milestones")
      .select("id, title, amount, currency, status, project_id")
      .eq("id", milestoneId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!milestone) return json({ error: "Milestone not found" }, 404);
    if (milestone.status === "paid") return json({ error: "This milestone is already paid" }, 400);
    const amount = Number(milestone.amount);
    if (!Number.isFinite(amount) || amount <= 0) return json({ error: "This milestone has no amount to pay" }, 400);

    const { data: project, error: projectError } = await admin
      .from("projects")
      .select("id, title, creator_id")
      .eq("id", milestone.project_id)
      .maybeSingle();
    if (projectError) throw new Error(projectError.message);
    if (!project) return json({ error: "Project not found" }, 404);
    if (project.creator_id === userData.user.id) {
      return json({ error: "The project owner is paid by someone else" }, 400);
    }

    const destination = await verifiedDestination(admin, project.creator_id);
    if (!destination) {
      return json({
        needs_connect: true,
        error: "The project owner needs to finish payout setup in Wallet before this can be paid.",
      });
    }

    const amountCents = Math.round(amount * 100);
    const stripe = testStripe();
    const origin = req.headers.get("origin") || "";
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: userData.user.email || undefined,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: (milestone.currency || "usd").toLowerCase(),
          unit_amount: amountCents,
          product_data: { name: `${project.title}: ${milestone.title}` },
        },
      }],
      success_url: `${origin}/projects?paid=1`,
      cancel_url: `${origin}/projects?paid=0`,
      metadata: {
        type: "project_payment",
        milestone_id: milestone.id,
        project_id: project.id,
        creator_id: project.creator_id,
        payer_id: userData.user.id,
        fee_percent: String(COMMUNITY_FUND_FEE_PERCENT),
      },
      payment_intent_data: destinationCharge(destination, amountCents),
    });

    return json({ url: session.url, fee_percent: COMMUNITY_FUND_FEE_PERCENT });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
