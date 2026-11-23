/**
 * Supabase Auth hides whether an email is taken. Join with an email that is
 * already confirmed returns 200, no session, no email, and a fake user whose
 * `identities` is empty. Resend for a confirmed email also returns 200 and
 * sends nothing. These helpers turn those quiet answers into a next step, so
 * someone reusing an email always has a way to get back in.
 */

export type AuthErrorLike = { message?: string; code?: string; status?: number };

type SignupUserLike = { identities?: unknown[] | null } | null | undefined;

export type SignupOutcome =
  | { kind: 'signed-in' }
  | { kind: 'code-sent' }
  | { kind: 'existing-account' }
  | { kind: 'rate-limited'; retryAfterSeconds: number | null }
  | { kind: 'email-failed' }
  | { kind: 'error' };

export function isEmailRateLimited(error: AuthErrorLike | null | undefined): boolean {
  if (!error) return false;
  const message = (error.message || '').toLowerCase();
  return (
    error.code === 'over_email_send_rate_limit' ||
    message.includes('email rate limit exceeded') ||
    message.includes('you can only request this after')
  );
}

/** "For security purposes, you can only request this after 49 seconds." -> 49 */
export function retryAfterSeconds(error: AuthErrorLike | null | undefined): number | null {
  const match = /after\s+(\d+)\s*seconds?/i.exec(error?.message || '');
  if (!match) return null;
  const seconds = Number(match[1]);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

/** Quota and per-address limits, explained without blaming the password or code. */
export function emailSendingHelp(error: AuthErrorLike | null | undefined): {
  title: string;
  description: string;
} | null {
  if (!isEmailRateLimited(error)) return null;
  const seconds = retryAfterSeconds(error);
  return {
    title: 'Email sent recently',
    description: seconds
      ? `We just emailed this address. Check your inbox (and spam) for the newest code or link, or try again in ${seconds}s. Already verified? Sign in instead.`
      : 'We can’t send another email just yet. Check your inbox (and spam) for the newest code or link, or try again in a few minutes. Already verified? Sign in instead.',
  };
}

/**
 * A per-address limit ("after 49 seconds") means a code already went to this
 * address, so the code screen is right. A project-wide email limit on a new
 * Join creates no account and sends nothing, so the code screen would ask for
 * a code that never comes: stay on Join and say when to try again.
 */
export function signupLimitNextStep(retryAfter: number | null): 'code-screen' | 'stay-on-join' {
  return retryAfter == null ? 'stay-on-join' : 'code-screen';
}

export const SIGNUP_NOT_SENT_NOTE =
  'We couldn’t send your code just now because a lot of codes went out at once. Wait a few minutes, then tap Join again. Nothing was created yet, so you won’t lose anything.';

/** Email delivery problems that can leave an unverified signup behind. */
export function signupEmailDeliveryFailed(error: AuthErrorLike | null | undefined): boolean {
  if (!error) return false;
  const message = (error.message || '').toLowerCase();
  return (
    isEmailRateLimited(error) ||
    message.includes('smtp') ||
    message.includes('authentication credentials invalid') ||
    message.includes('error sending confirmation email') ||
    message.includes('failed to send confirmation email')
  );
}

/** A confirmed email signs up again: Supabase answers with a user that has no identities. */
export function isExistingAccountSignup(user: SignupUserLike): boolean {
  return Boolean(user) && Array.isArray(user?.identities) && user!.identities!.length === 0;
}

export function classifySignup(result: {
  error: AuthErrorLike | null;
  session: unknown;
  user?: SignupUserLike;
}): SignupOutcome {
  const { error, session, user } = result;
  if (error) {
    if (isEmailRateLimited(error)) return { kind: 'rate-limited', retryAfterSeconds: retryAfterSeconds(error) };
    if (signupEmailDeliveryFailed(error)) return { kind: 'email-failed' };
    if (/already registered|already exists/i.test(error.message || '')) return { kind: 'existing-account' };
    return { kind: 'error' };
  }
  if (session) return { kind: 'signed-in' };
  if (isExistingAccountSignup(user)) return { kind: 'existing-account' };
  return { kind: 'code-sent' };
}

/** Wait before the next email: the local cooldown or the server's own retry time, whichever is longer. */
export function resendWaitRemaining(
  sentAtMs: number | null,
  blockedUntilMs: number | null,
  nowMs: number,
  cooldownMs: number,
): number {
  const fromCooldown = sentAtMs == null ? 0 : sentAtMs + cooldownMs - nowMs;
  const fromServer = blockedUntilMs == null ? 0 : blockedUntilMs - nowMs;
  return Math.max(0, fromCooldown, fromServer);
}
