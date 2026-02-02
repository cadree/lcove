import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Authentication failed");

    const user = userData.user;
    const { stream_id, amount, message } = await req.json();

    if (!stream_id || !amount || amount < 1) {
      throw new Error("Invalid tip amount");
    }

    console.log(`[TIP-STREAM] User ${user.id} tipping ${amount} LC to stream ${stream_id}`);

    // Get stream info
    const { data: stream, error: streamError } = await supabaseClient
      .from("live_streams")
      .select("host_id, title")
      .eq("id", stream_id)
      .single();

    if (streamError || !stream) throw new Error("Stream not found");

    // Check user's credit balance
    const { data: credits } = await supabaseClient
      .from("user_credits")
      .select("balance")
      .eq("user_id", user.id)
      .single();

    const balance = credits?.balance || 0;
    if (balance < amount) {
      throw new Error("Insufficient credits");
    }

    // Deduct from tipper
    const { error: deductError } = await supabaseClient
      .from("credit_ledger")
      .insert({
        user_id: user.id,
        amount: -amount,
        balance_after: balance - amount,
        type: "spend",
        description: `Tip to stream: ${stream.title}`,
        reference_type: "stream_tip",
        reference_id: stream_id,
      });

    if (deductError) throw deductError;

    // Get host's current balance
    const { data: hostCredits } = await supabaseClient
      .from("user_credits")
      .select("balance")
      .eq("user_id", stream.host_id)
      .single();

    const hostBalance = hostCredits?.balance || 0;

    // Add to host
    const { error: addError } = await supabaseClient
      .from("credit_ledger")
      .insert({
        user_id: stream.host_id,
        amount: amount,
        balance_after: hostBalance + amount,
        type: "earn",
        description: `Tip received on stream`,
        reference_type: "stream_tip",
        reference_id: stream_id,
      });

    if (addError) throw addError;

    // Record the tip
    const { error: tipError } = await supabaseClient
      .from("stream_tips")
      .insert({
        stream_id,
        tipper_id: user.id,
        host_id: stream.host_id,
        amount,
        message,
      });

    if (tipError) throw tipError;

    // Update stream total tips using RPC to avoid race conditions
    const { error: updateError } = await supabaseClient.rpc('increment_stream_tips', {
      p_stream_id: stream_id,
      p_tip_amount: amount
    });

    // Create notification for host
    await supabaseClient.from("notifications").insert({
      user_id: stream.host_id,
      type: "stream_tip",
      title: "You received a tip!",
      body: `Someone tipped you ${amount} LC on your stream`,
      data: { stream_id, amount },
    });

    console.log(`[TIP-STREAM] Successfully processed tip`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[TIP-STREAM] Error:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
