import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import {
  ensureExpressAccount,
  loadProfileConnect,
  syncPayoutEnabled,
  testStripe,
} from "../_shared/creator-connect.mjs";
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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    );
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Not authenticated" }, 401);
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user?.email) return json({ error: "Not authenticated" }, 401);
    const user = userData.user;

    const { action } = await req.json().catch(() => ({ action: "status" }));
    const stripe = testStripe();
    const origin = req.headers.get("origin") || "";

    if (action === "onboard") {
      const accountId = await ensureExpressAccount(stripe, admin, user);
      const link = await stripe.accountLinks.create({
        account: accountId,
        type: "account_onboarding",
        refresh_url: `${origin}/wallet?connect=refresh`,
        return_url: `${origin}/wallet?connect=success`,
      });
      return json({ url: link.url, accountId });
    }

    const profile = await loadProfileConnect(admin, user.id);
    if (!profile?.stripe_connect_account_id) {
      return json({
        status: "pending",
        accountId: null,
        charges_enabled: false,
        payouts_enabled: false,
        details_submitted: false,
        transfers_active: false,
        can_accept_charges: false,
        currently_due: [],
        disabled_reason: null,
      });
    }

    if (action === "dashboard") {
      const link = await stripe.accounts.createLoginLink(profile.stripe_connect_account_id);
      return json({ url: link.url });
    }

    const state = await syncPayoutEnabled(stripe, admin, user.id, profile.stripe_connect_account_id);
    return json(state);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json({ error: message }, httpStatusForError(error));
  }
});
