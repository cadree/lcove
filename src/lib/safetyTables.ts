import { supabase } from "@/integrations/supabase/client";

// content_reports is created in a migration after the generated Database type.
// Keep the generated client and types files untouched so Lovable can regenerate them.
export function fromUntyped(table: "content_reports") {
  return (supabase as unknown as { from: (table: string) => any }).from(table);
}
