import { createClient } from "npm:@supabase/supabase-js@2";
import { DEFAULT_EMAIL_FROM, sendWithResend } from "../_shared/email-queue-dispatch.mjs";
import { handleEmailQueueRequest } from "./handler.ts";

function productionDeps() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!supabaseUrl || !serviceKey || !resendKey) {
    console.error("Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or RESEND_API_KEY");
    return undefined;
  }
  const emailFrom = Deno.env.get("EMAIL_FROM") || DEFAULT_EMAIL_FROM;
  return {
    supabase: createClient(supabaseUrl, serviceKey),
    sendEmail: (payload: Record<string, unknown>) => sendWithResend(resendKey, emailFrom, payload),
  };
}

// Cron calls this with x-internal-secret. verify_jwt is false in config.toml.
Deno.serve((req) => handleEmailQueueRequest(req, productionDeps()));
