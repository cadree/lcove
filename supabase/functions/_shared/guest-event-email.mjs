// Guest-facing event mail. The host's name, flyer, and color lead.
// Ether is only the footer line plus legal and unsubscribe links.

const LEGAL = {
  privacy: "https://etherbylcove.com/privacy",
  terms: "https://etherbylcove.com/terms",
};

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

export function guestEmailFooter({ unsubscribeUrl, privacyUrl = LEGAL.privacy, termsUrl = LEGAL.terms } = {}) {
  const unsubscribe = unsubscribeUrl
    ? ` &nbsp;·&nbsp; <a href="${escapeHtml(unsubscribeUrl)}" style="color:#9a9a9a;text-decoration:underline;">Unsubscribe</a>`
    : "";
  return `
    <p style="color:#9a9a9a;font-size:11px;line-height:1.5;text-align:center;margin:18px 0 0;">
      Powered by Ether<br />
      <a href="${escapeHtml(privacyUrl)}" style="color:#9a9a9a;text-decoration:underline;">Privacy</a>
      &nbsp;·&nbsp;
      <a href="${escapeHtml(termsUrl)}" style="color:#9a9a9a;text-decoration:underline;">Terms</a>
      ${unsubscribe}
    </p>`;
}

export function guestEventEmailHtml(model) {
  const host = escapeHtml(model.hostName || "Your host");
  const accent = typeof model.brandColor === "string" && /^#[0-9a-fA-F]{3,8}$/.test(model.brandColor)
    ? model.brandColor
    : "#1a1a2e";
  const avatar = model.hostAvatarUrl
    ? `<img src="${escapeHtml(model.hostAvatarUrl)}" alt="" width="48" height="48" style="width:48px;height:48px;border-radius:50%;object-fit:cover;display:block;" />`
    : "";
  const flyer = model.flyerUrl
    ? `<img src="${escapeHtml(model.flyerUrl)}" alt="" style="width:100%;max-height:320px;object-fit:cover;display:block;border-radius:12px;" />`
    : "";
  const map = model.mapUrl && model.location
    ? `<a href="${escapeHtml(model.mapUrl)}" style="color:${accent};text-decoration:underline;">View on map</a>`
    : "";
  const order = model.order
    ? `<div style="margin:18px 0;padding:16px;border:1px solid #eee;border-radius:12px;">
        <p style="margin:0 0 8px;font-size:13px;letter-spacing:0.04em;text-transform:uppercase;color:#666;">Order summary</p>
        <p style="margin:0 0 4px;color:#222;">Order ${escapeHtml(model.order.number || "")}</p>
        <p style="margin:0 0 8px;color:#222;">${escapeHtml(model.order.name || "Guest")}</p>
        ${(model.order.lines || []).map((line) =>
          `<p style="margin:0;color:#333;">${escapeHtml(line.tier || "Ticket")} · ${escapeHtml(line.price || "")}</p>`
        ).join("")}
        <p style="margin:8px 0 0;font-weight:600;color:#111;">Total ${escapeHtml(model.order.total || "")}</p>
      </div>`
    : "";
  const qr = model.qrSrc
    ? `<div style="margin:18px 0;text-align:center;"><img src="${escapeHtml(model.qrSrc)}" alt="Ticket QR code" width="180" height="180" style="width:180px;height:180px;" /></div>`
    : "";
  const wallet = model.walletUrl
    ? `<p style="text-align:center;margin:12px 0;"><a href="${escapeHtml(model.walletUrl)}" style="color:${accent};font-weight:600;text-decoration:underline;">Add to Apple Wallet</a></p>`
    : "";

  return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#ffffff;color:#1a1a2e;">
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
    ${avatar}
    <div>
      <p style="margin:0;font-size:18px;font-weight:700;">${host}</p>
    </div>
  </div>
  ${flyer}
  <h1 style="margin:16px 0 4px;font-size:26px;line-height:1.15;">${escapeHtml(model.eventTitle || "Event")}</h1>
  <p style="margin:0 0 12px;color:#444;">${escapeHtml(model.eventDate || "")}${model.eventTime ? ` · ${escapeHtml(model.eventTime)}` : ""}</p>
  ${model.intro ? `<p style="margin:0 0 12px;color:#333;line-height:1.5;">${model.intro}</p>` : ""}
  ${model.location ? `<p style="margin:0 0 4px;color:#333;">${escapeHtml(model.location)}</p>` : ""}
  ${map ? `<p style="margin:0 0 12px;">${map}</p>` : ""}
  ${order}
  ${qr}
  ${wallet}
  <p style="text-align:center;margin:20px 0;">
    <a href="${escapeHtml(model.eventUrl || "#")}" style="display:inline-block;background:${accent};color:#ffffff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:650;">View event details</a>
  </p>
  ${guestEmailFooter({ unsubscribeUrl: model.unsubscribeUrl })}
</div>`.trim();
}
