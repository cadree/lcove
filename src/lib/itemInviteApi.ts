import { supabase } from "@/integrations/supabase/client";
import { callRpc } from "@/lib/rpc";
import {
  parseInviteCard,
  parseSendResult,
  parseTargets,
  safeInvitePath,
  type InviteCardData,
  type InviteKind,
  type InviteTarget,
  type SendResult,
} from "@/lib/itemInvite";

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
  return { status: raw?.status ?? (accept ? "accepted" : "declined"), path: safeInvitePath(raw?.path) };
}

export async function loadInviteCard(inviteId: string): Promise<InviteCardData | null> {
  return parseInviteCard(await callRpc<unknown>("item_invite_card", { p_invite: inviteId }));
}

export interface InviteApplyResult {
  status: "pending" | "accepted";
  applicationId: string | null;
  chatId: string | null;
  already: boolean;
}

/**
 * Apply for a role through an invite. An invite from the project owner is
 * accepted on the spot (the database adds her to the project chat); otherwise
 * it is a pending application and the owner hears about it as usual.
 */
export async function applyWithInvite(inviteId: string, projectId: string, roleId: string, message: string | null): Promise<InviteApplyResult> {
  const raw = await callRpc<Record<string, unknown> | null>("item_invite_apply", { p_invite: inviteId, p_role: roleId, p_message: message });
  const result: InviteApplyResult = {
    status: raw?.status === "accepted" ? "accepted" : "pending",
    applicationId: typeof raw?.application_id === "string" ? raw.application_id : null,
    chatId: typeof raw?.chat_id === "string" ? raw.chat_id : null,
    already: raw?.already === true,
  };
  if (result.status === "pending" && !result.already && result.applicationId) {
    void supabase.functions.invoke("notify-new-application", { body: { project_id: projectId } }).catch(() => undefined);
  }
  return result;
}
