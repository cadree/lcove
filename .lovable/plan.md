

## Root cause

When an artist sets a track to free + fan-challenge-only ($0), clicking **Buy** still hits `purchase-exclusive-track`, which throws `"Invalid price"` on `amountCents <= 0`. The challenge-only path is also being blocked because:

1. `ExclusiveTrackCard` likely shows the **Buy** button when `price_cents === 0`, instead of routing to the challenge flow.
2. Even if challenge UI is shown, the purchase function is the only fallback — and it rejects $0.

Let me confirm by reading the card.
<lov-tool-use id="toolu_vrtx_01KcmmFjsNmiW18UDdxxvikJ" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/music/ExclusiveTrackCard.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01Kwqfb7xfoWRokZny5MZztC" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/music/ExclusiveTrackCard.tsx\"}">
</lov-tool-use>
I see the issue. When the artist sets price to $0 and only enables fan challenge, there's likely still a `purchase` rule with $0 amount, OR the track itself has `price_cents=0` triggering the Buy button which then errors out via "Invalid price" in the edge function.

Let me check the section file to see how the Buy/purchase is triggered.
<lov-tool-use id="toolu_vrtx_01To9qmxBjPQ5867iZtZKKCJ" name="code--search_files" integration-id="code" data="{\"query\": \"Invalid price\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_012p1QWwnE2vigTtxdMo5t4K" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/music/ExclusiveMusicSection.tsx\"}">
</lov-tool-use>
Now I understand the full picture. Let me check the card logic more carefully:

Looking at `ExclusiveTrackCard` line 58: `purchaseRule = trackRules.find((r) => r.rule_type === "purchase")`. 

The rule could exist with $0 BUT the bigger issue: line 61 sets `price = purchaseRule?.amount_cents ?? track.price_cents ?? 0`. The track itself has `price_cents` (defaulting to whatever artist set, including 0). 

Even with NO purchase rule, if there's no purchase rule at all, `purchaseRule` is undefined and the Buy button (line 157) wouldn't render. But since the track was uploaded with `access_type: "purchase"` and `price_cents: 0`, AND there's no implicit purchase rule unless artist created one... actually rethinking:

The `purchaseRule` requires an actual rule row. If artist only made a challenge rule, no Buy button would show. But user says "telling users that price is invalid." 

Looking again — there must be a `purchase` rule with $0. Either:
1. Artist created a purchase rule with $0 by mistake, OR
2. The system is auto-creating one, OR  
3. The challenge button itself is somehow routing through purchase

Actually checking the FanChallengeDialog flow vs the Buy flow - they're separate. So the issue must be: the artist created BOTH a $0 purchase rule AND a challenge rule, and users are clicking Buy.

Best fix: hide the Buy button if `price <= 0`, and in the edge function, if amount is 0 and there's a challenge rule, redirect to challenge (or just block 0-price purchases entirely with a clear message).

<lov-plan>

## Root cause

When the artist sets price to **$0** intending challenge-only unlock, the UI still renders a **Buy $0.00** button if any `purchase` rule exists (or if `track.price_cents = 0` falls through). Clicking it hits `purchase-exclusive-track` which throws **"Invalid price"** at line 85 (`if (amountCents <= 0) throw new Error("Invalid price")`). The challenge button is rendered alongside but users tap Buy first.

Two problems:
1. **UI**: Buy button shows for $0 tracks/rules — should never render when no payable amount exists.
2. **Backend**: `purchase-exclusive-track` rejects $0 with a confusing "Invalid price" error instead of guiding the user to the free unlock path.

## Fix

### 1. `src/components/music/ExclusiveTrackCard.tsx`
- Compute `isPaid = price > 0`.
- Only render the **Buy** button when `purchaseRule && price > 0`.
- When `!isPaid` and a `challengeRule` exists, the challenge button becomes the primary CTA (full width, default variant, no "secondary" demotion).
- Status badge: if `price === 0` and challenge rule exists → show **"Free via Challenge"** instead of `$0.00`.

### 2. `supabase/functions/purchase-exclusive-track/index.ts`
- Replace the generic `"Invalid price"` throw with a clearer message: `"This track is free — use the Fan Challenge to unlock it."` so any stray client call gets a helpful response instead of an opaque error. Return as structured `{ ok: false, error }` (already the existing pattern).

### 3. `src/components/music/AccessRuleEditor.tsx` (light guard)
- When `rule_type='purchase'` and `amount_cents === 0`, show an inline warning: *"Set a price above $0 — or remove this rule and rely on the Fan Challenge."* Prevents artists from re-creating the same broken state.

## Files changed
- `src/components/music/ExclusiveTrackCard.tsx` — gate Buy button on `price > 0`; promote challenge CTA; update badge.
- `supabase/functions/purchase-exclusive-track/index.ts` — clearer error for $0.
- `src/components/music/AccessRuleEditor.tsx` — inline warning on $0 purchase rules.

## Test checklist
1. Artist sets track `price_cents = 0`, no purchase rule, only a challenge rule → non-owner sees only **"Unlock via Challenge"** (no Buy button), badge reads **"Free via Challenge"**.
2. Artist accidentally creates a $0 purchase rule → editor shows the warning; if saved, Buy button still hidden because `price <= 0`.
3. Existing paid tracks ($5) still show Buy button and complete checkout normally.
4. Challenge completion unlocks track + grants full playback / save / download as before.
5. Refresh after unlock → still unlocked.

