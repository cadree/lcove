
The webhook secret is now set, but the user is hitting a non-2xx error when clicking Buy. The `purchase-exclusive-track` edge function returns 400 on any thrown error, and the frontend shows the generic message. I need to find the actual error.

Let me check the edge function logs for `purchase-exclusive-track` to see the real failure reason.

Looking at the function code: it throws "Artist has not enabled payouts yet" if `stripe_connect_account_id` or `payout_enabled` is missing. Most likely cause: the artist (the profile being viewed) has never connected Stripe payouts, so the amber banner should appear for them — but for a buyer it just dead-ends with a 400.

I also notice `ExclusiveTrackCard` was supposed to disable Buy with a tooltip when artist payouts aren't enabled. Need to verify that's actually wired up and showing — if not, buyers click Buy and hit the 400.

Plan to diagnose + fix:

## Investigate
1. Pull recent `purchase-exclusive-track` logs to confirm the exact thrown error.
2. Check `ExclusiveMusicSection` / `ExclusiveTrackCard` for whether `payout_enabled` is fetched for the artist being viewed and gates the Buy button.
3. Check current artist's profile row for `stripe_connect_account_id` + `payout_enabled`.

## Fix
Based on findings, most likely fixes:

**A. Frontend: pre-flight gate**
- Fetch `profiles.payout_enabled` for the artist being viewed (via `get_public_creator_profile` or new public RPC since `profiles` SELECT is restricted to owner).
- Add a lightweight `useArtistPayoutReady(artistUserId)` hook that returns `{ payoutReady: boolean }`.
- In `ExclusiveTrackCard`: if `!payoutReady && !isOwner` → disable Buy + Subscribe with tooltip "Artist hasn't enabled payouts yet — they need to connect a payout account first."
- In `ExclusiveMusicSection`: if visitor (non-owner) and `!payoutReady`, show a soft info banner above the tracks instead of letting them click into a dead end.

**B. Frontend: surface the real error**
- In `handlePurchase` / `handleSubscribe`, when `supabase.functions.invoke` returns an error, attempt to read `error.context?.body` (the JSON `{ error: "..." }` from the function) and toast that exact message instead of the generic one. Right now Stripe edge function errors are swallowed.

**C. Backend: return diagnostic instead of 400**
- Change `purchase-exclusive-track` and `create-artist-subscription` to return `200` with `{ ok: false, error: "..." }` so the client always reads the body cleanly (matches Lovable error-pattern guidance).
- Update frontend to read `data.ok === false` and toast `data.error`.

**D. Public RPC for payout readiness**
- New SECURITY DEFINER function `get_artist_payout_status(artist_user_id uuid)` returning `{ payout_enabled boolean, has_connect_account boolean }`. Reason: `profiles` table has owner-only SELECT, so the client cannot read another user's `payout_enabled`. Without this RPC, we cannot pre-flight gate the Buy button.

## Files

**New:**
- `supabase/migrations/<ts>_artist_payout_status_rpc.sql` — `get_artist_payout_status` RPC

**Modified:**
- `supabase/functions/purchase-exclusive-track/index.ts` — return 200 with structured error
- `supabase/functions/create-artist-subscription/index.ts` — same
- `src/hooks/useMusicPayouts.ts` — add `useArtistPayoutReady(artistUserId)`
- `src/components/music/ExclusiveTrackCard.tsx` — gate buttons on `payoutReady`, show tooltip
- `src/components/music/ExclusiveMusicSection.tsx` — surface real error message in toast; visitor info banner

## Verification (after build)
1. Inspect logs to confirm "Artist has not enabled payouts yet" was the original error.
2. As non-owner viewing an artist without payouts → Buy is disabled with tooltip; no 400 thrown.
3. Once artist connects payouts → Buy enables → checkout opens.
4. If any other backend error fires, the toast shows the exact message (no more generic "Failed to start purchase").
