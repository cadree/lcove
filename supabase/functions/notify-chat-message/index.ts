import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jwtSubject, requestRole, requireUserOrService } from "../_shared/require-caller.ts";
import { chatAlertChannels } from "../_shared/project-collaborations.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function chatEmailHtml(senderName: string, preview: string, conversationId: string): string {
  const link = `https://etherbylcove.com/messages?chat=${conversationId}`;
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#1a1a1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a1a;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#2a2520;border-radius:16px;">
        <tr><td style="padding:40px;text-align:center;">
          <h1 style="color:#fff;font-size:22px;margin:0 0 16px;">New messages from ${escapeHtml(senderName)}</h1>
          <p style="color:#a0a0a0;font-size:16px;line-height:1.6;margin:0 0 24px;">${escapeHtml(preview)}</p>
          <p style="color:#888;font-size:13px;margin:0 0 24px;">Further messages in this chat are grouped for 15 minutes so you get one email, not one per message.</p>
          <a href="${link}" style="display:inline-block;background:#E91E63;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;">Open chat</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const denied = requireUserOrService(req, corsHeaders);
  if (denied) return denied;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const conversationId = String(body.conversation_id ?? "");
    const messageId = String(body.message_id ?? "");
    if (!conversationId || !messageId) {
      return new Response(JSON.stringify({ error: "conversation_id and message_id are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: message, error: messageError } = await supabase
      .from("messages")
      .select("id, conversation_id, sender_id, content, media_type")
      .eq("id", messageId)
      .eq("conversation_id", conversationId)
      .is("deleted_at", null)
      .maybeSingle();

    if (messageError || !message) {
      return new Response(JSON.stringify({ error: "Message not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const role = requestRole(req);
    const callerId = jwtSubject(req.headers.get("Authorization"));
    if (role !== "service_role" && message.sender_id !== callerId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: participants, error: participantError } = await supabase
      .from("conversation_participants")
      .select("user_id, is_muted")
      .eq("conversation_id", conversationId);

    if (participantError) throw participantError;

    const callerIsMember = (participants ?? []).some((row) => row.user_id === message.sender_id);
    if (!callerIsMember) {
      return new Response(JSON.stringify({ error: "Sender is not a member of this chat" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: senderProfile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", message.sender_id)
      .maybeSingle();
    const senderName = senderProfile?.display_name || "Someone";
    const preview = message.content
      ? String(message.content).slice(0, 140)
      : message.media_type === "video"
        ? "Sent a video"
        : message.media_type === "image"
          ? "Sent a photo"
          : "Sent a message";

    const { data: conversation } = await supabase
      .from("conversations")
      .select("name")
      .eq("id", conversationId)
      .maybeSingle();
    const chatName = conversation?.name || "your chat";

    let inApp = 0;
    let push = 0;
    let email = 0;

    for (const participant of participants ?? []) {
      if (participant.user_id === message.sender_id) continue;

      const { data: prefs } = await supabase
        .from("notification_preferences")
        .select("messages_enabled, push_enabled, email_enabled")
        .eq("user_id", participant.user_id)
        .maybeSingle();

      const channels = chatAlertChannels({
        isSender: false,
        isMuted: participant.is_muted === true,
        messagesEnabled: prefs?.messages_enabled ?? true,
        pushEnabled: prefs?.push_enabled ?? true,
        emailEnabled: prefs?.email_enabled ?? true,
      });

      if (channels.inApp) {
        await supabase.from("notifications").insert({
          user_id: participant.user_id,
          type: "message",
          title: senderName,
          body: preview,
          data: { conversation_id: conversationId, message_id: messageId },
        });
        inApp += 1;
      }

      if (channels.push) {
        const { error: pushError } = await supabase.functions.invoke("send-push-notification", {
          body: {
            user_id: participant.user_id,
            title: senderName,
            body: preview,
            notification_type: "message",
            url: `/messages?chat=${conversationId}`,
            data: { conversation_id: conversationId, message_id: messageId },
          },
        });
        if (!pushError) push += 1;
      }

      if (channels.email) {
        const { data: userData } = await supabase.auth.admin.getUserById(participant.user_id);
        const recipient = userData?.user?.email;
        if (!recipient) continue;

        const { data: claimed, error: claimError } = await supabase.rpc("claim_chat_email_window", {
          p_user_id: participant.user_id,
          p_conversation_id: conversationId,
        });
        if (claimError || claimed !== true) continue;

        const messageKey = `chat-${conversationId}-${participant.user_id}-${Math.floor(Date.now() / (15 * 60 * 1000))}`;
        const { error: enqueueError } = await supabase.rpc("enqueue_email", {
          queue_name: "transactional_emails",
          payload: {
            message_id: messageKey,
            to: recipient,
            subject: `New messages in ${chatName}`,
            html: chatEmailHtml(senderName, preview, conversationId),
            text: `${senderName}: ${preview}\n\nOpen https://etherbylcove.com/messages?chat=${conversationId}`,
            purpose: "transactional",
            label: "chat-digest",
            idempotency_key: messageKey,
            queued_at: new Date().toISOString(),
          },
        });
        if (enqueueError) {
          console.error("chat email enqueue failed", enqueueError);
          continue;
        }
        email += 1;
      }
    }

    return new Response(JSON.stringify({ success: true, inApp, push, email }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("notify-chat-message failed", error);
    return new Response(JSON.stringify({ error: "Failed to notify chat members" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
