import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[VERIFY-CONTRIBUTION] ${step}`, details ? JSON.stringify(details) : '');
};

// Daily and weekly earning caps
const DAILY_CAP = 200;
const WEEKLY_CAP = 1000;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    // Authenticate verifier
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const verifier = userData.user;
    if (!verifier?.id) throw new Error("User not authenticated");

    const { contribution_id, action, amount_override } = await req.json();
    
    if (!contribution_id) throw new Error("Contribution ID required");
    if (!action || !['verify', 'reject'].includes(action)) {
      throw new Error("Action must be 'verify' or 'reject'");
    }

    logStep("Verification request", { contributionId: contribution_id, action, verifierId: verifier.id });

    // Get the contribution
    const { data: contribution, error: contribError } = await supabaseClient
      .from('credit_contributions')
      .select('*')
      .eq('id', contribution_id)
      .single();

    if (contribError || !contribution) {
      throw new Error("Contribution not found");
    }

    if (contribution.status !== 'pending') {
      throw new Error(`Contribution already ${contribution.status}`);
    }

    // Check verifier has permission
    let hasPermission = false;

    // Check if admin
    const { data: adminRole } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', verifier.id)
      .eq('role', 'admin')
      .single();

    if (adminRole) {
      hasPermission = true;
      logStep("Admin permission granted");
    }

    // Check if project owner
    if (!hasPermission && contribution.reference_type === 'project' && contribution.reference_id) {
      const { data: project } = await supabaseClient
        .from('projects')
        .select('creator_id')
        .eq('id', contribution.reference_id)
        .single();

      if (project?.creator_id === verifier.id) {
        hasPermission = true;
        logStep("Project owner permission granted");
      }
    }

    // Check if event creator
    if (!hasPermission && contribution.reference_type === 'event' && contribution.reference_id) {
      const { data: event } = await supabaseClient
        .from('events')
        .select('creator_id')
        .eq('id', contribution.reference_id)
        .single();

      if (event?.creator_id === verifier.id) {
        hasPermission = true;
        logStep("Event creator permission granted");
      }
    }

    if (!hasPermission) {
      throw new Error("You don't have permission to verify this contribution");
    }

    if (action === 'reject') {
      // Reject the contribution
      const { error: rejectError } = await supabaseClient
        .from('credit_contributions')
        .update({
          status: 'rejected',
          verified_by: verifier.id,
          verified_at: new Date().toISOString(),
        })
        .eq('id', contribution_id);

      if (rejectError) throw rejectError;

      // Notify the contributor
      await supabaseClient.from('notifications').insert({
        user_id: contribution.user_id,
        type: 'project_invite',
        title: 'Contribution Not Verified',
        body: `Your contribution claim for ${contribution.amount_requested} LC was not verified.`,
        data: { contribution_id, status: 'rejected' }
      });

      return new Response(JSON.stringify({ 
        success: true,
        status: 'rejected',
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Verify and award credits
    const amountToAward = amount_override || contribution.amount_requested;

    // Check rate limits
    const { data: limits, error: limitsError } = await supabaseClient
      .from('credit_earning_limits')
      .select('*')
      .eq('user_id', contribution.user_id)
      .single();

    let currentDaily = 0;
    let currentWeekly = 0;
    let multiplier = 1.0;

    if (limits) {
      const now = new Date();
      const lastDaily = new Date(limits.last_daily_reset);
      const lastWeekly = new Date(limits.last_weekly_reset);

      // Reset daily if more than 24 hours
      if (now.getTime() - lastDaily.getTime() > 24 * 60 * 60 * 1000) {
        currentDaily = 0;
      } else {
        currentDaily = limits.daily_earned;
      }

      // Reset weekly if more than 7 days
      if (now.getTime() - lastWeekly.getTime() > 7 * 24 * 60 * 60 * 1000) {
        currentWeekly = 0;
      } else {
        currentWeekly = limits.weekly_earned;
      }

      multiplier = Number(limits.reputation_multiplier) || 1.0;
    }

    // Apply reputation multiplier and caps
    const adjustedAmount = Math.floor(amountToAward * multiplier);
    const dailyRemaining = DAILY_CAP - currentDaily;
    const weeklyRemaining = WEEKLY_CAP - currentWeekly;
    const cappedAmount = Math.min(adjustedAmount, dailyRemaining, weeklyRemaining);

    if (cappedAmount <= 0) {
      throw new Error("Daily or weekly earning limit reached");
    }

    logStep("Rate limit check", { 
      requested: amountToAward, 
      adjusted: adjustedAmount, 
      capped: cappedAmount,
      dailyRemaining,
      weeklyRemaining,
      multiplier,
    });

    // Get current balance for balance_after
    const { data: userCredits } = await supabaseClient
      .from('user_credits')
      .select('balance, earned_balance')
      .eq('user_id', contribution.user_id)
      .single();

    const currentBalance = userCredits?.balance || 0;

    // Create ledger entry to award earned credits
    const { error: ledgerError } = await supabaseClient
      .from('credit_ledger')
      .insert({
        user_id: contribution.user_id,
        amount: cappedAmount,
        balance_after: Number(currentBalance) + cappedAmount,
        type: 'earn',
        description: `Verified contribution: ${contribution.description || contribution.contribution_type}`,
        credit_type: 'earned',
        genesis_amount: 0,
        earned_amount: cappedAmount,
        reference_type: contribution.reference_type,
        reference_id: contribution.reference_id,
        verified_by: verifier.id,
        verification_type: contribution.contribution_type,
      });

    if (ledgerError) throw ledgerError;

    // Update the contribution record
    const { error: updateError } = await supabaseClient
      .from('credit_contributions')
      .update({
        status: 'verified',
        amount_earned: cappedAmount,
        verified_by: verifier.id,
        verified_at: new Date().toISOString(),
      })
      .eq('id', contribution_id);

    if (updateError) throw updateError;

    // Update rate limits
    const now = new Date().toISOString();
    await supabaseClient
      .from('credit_earning_limits')
      .upsert({
        user_id: contribution.user_id,
        daily_earned: currentDaily + cappedAmount,
        weekly_earned: currentWeekly + cappedAmount,
        last_daily_reset: currentDaily === 0 ? now : limits?.last_daily_reset,
        last_weekly_reset: currentWeekly === 0 ? now : limits?.last_weekly_reset,
      }, { onConflict: 'user_id' });

    // Notify the contributor
    await supabaseClient.from('notifications').insert({
      user_id: contribution.user_id,
      type: 'project_invite',
      title: `You earned ${cappedAmount} LC!`,
      body: `Your contribution was verified. You earned ${cappedAmount} Earned Credit.`,
      data: { contribution_id, amount: cappedAmount, status: 'verified' }
    });

    logStep("Contribution verified", { 
      contributionId: contribution_id,
      userId: contribution.user_id,
      amountAwarded: cappedAmount,
    });

    return new Response(JSON.stringify({ 
      success: true,
      status: 'verified',
      amount_awarded: cappedAmount,
      was_capped: cappedAmount < adjustedAmount,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
