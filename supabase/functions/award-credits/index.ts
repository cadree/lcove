import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  console.log(`[AWARD-CREDITS] ${step}`, details ? JSON.stringify(details) : '');
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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.id) throw new Error("User not authenticated");

    const { target_user_id, amount, description, reference_type, reference_id } = await req.json();
    
    // Determine target user - defaults to authenticated user
    const targetUserId = target_user_id || user.id;
    
    // If awarding to a different user, verify caller is an admin
    if (target_user_id && target_user_id !== user.id) {
      logStep("Checking admin permission for awarding to another user");
      
      const { data: adminRole, error: roleError } = await supabaseClient
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .single();
      
      if (roleError || !adminRole) {
        logStep("Unauthorized: User is not an admin", { userId: user.id });
        throw new Error("Unauthorized: Only admins can award credits to other users");
      }
      
      logStep("Admin permission verified", { adminId: user.id, targetUserId: target_user_id });
    }
    
    if (!amount || amount <= 0) throw new Error("Invalid amount");
    if (!description) throw new Error("Description required");

    // Get current balance
    const { data: credits } = await supabaseClient
      .from('user_credits')
      .select('balance')
      .eq('user_id', targetUserId)
      .single();

    const currentBalance = credits?.balance || 0;
    const newBalance = currentBalance + amount;

    // Create ledger entry (trigger will update user_credits)
    // Admin awards are always Earned credit, not Genesis
    const { data: ledgerEntry, error: ledgerError } = await supabaseClient
      .from('credit_ledger')
      .insert({
        user_id: targetUserId,
        amount,
        balance_after: newBalance,
        type: 'earn',
        description,
        reference_type,
        reference_id,
        credit_type: 'earned',
        genesis_amount: 0,
        earned_amount: amount,
      })
      .select()
      .single();

    if (ledgerError) throw ledgerError;

    logStep("Credits awarded", { 
      userId: targetUserId, 
      amount, 
      newBalance,
      ledgerId: ledgerEntry.id 
    });

    // Create notification
    await supabaseClient.from('notifications').insert({
      user_id: targetUserId,
      type: 'project_invite', // Using existing type
      title: `You earned ${amount} LC Credits!`,
      body: description,
      data: { amount, reference_type, reference_id }
    });

    return new Response(JSON.stringify({ 
      success: true,
      ledger_id: ledgerEntry.id,
      new_balance: newBalance
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
