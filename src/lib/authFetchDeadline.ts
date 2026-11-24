import { abortAfter } from "./requestDeadline.ts";

/** Longest an auth request (token refresh, sign-in, user) may stay open. */
export const AUTH_REQUEST_DEADLINE_MS = 10_000;

/**
 * Fetch for the Supabase client. Auth requests get a deadline; everything else
 * (uploads, functions, queries) is passed through unchanged.
 *
 * supabase-js refreshes the token while holding its auth lock, and every query
 * waits on that lock for its access token with no timeout. After iOS suspends
 * the app, a refresh can sit on a dead socket forever, and then no page can
 * load until the app is killed. With a deadline the refresh fails as a network
 * error, the lock is released, and the next refresh tick tries again.
 */
export function withAuthDeadline(base: typeof fetch, ms = AUTH_REQUEST_DEADLINE_MS): typeof fetch {
  return (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!url.includes("/auth/v1/")) return base(input, init);
    const deadline = abortAfter(ms);
    const own = init?.signal;
    const signal = own && typeof AbortSignal.any === "function" ? AbortSignal.any([own, deadline]) : own ?? deadline;
    return base(input, { ...init, signal });
  };
}
