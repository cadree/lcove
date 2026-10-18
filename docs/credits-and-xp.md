# Credits today, and options for XP

There is no XP or levels system in Ether. This note describes the credit economy that exists, then three designs Cadre can choose among. None of them are implemented.

## How credits work today

Two pools live on `user_credits`:

- **Genesis** is the starter grant. New profiles receive 100 genesis credits from a single `credit_ledger` row (`credit_type = genesis`, amount 100). The ledger trigger is the only writer of `user_credits`. Genesis is spent before earned credits. A transfer or tip burns the genesis portion: it leaves the sender and is not added to the recipient.
- **Earned** credits come from verified contributions, awards, and tips received. They can be transferred and paid out.

`balance` must equal `genesis_balance + earned_balance`. The trigger sets that sum. A later migration (`20261018204000_REQUIRES_CADRE_APPROVAL_reconcile_credit_balances.sql`) rebuilds stored balances from the ledger and adds a check constraint. It is not applied until Cadre approves it. Until then the wallet shows sums computed from the ledger (`credit_ledger_balances`), which can differ from the stored row if an older bug double-counted the genesis grant.

A ledger row whose matching split column is 0 (not null) is treated as `amount` of that `credit_type`. The other pool uses the split column as written.

### Earned

| Source | What is written |
| --- | --- |
| Signup | 100 genesis, once, via `grant_genesis_credits` |
| Verified contribution / `award-credits` | Earned ledger row |
| Tip received on a live stream | Earned ledger row for the host (`apply_stream_tip`) |

### Spent

| Sink | Split |
| --- | --- |
| Tip a stream | Genesis first, then earned. Idempotent on `(tipper_id, idempotency_key)`. Sets `credit_type` and the split amounts. |
| Transfer to another user | Genesis burned, earned delivered (existing `transfer-credits` function; unchanged here) |
| Event tickets, store items, payouts | Existing purchase and payout functions. They still read `user_credits` until the reconciliation migration is applied. Do not treat the wallet number as the spendable balance until that migration runs. |

## Three options for real XP and levels

Pick one. Do not combine them without a new decision.

### 1. Separate XP ledger

Add `xp_events` (user, source, amount, created_at) and a level table (thresholds). Credits stay money-like and never convert to XP. Likes, comments, RSVPs, and watch time would write XP only. Levels are a pure function of the XP sum. Rejected risk: two currencies in the UI unless the wallet and the profile stay visually distinct.

### 2. Levels from existing earned credits

Define levels as brackets of `lifetime_earned` (or of earned ledger sums). No new table. Genesis does not count, so buying or being granted starter credits cannot level someone up. Rejected risk: a tip and a payout change the same number people would read as status, and a credit spend would not lower a lifetime-based level unless the rule says otherwise.

### 3. Activity score, no currency

A nightly job counts posts, comments, events hosted, and minutes watched, stores one integer on the profile, and maps it to a named level. Credits are untouched. Rejected risk: the score is easy to game and needs its own abuse rules; it is also invisible until the job runs.

Cadre's choice should name the source of truth, whether levels can fall, and whether credits and XP are allowed to appear on the same screen.
