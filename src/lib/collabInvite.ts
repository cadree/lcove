import { toast } from "sonner";
import { callRpc } from "@/lib/rpc";
import { shotSessionEnabled } from "@/lib/shotSession";

export async function sendCollabInvite(recipientId: string) {
  if (!recipientId) return;
  if (shotSessionEnabled()) {
    toast.success("Invite sent");
    return;
  }
  await callRpc("send_collab_invite", { p_recipient: recipientId });
  toast.success("Invite sent");
}

export async function respondCollabInvite(inviteId: string, accept: boolean) {
  return callRpc<{ status: string; conversation_id?: string | null }>("respond_collab_invite", {
    p_invite_id: inviteId,
    p_accept: accept,
  });
}
