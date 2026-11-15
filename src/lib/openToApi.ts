import { supabase } from "@/integrations/supabase/client";
import { callRpc } from "@/lib/rpc";
import type { OpenToRow } from "@/lib/openTo";

type Result<T> = Promise<{ data: T | null; error: { message: string } | null }>;
interface Untyped {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => { maybeSingle: () => Result<OpenToRow> };
    } & Result<OpenToRow[]>;
  };
}
// profile_open_to is newer than the generated types.
const db = supabase as unknown as Untyped;
const COLUMNS = "user_id, tags, until, updated_at";

export const openToApi = {
  /** Everyone's current tags the viewer may see (RLS drops expired and blocked rows). */
  async all(): Promise<OpenToRow[]> {
    const { data, error } = await db.from("profile_open_to").select(COLUMNS);
    if (error) throw new Error(error.message);
    return data || [];
  },
  async forUser(userId: string): Promise<OpenToRow | null> {
    const { data, error } = await db.from("profile_open_to").select(COLUMNS).eq("user_id", userId).maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },
  /** An empty list clears the tags. */
  save: (tags: string[], until: string | null) =>
    callRpc<{ tags: string[]; until: string | null; last_day: string | null }>("set_open_to", { p_tags: tags, p_until: until }),
};
