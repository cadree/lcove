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
  if (typeof navigator !== 'undefined' && typeof (navigator as any).share === 'function') {
    try {
      await (navigator as any).share({ title, text, url });
      if (!silentOnNative) toast.success('Shared!');
      return;
    } catch (err: any) {
      // User cancelled — do nothing, do not fall through to copy.
      if (err?.name === 'AbortError') return;
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

async function copyToClipboardSilent(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}
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
    case 'copy':
      await shareLink(opts);
      return;

    case 'twitter': {
      const u = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`;
      if (!openInNewTab(u)) await fallbackCopy('X / Twitter');
      return;
    }

    case 'whatsapp': {
      const u = `https://wa.me/?text=${encodeURIComponent(fullText)}`;
      if (!openInNewTab(u)) await fallbackCopy('WhatsApp');
      return;
    }

    case 'facebook': {
      const u = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
      if (!openInNewTab(u)) await fallbackCopy('Facebook');
      return;
    }

    case 'sms': {
      const body = encodeURIComponent(fullText);
      // sms: scheme — use location.href (no popup blocker). On desktop this may no-op,
      // so copy the link as a safety net.
      try {
        window.location.href = `sms:?&body=${body}`;
      } catch {}
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
      } catch {}
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
        } catch {}
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
  project: (id: string) => `${SHARE_BASE_URL}/project/${id}`,
  profile: (userId: string) => `${SHARE_BASE_URL}/profile/${userId}`,
  post: (userId: string, postId: string) => `${SHARE_BASE_URL}/profile/${userId}?post=${postId}`,
  client: (token: string) => `${SHARE_BASE_URL}/client/${token}`,
  cinema: (id: string) => `${SHARE_BASE_URL}/cinema?content=${id}`,
};
