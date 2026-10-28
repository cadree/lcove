import { toast } from 'sonner';

export interface ShareLinkOptions {
  title?: string;
  text?: string;
  url: string;
  /** Toast message on successful copy fallback. Default: "Link copied!" */
  copyMessage?: string;
  /** If true, suppress the success toast when native share completes (the OS sheet is feedback enough). Default: true */
  silentOnNative?: boolean;
}

/**
 * Robust cross-platform share helper.
 * Tries: native share → clipboard → execCommand → window.prompt
 * Always provides feedback and never throws.
 */
export async function shareLink(opts: ShareLinkOptions): Promise<void> {
  const { title, text, url, copyMessage = 'Link copied!', silentOnNative = true } = opts;

  // 1. Native share (mobile / supported browsers). Blocked in iframes (NotAllowedError) — fall through.
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text, url });
      if (!silentOnNative) toast.success('Shared!');
      return;
    } catch (err: unknown) {
      // User cancelled — do nothing, do not fall through to copy.
      if (typeof err === 'object' && err !== null && 'name' in err && err.name === 'AbortError') return;
      // NotAllowedError (iframe), TypeError, etc → fall through to clipboard.
    }
  }

  // 2. Clipboard API
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(copyMessage);
      return;
    } catch {
      // fall through
    }
  }

  // 3. Legacy execCommand
  if (typeof document !== 'undefined') {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = url;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (ok) {
        toast.success(copyMessage);
        return;
      }
    } catch {
      // fall through
    }
  }

  // 4. Last resort — show the link to the user
  if (typeof window !== 'undefined') {
    window.prompt('Copy this link:', url);
  }
}

/** Canonical share domain for the platform. */
export const SHARE_BASE_URL = 'https://etherbylcove.com';

/** Facebook's web sharer. The app scheme is not used. */
export function facebookShareUrl(url: string): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
}

export function fileSharePlan(options: {
  canShareFiles: boolean;
  nativePlatform: boolean;
  pluginAvailable: boolean;
}): "web-file" | "capacitor" | "download" {
  if (options.canShareFiles) return "web-file";
  if (options.nativePlatform && options.pluginAvailable) return "capacitor";
  return "download";
}

function canShareFiles(file: File): boolean {
  if (typeof navigator === "undefined" || typeof navigator.canShare !== "function" || typeof navigator.share !== "function") {
    return false;
  }
  try {
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

function downloadBlobFile(file: File): boolean {
  if (typeof document === "undefined") return false;
  try {
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    return true;
  } catch {
    return false;
  }
}

/**
 * Hand a real file to the system share sheet.
 * Web Share with files comes first. The Capacitor Share plugin, already in the
 * iOS app, is the next try. A browser download is the last try. No new plugin.
 */
export async function deliverFile(
  file: File,
  opts: { title?: string; text?: string; url?: string },
): Promise<"shared" | "cancelled" | "downloaded" | "unavailable"> {
  let nativePlatform = false;
  let pluginAvailable = false;
  try {
    const { Capacitor } = await import("@capacitor/core");
    nativePlatform = Capacitor.isNativePlatform();
    pluginAvailable = Capacitor.isPluginAvailable("Share");
  } catch {
    nativePlatform = false;
  }
  const plan = fileSharePlan({
    canShareFiles: canShareFiles(file),
    nativePlatform,
    pluginAvailable,
  });
  if (plan === "web-file" && typeof navigator.share === "function") {
    try {
      await navigator.share({ files: [file], title: opts.title, text: opts.text, url: opts.url });
      return "shared";
    } catch (error) {
      if (shareWasCancelled(error)) return "cancelled";
    }
  }
  if ((plan === "capacitor" || pluginAvailable) && nativePlatform) {
    const objectUrl = URL.createObjectURL(file);
    try {
      const { Share } = await import("@capacitor/share");
      await Share.share({
        title: opts.title,
        text: opts.text,
        url: opts.url || objectUrl,
        dialogTitle: opts.title || "Share",
        files: [objectUrl],
      });
      return "shared";
    } catch (error) {
      if (shareWasCancelled(error)) return "cancelled";
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }
  if (downloadBlobFile(file)) return "downloaded";
  return "unavailable";
}

/** Free sms: link. The handset opens Messages. This never calls a paid SMS API. */
export function smsShareHref(url: string, text?: string): string {
  const trimmed = url.trim();
  const note = text?.replace(/\s+/g, " ").trim();
  const body = encodeURIComponent(note ? `${note} ${trimmed}` : trimmed);
  return `sms:?&body=${body}`;
}

export function nativeSharePlan(options: {
  nativePlatform: boolean;
  pluginAvailable: boolean;
  webShare: boolean;
}): "capacitor" | "web" | "unavailable" {
  if (options.nativePlatform && options.pluginAvailable) return "capacitor";
  if (options.webShare) return "web";
  return "unavailable";
}

function shareWasCancelled(error: unknown): boolean {
  if (typeof error === "object" && error !== null && "name" in error && (error as { name?: string }).name === "AbortError") {
    return true;
  }
  const message = error instanceof Error ? error.message : "";
  return /cancel/i.test(message);
}

/**
 * iOS Safari uses navigator.share. The Capacitor app uses the Share plugin
 * when it is installed, then the web sheet. Nothing here sends a paid text.
 */
export async function openNativeShare(opts: {
  title?: string;
  text?: string;
  url: string;
}): Promise<"shared" | "cancelled" | "unavailable"> {
  const webShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  let nativePlatform = false;
  let pluginAvailable = false;
  try {
    const { Capacitor } = await import("@capacitor/core");
    nativePlatform = Capacitor.isNativePlatform();
    pluginAvailable = Capacitor.isPluginAvailable("Share");
  } catch {
    nativePlatform = false;
  }
  const plan = nativeSharePlan({ nativePlatform, pluginAvailable, webShare });
  try {
    if (plan === "capacitor") {
      const { Share } = await import("@capacitor/share");
      await Share.share({
        title: opts.title,
        text: opts.text,
        url: opts.url,
        dialogTitle: opts.title || "Share",
      });
      return "shared";
    }
    if (plan === "web" && typeof navigator.share === "function") {
      await navigator.share({ title: opts.title, text: opts.text, url: opts.url });
      return "shared";
    }
  } catch (error) {
    if (shareWasCancelled(error)) return "cancelled";
    if (plan === "capacitor" && webShare && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: opts.title, text: opts.text, url: opts.url });
        return "shared";
      } catch (webError) {
        if (shareWasCancelled(webError)) return "cancelled";
      }
    }
  }
  return "unavailable";
}

/** Copy the event link. Does not open the system share sheet. */
export async function copyEventLink(url: string, copyMessage = "Link copied"): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(copyMessage);
      return;
    } catch {
      // fall through
    }
  }
  if (typeof document !== "undefined") {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = url;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);
      if (ok) {
        toast.success(copyMessage);
        return;
      }
    } catch {
      // fall through
    }
  }
  if (typeof window !== "undefined") window.prompt("Copy this link:", url);
}

/** Capacitor share sheet, then the browser sheet, then copy. */
export async function shareEventLink(opts: { title?: string; text?: string; url: string }): Promise<void> {
  const result = await openNativeShare(opts);
  if (result === "shared" || result === "cancelled") return;
  await copyEventLink(opts.url);
}

export type ShareChannel =
  | 'native'
  | 'copy'
  | 'twitter'
  | 'whatsapp'
  | 'facebook'
  | 'sms'
  | 'email'
  | 'instagram';

/**
 * Open a URL in a new tab. Returns true if it likely succeeded,
 * false if the popup was blocked.
 */
function openInNewTab(url: string): boolean {
  try {
    const w = window.open(url, '_blank', 'noopener,noreferrer');
    if (!w || w.closed || typeof w.closed === 'undefined') return false;
    return true;
  } catch {
    return false;
  }
}

function isMobileUA(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /android|iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * Try to open a native app via its URI scheme. If the app isn't installed
 * (page stays visible after ~800ms), fall back to the web URL.
 */
function tryAppSchemeWithFallback(appUrl: string, webUrl: string): void {
  if (typeof window === 'undefined') return;
  const start = Date.now();
  let fellBack = false;

  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      fellBack = true; // app opened — cancel fallback
    }
  };
  document.addEventListener('visibilitychange', onVisibilityChange);

  try {
    window.location.href = appUrl;
  } catch {
    // Custom URL schemes throw when the app is not installed.
  }

  window.setTimeout(() => {
    document.removeEventListener('visibilitychange', onVisibilityChange);
    if (!fellBack && Date.now() - start < 2000 && document.visibilityState === 'visible') {
      window.location.href = webUrl;
    }
  }, 800);
}

async function copyToClipboardSilent(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Clipboard can be blocked; fall through to the legacy copy path.
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/**
 * Share to a specific channel with graceful fallbacks.
 * If a popup is blocked, copies the link to clipboard and toasts the user.
 */
export async function shareToChannel(
  channel: ShareChannel,
  opts: ShareLinkOptions
): Promise<void> {
  const { title, text, url } = opts;
  const shareText = text ?? title ?? '';
  const fullText = shareText ? `${shareText} ${url}` : url;

  const fallbackCopy = async (channelLabel: string) => {
    const ok = await copyToClipboardSilent(url);
    if (ok) toast.success(`Popup blocked — link copied. Paste into ${channelLabel}.`);
    else window.prompt('Copy this link:', url);
  };

  switch (channel) {
    case 'native':
      await shareEventLink(opts);
      return;
    case 'copy':
      await copyEventLink(url);
      return;

    case 'twitter': {
      const webUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`;
      if (isMobileUA()) {
        const appUrl = `twitter://post?message=${encodeURIComponent(fullText)}`;
        tryAppSchemeWithFallback(appUrl, webUrl);
        return;
      }
      if (!openInNewTab(webUrl)) await fallbackCopy('X / Twitter');
      return;
    }

    case 'whatsapp': {
      const webUrl = `https://wa.me/?text=${encodeURIComponent(fullText)}`;
      if (isMobileUA()) {
        const appUrl = `whatsapp://send?text=${encodeURIComponent(fullText)}`;
        tryAppSchemeWithFallback(appUrl, webUrl);
        return;
      }
      if (!openInNewTab(webUrl)) await fallbackCopy('WhatsApp');
      return;
    }

    case 'facebook': {
      const webUrl = facebookShareUrl(url);
      if (!openInNewTab(webUrl)) await fallbackCopy('Facebook');
      return;
    }

    case 'sms': {
      const body = encodeURIComponent(fullText);
      // sms: scheme — use location.href (no popup blocker). On desktop this may no-op,
      // so copy the link as a safety net.
      try {
        window.location.href = `sms:?&body=${body}`;
      } catch {
        // sms: is unsupported in some browsers.
      }
      // Best-effort copy in case the sms: handler did nothing (e.g. desktop)
      const ok = await copyToClipboardSilent(url);
      if (ok) toast.success('Link copied — paste into a text');
      return;
    }

    case 'email': {
      const subject = encodeURIComponent(title ?? 'Check this out');
      const body = encodeURIComponent(fullText);
      try {
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
      } catch {
        // mailto: can throw when no mail client is registered.
      }
      return;
    }

    case 'instagram': {
      // Instagram has no web share API. Try app deep link on mobile, then copy.
      const isMobile = /android|iphone|ipad|ipod/i.test(
        typeof navigator !== 'undefined' ? navigator.userAgent : ''
      );
      if (isMobile) {
        try {
          window.location.href = 'instagram://library';
        } catch {
          // Instagram's app scheme is unavailable; the link is still copied.
        }
      }
      const ok = await copyToClipboardSilent(url);
      if (ok) {
        toast.success('Link copied! Paste it into your Instagram story, bio or DM.');
      } else {
        window.prompt('Copy this link to share on Instagram:', url);
      }
      return;
    }
  }
}

export const buildShareUrl = {
  event: (id: string) => `${SHARE_BASE_URL}/event/${id}`,
  product: (id: string) => `${SHARE_BASE_URL}/product/${id}`,
  project: (id: string) => `${SHARE_BASE_URL}/project/${id}`,
  profile: (userId: string) => `${SHARE_BASE_URL}/profile/${userId}`,
  post: (userId: string, postId: string) => `${SHARE_BASE_URL}/profile/${userId}?post=${postId}`,
  client: (token: string) => `${SHARE_BASE_URL}/client/${token}`,
  cinema: (id: string) => `${SHARE_BASE_URL}/cinema?content=${id}`,
  live: (id: string) => `${SHARE_BASE_URL}/live/${id}`,
};
