

## Why it's failing

Confirmed via DB + edge logs:
- Track `love`: `price_cents=0`, `access_type='purchase'`, no purchase rule
- One artist-wide challenge rule (`track_id=null`), but `metadata={}` — **no platform set**
- `fan_challenge_completions` table is **empty** (0 rows ever)
- Edge logs show 5 hits to `purchase-exclusive-track` returning the "free track" error

So users ARE clicking something that fires `onPurchase`. With no `purchaseRule` on this track and `isPaid=false`, the Buy button at line 159 should NOT render. But two things are still wrong:

### Bug 1 — Cached/stale rules carry stale `purchaseRule`
`trackRules` filter (line 55) includes rules where `track_id===null`. The artist-wide **challenge** rule passes — fine. But if there's ANY artist-wide purchase rule with $0 (legacy or accidentally created), `purchaseRule` becomes truthy with `amount_cents=0`. Currently we gate on `isPaid` ✅, but the broader UX bug is the **misleading challenge button label**.

### Bug 2 — Real culprit: challenge rule has empty metadata
The challenge rule's `metadata={}` so `platform` is undefined → button reads **"Unlock via Challenge — Share on social"** with no instructions in modal. Users tap it, the modal opens with no useful text, they probably close it. They then look for another way to listen → tap any visible chip/badge → it calls `onPurchase` → 💥 "free track" error.

### Bug 3 — Modal "I completed this" never inserts
Even if a user does click through, the **RLS INSERT policy requires `access_rule_id` references an active challenge rule**. The dialog passes the rule correctly, so this *should* work — but if `meta.requires_proof` is undefined (empty metadata case), `verified=true` is fine. **However**, the failure mode I now suspect: the dialog never opens cleanly because `pickChallengeRule` returns the artist-wide rule but the modal shows no instructions, users abandon. **Zero completions in the DB** confirms nobody finishes the flow.

### Bug 4 — Auto-default for empty metadata
There's no fallback. If artist toggles challenge on but doesn't fill platform/instructions, the UX breaks.

## Fix plan

### 1. `src/components/music/FanChallengeDialog.tsx` — make it work with empty metadata
- Fallback instructions: *"Support the artist by sharing this track with your network, then tap below to unlock."*
- Default platform = "social" (already handled), but remove the platform sub-line if not set.
- Clear, prominent **"I completed this — unlock now"** primary button (already exists).
- Add an **error toast with the actual message** if insert fails (already present, but log to console too for debugging).

### 2. `src/components/music/AccessRuleEditor.tsx` — guide artists to fill the challenge
- When `rule_type='challenge'` and `metadata.platform` is empty → show inline tip: *"Add a platform and instructions so fans know what to do."*
- Pre-select platform = "instagram" by default when toggling challenge on.

### 3. `src/components/music/ExclusiveTrackCard.tsx` — clean up CTAs for $0 tracks
- The "Extra unlock options" badge row (lines 279–294) currently calls `onPurchase` for **any unknown rule_type**. Add explicit guard: if rule has `amount_cents===0`, do NOT call purchase — open the challenge dialog instead, or hide the badge.
- Make the Challenge CTA clearer when metadata is empty: just **"Unlock — Free for fans"** instead of "Share on social".

### 4. `src/hooks/useFanChallenges.ts` — surface real errors
- In `onError`, log full error to `console.error` so we can debug future failures.
- If insert fails due to RLS (missing rule), toast: *"Challenge unavailable — ask the artist to set up the challenge."*

### 5. Backfill the existing broken challenge rule (data fix)
- The current rule (`2f1ed6cd-...`) has empty metadata. Update it to:  
  `metadata = {"platform": "instagram", "instructions": "Share this track on your Instagram story and tap below.", "requires_proof": false}`  
- This makes the existing track work immediately for testing.

## Files changed
- `src/components/music/FanChallengeDialog.tsx` — fallback copy, console logging
- `src/components/music/AccessRuleEditor.tsx` — default platform on toggle, tip for empty config
- `src/components/music/ExclusiveTrackCard.tsx` — clearer free-challenge CTA, guard extra badges
- `src/hooks/useFanChallenges.ts` — better error surfacing
- **Data fix (insert tool)**: backfill metadata on rule `2f1ed6cd-f994-456b-865b-21324fa80cad`

## Test (after deploy)
1. Open the artist's profile as a different user → see **"Unlock — Free for fans"** button on `love` track.
2. Tap it → modal opens with clear instructions ("Share on Instagram…").
3. Tap **"I completed this"** → toast `"You unlocked this by supporting the artist 💖"` → badge flips to **"Unlocked via Challenge"** → full audio plays.
4. Hard refresh → still unlocked.
5. `SELECT count(*) FROM fan_challenge_completions` → returns 1.

