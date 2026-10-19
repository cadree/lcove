// This file re-exports the app client. Regenerate database types with
// `supabase gen types` (see README). Do not replace this file with a client
// that stores the session in localStorage.
// Native session storage lives in src/lib/supabaseClient.ts. vite.config.ts
// and tsconfig.app.json resolve this import path to that file, so replacing
// this module does not put login back on localStorage. If a replacement also
// removes those aliases, restore them. See docs/ios-release.md.
export { supabase } from "@/lib/supabaseClient";
