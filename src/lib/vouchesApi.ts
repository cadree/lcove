import { supabase } from "@/integrations/supabase/client";
import { callRpc } from "@/lib/rpc";
import type { ProfileVouches, WrapUp } from "@/lib/vouches";

interface Untyped {
  from: (table: string) => {
    delete: () => { eq: (column: string, value: string) => Promise<{ error: { message: string } | null }> };
  };
}
// project_vouches is newer than the generated types.
const db = supabase as unknown as Untyped;

export const vouchesApi = {
  wrapUp: (projectId: string) => callRpc<WrapUp>("project_wrap_up", { p_project: projectId }),
  forProfile: (userId: string) => callRpc<ProfileVouches>("profile_vouches", { p_user: userId }),
  vouch: (projectId: string, userId: string, note: string | null) =>
    callRpc<{ id: string; note: string | null; created_at: string }>("vouch_for", { p_project: projectId, p_subject: userId, p_note: note }),
  /** Authors only (RLS). */
  async remove(vouchId: string): Promise<void> {
    const { error } = await db.from("project_vouches").delete().eq("id", vouchId);
    if (error) throw new Error(error.message);
  },
};
