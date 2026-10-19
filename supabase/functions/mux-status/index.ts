import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const configured = Boolean(Deno.env.get("MUX_TOKEN_ID") && Deno.env.get("MUX_TOKEN_SECRET"));

  return new Response(JSON.stringify({ configured }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
