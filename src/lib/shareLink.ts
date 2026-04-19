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

export const buildShareUrl = {
  event: (id: string) => `${SHARE_BASE_URL}/event/${id}`,
  project: (id: string) => `${SHARE_BASE_URL}/project/${id}`,
  profile: (userId: string) => `${SHARE_BASE_URL}/profile/${userId}`,
  post: (userId: string, postId: string) => `${SHARE_BASE_URL}/profile/${userId}?post=${postId}`,
  client: (token: string) => `${SHARE_BASE_URL}/client/${token}`,
  cinema: (id: string) => `${SHARE_BASE_URL}/cinema?content=${id}`,
};
