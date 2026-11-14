import { callRpc } from "@/lib/rpc";
import { shotSessionEnabled } from "@/lib/shotSession";
import { supabase } from "@/integrations/supabase/client";

export async function sendCollabInvite(recipientId: string): Promise<{ status: string }> {
  if (!recipientId) throw new Error("Choose someone");
  if (shotSessionEnabled()) return { status: "pending" };
  const result = await callRpc<{ status?: string }>("send_collab_invite", { p_recipient: recipientId });
  return { status: result?.status || "pending" };
}

export async function listSentCollabInvites(senderId: string): Promise<{ recipient_id: string; status: string }[]> {
  if (shotSessionEnabled()) return [];
  const client = supabase as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => Promise<{
          data: { recipient_id: string; status: string }[] | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
  const { data, error } = await client.from("collab_invites").select("recipient_id, status").eq("sender_id", senderId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function respondCollabInvite(inviteId: string, accept: boolean) {
  return callRpc<{ status: string; conversation_id?: string | null }>("respond_collab_invite", {
    p_invite_id: inviteId,
    p_accept: accept,
  });
}
