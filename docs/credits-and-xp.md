# Credits and private XP

Credits are money. XP is a private level for real contribution. They never convert into each other.

## How credits work

Two pools live on `user_credits`. That row is a cache. `credit_ledger` is the source of truth, and the ledger trigger is the only writer of the cache.

- **Genesis** is the starter grant. New profiles receive 100 genesis credits from a single `credit_ledger` row (`credit_type = genesis`, amount 100). Genesis is spent before earned credits. A transfer or tip burns the genesis portion: it leaves the sender and is not added to the recipient.
- **Earned** credits come from verified contributions, awards, and tips received. They can be transferred and paid out.

`balance` equals `genesis_balance + earned_balance`. The trigger sets that sum. `credit_ledger_balances(user_id)` returns the same three numbers by summing `ledger_entry_deltas`. The wallet, admin balance list, and every spend path (tips, transfers, awards, event tickets, store purchases, studio bookings, payouts, verified contributions, admin deductions) read that function. A stored row cannot disagree with what a spend will allow.

A ledger row whose matching split column is 0 (not null) is treated as `amount` of that `credit_type`. The other pool uses the split column as written.

`20261018204000_reconcile_credit_balances.sql` rebuilds the cache from the ledger and adds `CHECK (balance = genesis_balance + earned_balance)`. Cadre approved it. It has not been applied to any live database. Run it on staging first. Re-running it is safe: it does not insert or delete ledger rows.

### Earned

| Source | What is written |
| --- | --- |
| Signup | 100 genesis, once, via `grant_genesis_credits` |
| Verified contribution / `award-credits` | Earned ledger row |
| Tip received on a live stream | Earned ledger row for the host (`apply_stream_tip`) |

### Spent

| Sink | Split |
| --- | --- |
| Tip a stream | Genesis first, then earned. Idempotent on `(tipper_id, idempotency_key)`. The spend reads `credit_ledger_balances` while the cache row is locked. |
| Transfer to another user | Genesis burned, earned delivered. Both balances come from `credit_ledger_balances`. |
| Event tickets, store items, studio bookings, payouts | Existing purchase and payout functions. The price, split, and Stripe flow are unchanged. The balance they check and the `balance_after` they write come from `credit_ledger_balances`. |

## XP

Option 1 from the earlier note, narrowed so it does not reward engagement.

A separate `xp_events` ledger records contribution. Likes, comments, reactions, watch time, and follower counts do not write XP. There is no public total, no profile field other people can read, and no leaderboard. Levels do not fall: rows are append-only, and a level is only a bracket of the sum.

Rejected:

- **Levels from earned credits.** A tip and a payout would move the same number people read as status. Credits stay money.
- **A nightly activity score.** That score is shaped like engagement, it is late, and it is easier to farm.

### What awards XP

Database triggers call `award_xp`. Clients cannot insert `xp_events` and cannot execute `award_xp`. Each `(user_id, source, source_id)` is awarded once. A UTC day is capped at 40 XP; a later event the same day is skipped or cut to the room left, and the unique row still blocks a second award.

| Source | When | XP |
| --- | --- | --- |
| `post_work` | A post with text or media is created | 10 |
| `collaborate` | Someone other than the owner is added to a board as an editor, or a project application is accepted | 15 |
| `attend_event` | An RSVP becomes `going`, and the person is not the event creator | 10 |
| `complete_project` | A project status changes to `completed`. The creator and each accepted collaborator each receive it | 25 |

`interested` RSVPs, empty posts, owner board rows, and the host attending their own event do not award XP.

### Level

`xp_level` maps the private sum:

| Total | Level |
| --- | --- |
| 0–39 | 1 |
| 40–99 | 2 |
| 100–199 | 3 |
| 200–399 | 4 |
| 400 and above | 5 |

`my_xp()` returns `{ total, level }` for `auth.uid()` only. The signed-in user sees the level on their own profile and on the wallet. Another person's profile does not show it.
