import { supabase } from "@/integrations/supabase/client";
import { callRpc } from "@/lib/rpc";
import type { NearbyCall, OpenCall } from "@/lib/openCalls";

interface Chain extends PromiseLike<{ data: unknown; error: { message: string } | null }> {
  eq: (column: string, value: string) => Chain;
  order: (column: string, options: { ascending: boolean }) => Chain;
}
// project_open_calls is newer than the generated types.
const db = supabase as unknown as { from: (table: string) => { select: (columns: string) => Chain } };

export const openCallsApi = {
  /** Open calls on a project (RLS: whoever can see the project, never across a block). */
  async forProject(projectId: string): Promise<OpenCall[]> {
    const { data, error } = await db.from("project_open_calls")
      .select("id, project_id, role_id, created_by, city_key, city_label, call_date, paid, description, status, created_at")
      .eq("project_id", projectId)
      .eq("status", "open")
      .order("call_date", { ascending: true });
    if (error) throw new Error(error.message);
    return (data as OpenCall[] | null) || [];
  },
  near: (cityKey: string) => callRpc<NearbyCall[]>("open_calls_near", { p_city_key: cityKey }),
  post: (args: {
    projectId: string;
    roleId: string | null;
    roleName: string | null;
    date: string;
    cityKey: string;
    cityLabel: string;
    paid: boolean;
    description: string | null;
  }) =>
    callRpc<{ id: string; role_id: string; listed: boolean }>("post_open_call", {
      p_project: args.projectId,
      p_role: args.roleId,
      p_role_name: args.roleName,
      p_call_date: args.date,
      p_city_key: args.cityKey,
      p_city_label: args.cityLabel,
      p_paid: args.paid,
      p_description: args.description,
    }),
  close: (callId: string) => callRpc<null>("close_open_call", { p_call: callId }),
};
