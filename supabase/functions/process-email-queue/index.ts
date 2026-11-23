import { createClient } from "npm:@supabase/supabase-js@2";
import { DEFAULT_EMAIL_FROM, sendWithResend } from "../_shared/email-queue-dispatch.mjs";
import { handleEmailQueueRequest } from "./handler.ts";
import { assertMemberApplicationPushDelivered } from "../_shared/member-application-push.mjs";

function productionDeps() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!supabaseUrl || !serviceKey || !resendKey) {
    console.error("Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or RESEND_API_KEY");
    return undefined;
  }
  const emailFrom = Deno.env.get("EMAIL_FROM") || DEFAULT_EMAIL_FROM;
  const supabase = createClient(supabaseUrl, serviceKey);
  return {
    supabase,
    sendEmail: (payload: Record<string, unknown>) => sendWithResend(resendKey, emailFrom, payload),
    sendPush: async (payload: Record<string, unknown>) => {
      const { data, error } = await supabase.functions.invoke("send-push-notification", { body: payload });
      if (error) throw error;
      if (data?.error) throw new Error(String(data.error));
      assertMemberApplicationPushDelivered(data);
    },
    deliverPush: async (payload: Record<string, unknown>) => {
      const { data, error } = await supabase.functions.invoke("send-push-notification", { body: payload });
      if (error) throw error;
      return data;
    },
  };
}

// Cron calls this with x-internal-secret. verify_jwt is false in config.toml.
Deno.serve((req) => handleEmailQueueRequest(req, productionDeps()));
