import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type PostInsert = Database["public"]["Tables"]["posts"]["Insert"];

/**
 * Inserts a post. If the database doesn't have the cover column yet (the app
 * shipped before 20261114150000 ran), the post still goes up without a cover.
 */
export async function insertPostRow(row: PostInsert) {
  const first = await supabase.from("posts").insert(row);
  if (first.error && row.thumbnail_url !== undefined && /thumbnail_url/.test(first.error.message ?? "")) {
    const { thumbnail_url: _cover, ...rest } = row;
    return supabase.from("posts").insert(rest);
  }
  return first;
}
