// Shared host-branded event email template builder.
// Used by send-event-invite, send-event-reminder, send-bulk-attendee-reminder.

import type { HostIdentity } from "./host-email-identity.ts";

export type HostEmailKind = "invite" | "reminder" | "update";

export interface HostEmailContext {
  identity: HostIdentity;
  recipientName?: string | null;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  location: string;
  isFree: boolean;
  ticketPrice?: number | null;
  eventUrl: string;
  customMessage?: string | null;
  moodboardThumbnails?: string[]; // up to 3 image urls
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c] as string));

function ctaLabel(kind: HostEmailKind, isFree: boolean): string {
  if (kind === "invite") return isFree ? "RSVP Now" : "Get Tickets";
  if (kind === "reminder") return "View Event Details";
  return "View Event";
}

function intro(kind: HostEmailKind, ctx: HostEmailContext): string {
  const first = (ctx.recipientName || "").trim().split(" ")[0] || "there";
  const note = ctx.identity.personalNote?.trim();
  if (kind === "invite") {
    return note
      ? `Hey ${escapeHtml(first)}, ${escapeHtml(note)}`
      : `Hey ${escapeHtml(first)}, I’d love to personally invite you to <strong>${escapeHtml(ctx.eventTitle)}</strong>.`;
  }
  if (kind === "reminder") {
    return `Hey ${escapeHtml(first)}, just a quick reminder about <strong>${escapeHtml(ctx.eventTitle)}</strong>.`;
  }
  return `Hey ${escapeHtml(first)}, an update on <strong>${escapeHtml(ctx.eventTitle)}</strong>.`;
}

export function buildHostEventEmail(
  kind: HostEmailKind,
  ctx: HostEmailContext
): { subject: string; html: string; text: string } {
  const { identity } = ctx;
  const accent = identity.brandColor;

  const subject =
    kind === "invite"
      ? `${identity.organizerName} invited you to ${ctx.eventTitle}`
      : kind === "reminder"
      ? `Reminder: ${ctx.eventTitle}`
      : `Update: ${ctx.eventTitle}`;

  const headerBlock = identity.headerImageUrl
    ? `<div style="width:100%;height:180px;background:url('${escapeHtml(
        identity.headerImageUrl
      )}') center/cover no-repeat;border-radius:12px 12px 0 0;"></div>`
    : `<div style="width:100%;height:8px;background:${accent};border-radius:12px 12px 0 0;"></div>`;

  const moodboard =
    ctx.moodboardThumbnails && ctx.moodboardThumbnails.length > 0
      ? `<div style="display:flex;gap:6px;margin:16px 0;">${ctx.moodboardThumbnails
          .slice(0, 3)
          .map(
            (u) =>
              `<img src="${escapeHtml(
                u
              )}" alt="" style="flex:1;height:80px;object-fit:cover;border-radius:8px;" />`
          )
          .join("")}</div>`
      : "";

  const customMsg = ctx.customMessage?.trim()
    ? `<div style="background:#fafafa;border-left:3px solid ${accent};padding:12px 16px;margin:16px 0;border-radius:6px;font-style:italic;color:#444;">${escapeHtml(
        ctx.customMessage
      )}</div>`
    : "";

  const signatureBlock = `
    <div style="margin-top:28px;padding-top:20px;border-top:1px solid #eee;display:flex;align-items:center;gap:12px;">
      ${
        identity.hostAvatarUrl
          ? `<img src="${escapeHtml(
              identity.hostAvatarUrl
            )}" alt="" style="width:40px;height:40px;border-radius:50%;object-fit:cover;" />`
          : ""
      }
      <div>
        <div style="font-weight:600;color:#1a1a2e;">${escapeHtml(
          identity.organizerName
        )}</div>
        ${
          identity.signature
            ? `<div style="color:#666;font-size:13px;margin-top:2px;">${escapeHtml(
                identity.signature
              )}</div>`
            : ""
        }
      </div>
    </div>
  `;

  const priceLine =
    !ctx.isFree && ctx.ticketPrice
      ? `<p style="margin:4px 0;color:#666;">🎟️ Tickets: $${ctx.ticketPrice}</p>`
      : ctx.isFree
      ? `<p style="margin:4px 0;color:#666;">🎟️ Free Event</p>`
      : "";

  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#ffffff;">
  <div style="border:1px solid #eee;border-radius:12px;overflow:hidden;">
    ${headerBlock}
    <div style="padding:24px;">
      <h2 style="margin:0 0 4px;color:#1a1a2e;font-size:22px;">${escapeHtml(
        ctx.eventTitle
      )}</h2>
      <p style="margin:0 0 18px;color:#888;font-size:13px;">Hosted by ${escapeHtml(
        identity.organizerName
      )}</p>

      <p style="color:#333;line-height:1.5;margin:0 0 16px;">${intro(kind, ctx)}</p>

      ${customMsg}
      ${moodboard}

      <div style="background:#f8f8f8;border-radius:10px;padding:16px;margin:16px 0;">
        <p style="margin:4px 0;color:#444;">📅 ${escapeHtml(
          ctx.eventDate
        )} at ${escapeHtml(ctx.eventTime)}</p>
        <p style="margin:4px 0;color:#444;">📍 ${escapeHtml(ctx.location)}</p>
        ${priceLine}
      </div>

      <div style="text-align:center;margin:24px 0 8px;">
        <a href="${escapeHtml(ctx.eventUrl)}"
           style="display:inline-block;background:${accent};color:#ffffff;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:600;">
          ${ctaLabel(kind, ctx.isFree)}
        </a>
      </div>

      ${signatureBlock}
    </div>
  </div>
  <p style="color:#aaa;font-size:11px;text-align:center;margin-top:16px;">
    Sent via ETHER by lcove on behalf of ${escapeHtml(identity.organizerName)}
  </p>
</div>`.trim();

  const text = [
    `${identity.organizerName} — ${ctx.eventTitle}`,
    "",
    `${ctx.eventDate} at ${ctx.eventTime}`,
    ctx.location,
    ctx.customMessage ? `\n${ctx.customMessage}\n` : "",
    ctx.eventUrl,
  ]
    .filter(Boolean)
    .join("\n");

  return { subject, html, text };
}
