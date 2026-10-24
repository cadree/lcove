import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import {
  invoiceSubscriptionId,
  isGrantEligible,
  mapMembershipStatus,
  subscriptionPeriodUnix,
  tierFromStripeSubscription,
} from "../_shared/membership-products.mjs";
import { assertStripeTestKey } from "../_shared/stripe-mode.mjs";
import { httpStatusForError } from "../_shared/http-error.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-MEMBERSHIP] ${step}${detailsStr}`);
};

function isoPeriod(sub: object) {
  const period = subscriptionPeriodUnix(sub);
  return {
    start: period.start ? new Date(period.start * 1000).toISOString() : null,
    end: period.end ? new Date(period.end * 1000).toISOString() : null,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const stripeKey = assertStripeTestKey(Deno.env.get("STRIPE_SECRET_KEY"));

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId = customers.data[0]?.id || null;
    if (!customerId) {
      const { data: storedMembership } = await supabaseClient
        .from("memberships")
        .select("stripe_customer_id")
        .eq("user_id", user.id)
        .maybeSingle();
      customerId = storedMembership?.stripe_customer_id || null;
      logStep("No Stripe customer for this email", { storedCustomerId: customerId });
    }

    if (!customerId) {
      logStep("No Stripe customer found");
      return new Response(JSON.stringify({ 
        subscribed: false,
        tier: null,
        subscription_end: null,
        monthly_amount: null,
        lifetime_contribution: 0,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    logStep("Found Stripe customer", { customerId });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 20,
    });

    const membershipSubs = subscriptions.data.filter((sub) => tierFromStripeSubscription(sub));
    const rank = (status: string) => {
      if (status === "active" || status === "trialing") return 0;
      if (status === "past_due" || status === "unpaid") return 1;
      return 2;
    };
    membershipSubs.sort((a, b) => rank(a.status) - rank(b.status));
    const membershipSub = membershipSubs[0] ?? null;
    const tier = membershipSub ? tierFromStripeSubscription(membershipSub) : null;

    if (!membershipSub || !tier) {
      logStep("No membership subscription found");
      const { data: existingMembership } = await supabaseClient
        .from("memberships")
        .select("lifetime_contribution")
        .eq("user_id", user.id)
        .maybeSingle();
      await supabaseClient
        .from("memberships")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .in("status", ["active", "trialing", "past_due"]);
      return new Response(JSON.stringify({ 
        subscribed: false,
        tier: null,
        subscription_end: null,
        monthly_amount: null,
        lifetime_contribution: Number(existingMembership?.lifetime_contribution || 0),
        cancel_at_period_end: false,
        status: "cancelled",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const membershipStatus = mapMembershipStatus(membershipSub, "customer.subscription.updated");
    const subscribed = membershipStatus === "active" || membershipStatus === "trialing";
    const monthlyAmount = (membershipSub.items.data[0]?.price?.unit_amount || 0) / 100;

    const period = isoPeriod(membershipSub);

    if (!subscribed) {
      logStep("Membership is not active", { status: membershipSub.status, tier });
      const { data: existingMembership } = await supabaseClient
        .from("memberships")
        .select("lifetime_contribution")
        .eq("user_id", user.id)
        .maybeSingle();
      await supabaseClient
        .from("memberships")
        .update({
          tier,
          status: membershipStatus,
          stripe_customer_id: customerId,
          stripe_subscription_id: membershipSub.id,
          current_period_start: period.start,
          current_period_end: period.end,
          monthly_amount: monthlyAmount,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);
      return new Response(JSON.stringify({
        subscribed: false,
        tier: null,
        subscription_end: period.end,
        monthly_amount: monthlyAmount,
        lifetime_contribution: Number(existingMembership?.lifetime_contribution || 0),
        cancel_at_period_end: membershipSub.cancel_at_period_end,
        status: membershipStatus,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const subscriptionEnd = period.end;
    logStep("Active membership found", { tier, subscriptionEnd, monthlyAmount });

    // Calculate lifetime contribution from invoices
    const invoices = await stripe.invoices.list({
      customer: customerId,
      status: "paid",
      limit: 100,
    });

    const { data: existingMembership } = await supabaseClient
      .from("memberships")
      .select("lifetime_contribution")
      .eq("user_id", user.id)
      .maybeSingle();
    const storedLifetime = Number(existingMembership?.lifetime_contribution || 0);

    let lifetimeContribution = 0;
    for (const invoice of invoices.data) {
      // Only count membership invoices. Basil moved this id under parent.
      if (invoiceSubscriptionId(invoice) === membershipSub.id) {
        lifetimeContribution += (invoice.amount_paid || 0) / 100;
      }
    }
    const { data: refundRows, error: refundError } = await supabaseClient
      .from("membership_payment_refunds")
      .select("amount")
      .eq("stripe_subscription_id", membershipSub.id);
    if (refundError) throw new Error(refundError.message);
    const refunded = (refundRows || []).reduce((sum, row) => sum + Number(row.amount || 0), 0);
    // A refund already lowered the stored total. Paid invoices still report
    // amount_paid, so do not raise the stored total back over the refund.
    if (refunded > 0) {
      lifetimeContribution = storedLifetime;
    } else if (lifetimeContribution < storedLifetime) {
      lifetimeContribution = storedLifetime;
    }

    // Upsert membership record in database
    const { error: upsertError } = await supabaseClient
      .from("memberships")
      .upsert({
        user_id: user.id,
        tier,
        status: membershipStatus,
        stripe_customer_id: customerId,
        stripe_subscription_id: membershipSub.id,
        current_period_start: period.start,
        current_period_end: subscriptionEnd,
        monthly_amount: monthlyAmount,
        lifetime_contribution: lifetimeContribution,
        grant_eligible: isGrantEligible(lifetimeContribution),
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    if (upsertError) {
      logStep("Error upserting membership", { error: upsertError.message });
    }

    return new Response(JSON.stringify({
      subscribed: true,
      tier,
      subscription_end: subscriptionEnd,
      monthly_amount: monthlyAmount,
      lifetime_contribution: lifetimeContribution,
      grant_eligible: isGrantEligible(lifetimeContribution),
      stripe_subscription_id: membershipSub.id,
      cancel_at_period_end: membershipSub.cancel_at_period_end,
      status: membershipStatus,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: httpStatusForError(error),
    });
  }
});
