// Queue dispatcher for auth_emails and transactional_emails.
// Sends with Resend. Callers pass sendEmail so tests can mock the HTTP call.

import { PLATFORM_QUEUE_FROM, isVerifiedSender, rewriteSenderAddress } from "./host-email-address.mjs";

export const DEFAULT_EMAIL_FROM = PLATFORM_QUEUE_FROM;

export function resolveQueueFrom(fallback, payloadFrom) {
  const candidate = rewriteSenderAddress(typeof payloadFrom === "string" ? payloadFrom.trim() : "");
  if (isVerifiedSender(candidate)) return candidate;
  const fallbackValue = rewriteSenderAddress(typeof fallback === "string" ? fallback.trim() : "");
  return fallbackValue || DEFAULT_EMAIL_FROM;
}

const MAX_RETRIES = 5;
const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_SEND_DELAY_MS = 200;
const DEFAULT_AUTH_TTL_MINUTES = 15;
const DEFAULT_TRANSACTIONAL_TTL_MINUTES = 60;

const jsonHeaders = { "Content-Type": "application/json" };

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function isRateLimited(error) {
  if (error && typeof error === "object" && "status" in error) {
    return error.status === 429;
  }
  return error instanceof Error && error.message.includes("429");
}

function isForbidden(error) {
  if (error && typeof error === "object" && "status" in error) {
    return error.status === 403;
  }
  return error instanceof Error && error.message.includes("403");
}

function getRetryAfterSeconds(error) {
  if (error && typeof error === "object" && "retryAfterSeconds" in error) {
    const value = error.retryAfterSeconds;
    return typeof value === "number" && Number.isFinite(value) ? value : 60;
  }
  return 60;
}

async function moveToDlq(supabase, queue, msg, reason) {
  const payload = msg.message;
  await supabase.from("email_send_log").insert({
    message_id: payload.message_id,
    template_name: payload.label || queue,
    recipient_email: payload.to,
    status: "dlq",
    error_message: reason,
  });
  const { error } = await supabase.rpc("move_to_dlq", {
    source_queue: queue,
    dlq_name: `${queue}_dlq`,
    message_id: msg.msg_id,
    payload,
  });
  if (error) {
    console.error("Failed to move message to DLQ", { queue, msg_id: msg.msg_id, reason, error });
  }
}

async function deleteQueued(supabase, queue, msgId) {
  const { error } = await supabase.rpc("delete_email", {
    queue_name: queue,
    message_id: msgId,
  });
  if (error) {
    console.error("Failed to delete message from queue", { queue, msg_id: msgId, error });
  }
}

async function isSuppressed(supabase, payload) {
  const email = typeof payload.to === "string" ? payload.to.toLowerCase() : "";
  if (!email) return { blocked: true, reason: "missing recipient" };

  const { data: suppressed, error: suppressionError } = await supabase
    .from("suppressed_emails")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (suppressionError) {
    return { error: suppressionError };
  }
  if (suppressed) return { blocked: true, reason: "suppressed" };

  if (typeof payload.unsubscribe_token === "string" && payload.unsubscribe_token) {
    const { data: tokenRow, error: tokenError } = await supabase
      .from("email_unsubscribe_tokens")
      .select("used_at")
      .eq("token", payload.unsubscribe_token)
      .maybeSingle();
    if (tokenError) return { error: tokenError };
    if (tokenRow?.used_at) return { blocked: true, reason: "unsubscribed" };
  }

  return { blocked: false };
}

/**
 * @param {{ supabase: any, sendEmail: (payload: Record<string, unknown>) => Promise<void>, sleep?: (ms: number) => Promise<void> }} deps
 */
export async function runEmailQueue(deps) {
  const { supabase, sendEmail } = deps;
  const sleep = deps.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));

  const { data: state } = await supabase
    .from("email_send_state")
    .select("retry_after_until, batch_size, send_delay_ms, auth_email_ttl_minutes, transactional_email_ttl_minutes")
    .single();

  if (state?.retry_after_until && new Date(state.retry_after_until) > new Date()) {
    return json({ skipped: true, reason: "rate_limited" });
  }

  const batchSize = state?.batch_size ?? DEFAULT_BATCH_SIZE;
  const sendDelayMs = state?.send_delay_ms ?? DEFAULT_SEND_DELAY_MS;
  const ttlMinutes = {
    auth_emails: state?.auth_email_ttl_minutes ?? DEFAULT_AUTH_TTL_MINUTES,
    transactional_emails: state?.transactional_email_ttl_minutes ?? DEFAULT_TRANSACTIONAL_TTL_MINUTES,
  };

  let totalProcessed = 0;

  for (const queue of ["auth_emails", "transactional_emails"]) {
    const { data: messages, error: readError } = await supabase.rpc("read_email_batch", {
      queue_name: queue,
      batch_size: batchSize,
      vt: 30,
    });

    if (readError) {
      console.error("Failed to read email batch", { queue, error: readError });
      continue;
    }

    if (!messages?.length) continue;

    const messageIds = Array.from(
      new Set(
        messages
          .map((msg) =>
            msg?.message?.message_id && typeof msg.message.message_id === "string"
              ? msg.message.message_id
              : null
          )
          .filter((id) => Boolean(id))
      )
    );
    const failedAttemptsByMessageId = new Map();
    if (messageIds.length > 0) {
      const { data: failedRows, error: failedRowsError } = await supabase
        .from("email_send_log")
        .select("message_id")
        .in("message_id", messageIds)
        .eq("status", "failed");

      if (failedRowsError) {
        console.error("Failed to load failed-attempt counters", { queue, error: failedRowsError });
      } else {
        for (const row of failedRows ?? []) {
          const messageId = row?.message_id;
          if (typeof messageId !== "string" || !messageId) continue;
          failedAttemptsByMessageId.set(messageId, (failedAttemptsByMessageId.get(messageId) ?? 0) + 1);
        }
      }
    }

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const payload = msg.message;
      const failedAttempts =
        payload?.message_id && typeof payload.message_id === "string"
          ? (failedAttemptsByMessageId.get(payload.message_id) ?? 0)
          : msg.read_ct ?? 0;

      const queuedAt = payload.queued_at ?? msg.enqueued_at;
      if (queuedAt) {
        const ageMs = Date.now() - new Date(queuedAt).getTime();
        const maxAgeMs = ttlMinutes[queue] * 60 * 1000;
        if (ageMs > maxAgeMs) {
          await moveToDlq(supabase, queue, msg, `TTL exceeded (${ttlMinutes[queue]} minutes)`);
          continue;
        }
      }

      if (failedAttempts >= MAX_RETRIES) {
        await moveToDlq(
          supabase,
          queue,
          msg,
          `Max retries (${MAX_RETRIES}) exceeded (attempted ${failedAttempts} times)`
        );
        continue;
      }

      if (payload.message_id) {
        const { data: alreadySent } = await supabase
          .from("email_send_log")
          .select("id")
          .eq("message_id", payload.message_id)
          .eq("status", "sent")
          .maybeSingle();

        if (alreadySent) {
          await deleteQueued(supabase, queue, msg.msg_id);
          continue;
        }
      }

      const suppression = await isSuppressed(supabase, payload);
      if (suppression.error) {
        console.error("Suppression check failed — leaving message queued", {
          queue,
          msg_id: msg.msg_id,
          error: suppression.error,
        });
        continue;
      }
      if (suppression.blocked) {
        await supabase.from("email_send_log").insert({
          message_id: payload.message_id,
          template_name: payload.label || queue,
          recipient_email: payload.to,
          status: "suppressed",
          error_message: suppression.reason,
        });
        await deleteQueued(supabase, queue, msg.msg_id);
        continue;
      }

      try {
        await sendEmail(payload);

        await supabase.from("email_send_log").insert({
          message_id: payload.message_id,
          template_name: payload.label || queue,
          recipient_email: payload.to,
          status: "sent",
        });

        await deleteQueued(supabase, queue, msg.msg_id);
        totalProcessed++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error("Email send failed", {
          queue,
          msg_id: msg.msg_id,
          read_ct: msg.read_ct,
          failed_attempts: failedAttempts,
          error: errorMsg,
        });

        if (isRateLimited(error)) {
          await supabase.from("email_send_log").insert({
            message_id: payload.message_id,
            template_name: payload.label || queue,
            recipient_email: payload.to,
            status: "rate_limited",
            error_message: errorMsg.slice(0, 1000),
          });

          const retryAfterSecs = getRetryAfterSeconds(error);
          await supabase
            .from("email_send_state")
            .update({
              retry_after_until: new Date(Date.now() + retryAfterSecs * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", 1);

          return json({ processed: totalProcessed, stopped: "rate_limited" });
        }

        if (isForbidden(error)) {
          await moveToDlq(supabase, queue, msg, "Emails disabled for this project");
          continue;
        }

        await supabase.from("email_send_log").insert({
          message_id: payload.message_id,
          template_name: payload.label || queue,
          recipient_email: payload.to,
          status: "failed",
          error_message: errorMsg.slice(0, 1000),
        });
        if (payload?.message_id && typeof payload.message_id === "string") {
          failedAttemptsByMessageId.set(payload.message_id, failedAttempts + 1);
        }
      }

      if (i < messages.length - 1) {
        await sleep(sendDelayMs);
      }
    }
  }

  return json({ processed: totalProcessed });
}

export async function sendWithResend(apiKey, emailFrom, payload, fetchImpl = fetch) {
  const from = resolveQueueFrom(emailFrom, payload?.from);
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  if (payload.idempotency_key) {
    headers["Idempotency-Key"] = String(payload.idempotency_key);
  }

  const body = {
    from,
    to: [payload.to],
    subject: payload.subject ?? "",
    html: payload.html ?? "",
    text: payload.text ?? "",
  };
  if (typeof payload.reply_to === "string" && payload.reply_to) {
    body.reply_to = payload.reply_to;
  }

  const response = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(text || `Resend error ${response.status}`);
    error.status = response.status;
    const retryAfter = response.headers?.get?.("retry-after");
    const parsed = retryAfter == null ? null : Number(retryAfter);
    error.retryAfterSeconds = parsed != null && Number.isFinite(parsed) ? parsed : null;
    throw error;
  }
}
