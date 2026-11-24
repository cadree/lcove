// Stripe Connect needs web URLs, including when the request comes from an
// iPhone WebView (capacitor://localhost) or has no Origin header at all.
const DEFAULT_ORIGIN = "https://etherbylcove.com";

function httpsOrigin(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.origin : null;
  } catch {
    return null;
  }
}

export function musicPayoutUrls({ origin, siteUrl, appUrl } = {}) {
  const configured = httpsOrigin(siteUrl) || httpsOrigin(appUrl) || DEFAULT_ORIGIN;
  const requested = httpsOrigin(origin);
  // Never send an account holder back to an arbitrary caller-supplied host.
  const trusted = new Set([configured, DEFAULT_ORIGIN, "https://www.etherbylcove.com"]);
  const base = requested && trusted.has(requested) ? requested : configured;
  return {
    refresh_url: `${base}/profile?music_payouts=refresh`,
    return_url: `${base}/profile?music_payouts=success`,
  };
}
