import { supabase } from "@/integrations/supabase/client";
import { callRpc } from "@/lib/rpc";
import { parseSendResult, parseTargets, type InviteKind, type InviteTarget, type SendResult } from "@/lib/itemInvite";

export async function loadInviteTargets(inviteeId: string, kind: InviteKind): Promise<InviteTarget[]> {
  const raw = await callRpc<unknown>("item_invite_targets", { p_invitee: inviteeId, p_kind: kind });
  return parseTargets(raw);
}

/** Invite, then ask the push and email senders to deliver the stored notice. */
export async function sendItemInvite(kind: InviteKind, itemId: string, inviteeId: string): Promise<SendResult> {
  const result = parseSendResult(await callRpc<unknown>("send_item_invite", { p_kind: kind, p_item: itemId, p_invitee: inviteeId }));
  if (result.status === "sent" && result.notified && result.id) {
    // Both functions rebuild the copy from the stored invite and refuse anything else.
    const body = { user_id: inviteeId, notification_type: "item_invite", title: "Invite", data: { invite_id: result.id } };
    void supabase.functions.invoke("send-push-notification", { body }).catch(() => undefined);
    void supabase.functions.invoke("send-notification-email", { body }).catch(() => undefined);
  }
  return result;
}

export async function respondItemInvite(inviteId: string, accept: boolean): Promise<{ status: string; path: string | null }> {
  const raw = await callRpc<{ status?: string; path?: string } | null>("respond_item_invite", { p_invite: inviteId, p_accept: accept });
  const path = typeof raw?.path === "string" && /^\/(project|event)\/[0-9a-f-]{36}$/i.test(raw.path) ? raw.path : null;
  return { status: raw?.status ?? (accept ? "accepted" : "declined"), path };
}
