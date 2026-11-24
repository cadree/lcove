export const ETHER_WEB_ORIGIN = "https://etherbylcove.com";

/**
 * iOS checkout asks for the public site so Stripe can send Safari back to a
 * universal link. Any other requested origin is ignored and the caller's
 * existing header or fallback is used.
 */
export function checkoutOrigin(requested, headerOrigin, fallback) {
  if (requested === ETHER_WEB_ORIGIN) return ETHER_WEB_ORIGIN;
  if (typeof headerOrigin === "string" && headerOrigin.trim()) return headerOrigin.trim();
  return fallback;
}
