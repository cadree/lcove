/**
 * A public portfolio or social link is required before a person requests
 * membership. Do not accept JavaScript, data URLs, credentials or localhost.
 */
export function normalizeApplicantLink(value: string): string | null {
  const raw = value.trim();
  if (!raw) return "";
  if (raw.length > 500 || /\s/.test(raw)) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^https?:\/\//i.test(raw)) return null;

  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if ((url.protocol !== "https:" && url.protocol !== "http:") ||
        url.username || url.password || !url.hostname.includes(".") ||
        /^(localhost|127\.|0\.|10\.|192\.168\.)/i.test(url.hostname)) return null;
    return url.href;
  } catch {
    return null;
  }
}

/** At least one reviewable link, and every non-empty link must be valid. */
export function applicantLinksError(social: string, website: string): string | null {
  if (!social.trim() && !website.trim()) {
    return "Add a public social media profile or a website so we can review your application.";
  }
  if (normalizeApplicantLink(social) === null) return "Enter a valid public social media URL.";
  if (normalizeApplicantLink(website) === null) return "Enter a valid website or portfolio URL.";
  return null;
}
