import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[TRANSFER-CREDITS] ${step}`, details ? JSON.stringify(details) : '');
};

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

    // Authenticate sender
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const sender = userData.user;
    if (!sender?.id) throw new Error("User not authenticated");

    const { recipient_id, amount, message } = await req.json();
    
    if (!recipient_id) throw new Error("Recipient ID required");
    if (!amount || amount <= 0) throw new Error("Invalid amount");
    if (recipient_id === sender.id) throw new Error("Cannot transfer to yourself");

    logStep("Transfer request", { senderId: sender.id, recipientId: recipient_id, amount });

    // Get sender's credit balances
    const { data: senderCredits, error: senderError } = await supabaseClient
      .from('user_credits')
      .select('balance, genesis_balance, earned_balance')
      .eq('user_id', sender.id)
      .single();

    if (senderError || !senderCredits) {
      throw new Error("Could not fetch sender credits");
    }

    const genesisBalance = Number(senderCredits.genesis_balance) || 0;
    const earnedBalance = Number(senderCredits.earned_balance) || 0;
    const totalBalance = genesisBalance + earnedBalance;

    logStep("Sender balances", { genesisBalance, earnedBalance, totalBalance, requested: amount });

    if (totalBalance < amount) {
      throw new Error(`Insufficient balance. You have ${totalBalance} LC but tried to send ${amount} LC.`);
    }

    // Calculate how much to take from each pool (Genesis first, then Earned)
    let genesisToSpend = 0;
    let earnedToSpend = 0;

    if (genesisBalance >= amount) {
      // All from Genesis
      genesisToSpend = amount;
    } else {
      // Use all Genesis, remainder from Earned
      genesisToSpend = genesisBalance;
      earnedToSpend = amount - genesisBalance;
    }

    logStep("Credit allocation", { genesisToSpend, earnedToSpend });

    // Verify recipient exists
    const { data: recipientProfile, error: recipientError } = await supabaseClient
      .from('profiles')
      .select('user_id, display_name')
      .eq('user_id', recipient_id)
      .single();

    if (recipientError || !recipientProfile) {
      throw new Error("Recipient not found");
    }

    // Get current balances for balance_after calculations
    const { data: recipientCredits } = await supabaseClient
      .from('user_credits')
      .select('balance, earned_balance')
      .eq('user_id', recipient_id)
      .single();

    const recipientCurrentBalance = recipientCredits?.balance || 0;

    // Create sender's debit ledger entry
    // If spending Genesis, it gets burned (sender loses Genesis, recipient gets Earned)
    if (genesisToSpend > 0) {
      const { error: genesisDebitError } = await supabaseClient
        .from('credit_ledger')
        .insert({
          user_id: sender.id,
          amount: -genesisToSpend,
          balance_after: totalBalance - genesisToSpend,
          type: 'transfer_out',
          description: message || `Sent ${genesisToSpend} LC to ${recipientProfile.display_name || 'user'}`,
          credit_type: 'genesis',
          genesis_amount: -genesisToSpend,
          earned_amount: 0,
          reference_type: 'transfer',
          reference_id: recipient_id,
        });

      if (genesisDebitError) {
        logStep("Genesis debit failed", { error: genesisDebitError.message });
        throw genesisDebitError;
      }
    }

    if (earnedToSpend > 0) {
      const { error: earnedDebitError } = await supabaseClient
        .from('credit_ledger')
        .insert({
          user_id: sender.id,
          amount: -earnedToSpend,
          balance_after: totalBalance - amount,
          type: 'transfer_out',
          description: message || `Sent ${earnedToSpend} LC to ${recipientProfile.display_name || 'user'}`,
          credit_type: 'earned',
          genesis_amount: 0,
          earned_amount: -earnedToSpend,
          reference_type: 'transfer',
          reference_id: recipient_id,
        });

      if (earnedDebitError) {
        logStep("Earned debit failed", { error: earnedDebitError.message });
        throw earnedDebitError;
      }
    }

    // Get sender profile for notification
    const { data: senderProfile } = await supabaseClient
      .from('profiles')
      .select('display_name')
      .eq('user_id', sender.id)
      .single();

    // Create recipient's credit ledger entry - ALWAYS Earned (Genesis burns, mints Earned)
    const { error: creditError } = await supabaseClient
      .from('credit_ledger')
      .insert({
        user_id: recipient_id,
        amount: amount,
        balance_after: Number(recipientCurrentBalance) + amount,
        type: 'transfer_in',
        description: message || `Received ${amount} LC from ${senderProfile?.display_name || 'user'}`,
        credit_type: 'earned',
        genesis_amount: 0,
        earned_amount: amount,
        reference_type: 'transfer',
        reference_id: sender.id,
      });

    if (creditError) {
      logStep("Credit entry failed", { error: creditError.message });
      throw creditError;
    }

    // Create notification for recipient
    await supabaseClient.from('notifications').insert({
      user_id: recipient_id,
      type: 'project_invite',
      title: `You received ${amount} LC!`,
      body: message || `${senderProfile?.display_name || 'Someone'} sent you ${amount} LC Credit.`,
      data: { 
        amount, 
        sender_id: sender.id,
        genesis_burned: genesisToSpend,
      }
    });

    logStep("Transfer complete", { 
      senderId: sender.id, 
      recipientId: recipient_id, 
      amount,
      genesisBurned: genesisToSpend,
      earnedSpent: earnedToSpend,
    });

    return new Response(JSON.stringify({ 
      success: true,
      amount_transferred: amount,
      genesis_burned: genesisToSpend,
      earned_spent: earnedToSpend,
      recipient_name: recipientProfile.display_name,
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
