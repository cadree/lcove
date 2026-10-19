import { createClient } from "@supabase/supabase-js";
import { Capacitor } from "@capacitor/core";
import { capacitorStorage } from "@/lib/capacitorStorage";
import type { Database } from "@/integrations/supabase/types";

// Vite inlines VITE_* from the process environment and from a local .env file.
// Hosted builds must set these in the host's environment settings.
// See .env.example and docs/hosting-without-lovable.md.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Detect if running on native platform (iOS/Android)
const isNative = Capacitor.isNativePlatform();

// Log platform detection for debugging
console.log("[Supabase Client] Platform:", Capacitor.getPlatform(), "isNative:", isNative);

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    // Use Capacitor Preferences on native, localStorage on web
    storage: isNative ? capacitorStorage : localStorage,
    persistSession: true,
    autoRefreshToken: true,
    // Disable URL session detection on native - auth comes through deep links
    detectSessionInUrl: !isNative,
    // Use PKCE flow for better mobile security
    flowType: "pkce",
  },
});
