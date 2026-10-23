// Sender addresses Resend will accept. DKIM is on etherbylcove.com.
// notifications.etherbylcove.com is not a verified sending domain.

export const VERIFIED_SENDER_DOMAIN = "etherbylcove.com";
export const HOST_EVENT_FROM_ADDRESS = "events@etherbylcove.com";
export const PLATFORM_QUEUE_FROM = "notifications@etherbylcove.com";
// No reply-to until a host verifies their own address. Cadre can set this to one
// real mailbox later. Null means the message is sent with no Reply-To header.
export const PLATFORM_FALLBACK_REPLY_TO = null;
export const HOST_DISPLAY_NAME_MAX = 80;

const UNVERIFIED_SENDER_DOMAIN = "notifications.etherbylcove.com";

export function sanitizeDisplayName(name) {
  return (name || "")
    .replace(/[<>@,";\r\n]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, HOST_DISPLAY_NAME_MAX);
}

export function eventReplyTo(verifiedAddress) {
  if (typeof verifiedAddress === "string" && verifiedAddress.trim()) return verifiedAddress.trim();
  return PLATFORM_FALLBACK_REPLY_TO;
}

export function hostFromHeader(fromName) {
  return `${sanitizeDisplayName(fromName)} <${HOST_EVENT_FROM_ADDRESS}>`;
}

export function rewriteSenderAddress(value) {
  if (typeof value !== "string") return "";
  return value.replaceAll(`@${UNVERIFIED_SENDER_DOMAIN}`, `@${VERIFIED_SENDER_DOMAIN}`);
}

function senderAddress(value) {
  const candidate = typeof value === "string" ? value.trim() : "";
  return (candidate.match(/<([^>]+)>/)?.[1] || candidate).trim().toLowerCase();
}

export function isVerifiedSender(value) {
  const address = senderAddress(value);
  const domain = address.split("@")[1] || "";
  return address.includes("@") && domain === VERIFIED_SENDER_DOMAIN && !address.includes(" ");
}
