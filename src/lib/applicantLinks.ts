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

/** Either a public social profile OR portfolio/website is required. */
export function applicantLinksError(social: string, website: string): string | null {
  if (!social.trim() && !website.trim()) {
    return "Add a public social profile or a website/portfolio for review.";
  }
  if (normalizeApplicantLink(social) === null) return "Enter a valid public social media URL.";
  if (normalizeApplicantLink(website) === null) return "Enter a valid website or portfolio URL.";
  return null;
}

const SOCIAL_SITES: Record<string, { href: (handle: string) => string; handle: RegExp }> = {
  instagram: { href: (handle) => `https://instagram.com/${handle}`, handle: /^[A-Za-z0-9._]{1,30}$/ },
  social_profile: { href: (handle) => `https://instagram.com/${handle}`, handle: /^[A-Za-z0-9._]{1,30}$/ },
  tiktok: { href: (handle) => `https://www.tiktok.com/@${handle}`, handle: /^[A-Za-z0-9._]{1,24}$/ },
  twitter: { href: (handle) => `https://x.com/${handle}`, handle: /^[A-Za-z0-9_]{1,15}$/ },
  youtube: { href: (handle) => `https://www.youtube.com/@${handle}`, handle: /^[A-Za-z0-9._-]{3,30}$/ },
  linkedin: { href: (handle) => `https://www.linkedin.com/in/${handle}`, handle: /^[A-Za-z0-9-]{3,100}$/ },
};

const SOCIAL_LABELS: Record<string, string> = {
  social_profile: "Social media",
  website: "Website / portfolio",
  instagram: "Instagram",
  tiktok: "TikTok",
  twitter: "X / Twitter",
  youtube: "YouTube",
  linkedin: "LinkedIn",
};

/** True when the value is already a URL or host, not a social handle. */
function looksLikeWebUrl(raw: string): boolean {
  if (/^https?:\/\//i.test(raw) || /^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.includes("/")) return true;
  if (/^(www\.)?(instagram|tiktok|youtube|youtu|linkedin|twitter|x)\./i.test(raw)) return true;
  return /\.(com|org|net|io|co|app|dev|me|tv|info|edu|gov)\b/i.test(raw);
}

/**
 * Turn a stored social or website value into a public http(s) URL.
 * Handles like `@ada` or `ada` on Instagram become https://instagram.com/ada.
 * Returns "" for a blank value and null when it cannot be made safe.
 */
export function applicantSocialUrl(key: string, value: string): string | null {
  const raw = value.trim();
  if (!raw) return "";
  const site = SOCIAL_SITES[key];
  if (site && !looksLikeWebUrl(raw)) {
    const handle = raw.replace(/^@/, "");
    if (site.handle.test(handle)) return site.href(handle);
  }
  return normalizeApplicantLink(raw);
}

export function applicantSocialLabel(key: string): string {
  return SOCIAL_LABELS[key] ?? key.replace(/_/g, " ");
}

/**
 * Open a public http(s) URL in a new tab (Safari on iOS Capacitor).
 * EtherStorefront.openExternal only allows checkout hosts, so Instagram
 * cannot use that native path without a store build. window.open is the
 * existing in-app pattern and needs no new plugin.
 */
export function openExternalHttpUrl(url: string): boolean {
  const href = normalizeApplicantLink(url);
  if (!href || typeof window === "undefined") return false;
  window.open(href, "_blank", "noopener,noreferrer");
  return true;
}

export function onExternalHttpUrlClick(
  url: string,
  event: { preventDefault(): void; stopPropagation(): void },
): void {
  event.preventDefault();
  event.stopPropagation();
  openExternalHttpUrl(url);
}
