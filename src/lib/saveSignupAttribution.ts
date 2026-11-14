import { supabase } from "@/integrations/supabase/client";
import { logAuthError } from "@/lib/authDebug";
import {
  readStoredAttribution,
  SIGNUP_ATTRIBUTION_KEY,
  type SignupAttribution,
} from "@/lib/signupAttribution";

export async function saveSignupAttribution(userId: string) {
  const record: SignupAttribution | null = readStoredAttribution(window.localStorage);
  if (!record) return;
  const { error } = await supabase
    .from("profiles")
    .update({ signup_attribution: record })
    .eq("user_id", userId);
  if (error) {
    logAuthError("Signup attribution was not saved", error);
    return;
  }
  window.localStorage.removeItem(SIGNUP_ATTRIBUTION_KEY);
}
