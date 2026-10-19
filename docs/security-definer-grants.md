# Public SECURITY DEFINER grants

`20261018211500_lock_definer_grants_and_open_inserts.sql` classifies every `SECURITY DEFINER` function in `public` (71). Hosted Supabase grants `EXECUTE` on new public functions to `anon` and `authenticated`. `REVOKE ... FROM PUBLIC` does not remove those grants. PostgreSQL also grants `EXECUTE` to `PUBLIC` on a new function unless the global default is revoked, and `PUBLIC` includes `anon`.

Final grants:

| Class | Who can execute |
| --- | --- |
| anon | `anon`, `authenticated`, `service_role` |
| user | `authenticated`, `service_role` |
| trigger | `service_role` |
| internal | `service_role` |

Trigger functions still run for the signed-in role that writes the row. A scratch check updates a profile and inserts a post after `EXECUTE` is revoked from `authenticated`, and both triggers still fire. RLS helpers stay executable by the role that evaluates the policy.

`profiles_public` stays `security_invoker = false` and `security_barrier = true`. `profiles` SELECT is own-row only. An invoker view would hide every other profile. A base-table policy wide enough for the view to see other rows would also expose `phone` and the exam score. The view's `WHERE` clause is the exam-only rule, and it does not select those columns. `has_role` inside the view runs as the view owner.

`user_credits_pool_check` is `security_invoker = true`. It only reads `user_credits`, and that table already lets a reader see balances, so the invoker view does not widen access. Cadre's reconciliation query still runs as the table owner.

These seven public functions had no fixed `search_path`. They are set to `public, pg_temp`: `enqueue_email`, `read_email_batch`, `delete_email`, `move_to_dlq`, `ledger_entry_deltas`, `request_header`, `xp_level`. Extension functions that happen to live in `public` (pgcrypto) are not altered.

New functions created by the migration role are granted to `service_role` only. A signed-in RPC still needs an explicit `GRANT` to `authenticated`.

`ALTER DEFAULT PRIVILEGES` with no `FOR ROLE` applies to `current_user`. On hosted that is `postgres`, the owner of functions these migrations create. `FOR ROLE postgres` runs only when this session may act for `postgres` (the role itself, a member, or a superuser). `FOR ROLE supabase_admin` runs only when this session may act for `supabase_admin`. The Management API role is not a member of `supabase_admin` and is not a superuser. That statement used to abort the migration with `42501`. It is now a notice. The same notice covers `ALTER PUBLICATION` when `supabase_realtime` is owned by `supabase_admin`. Remove `profiles` in Dashboard, Database, Publications if the notice says the drop was skipped.

`accept_custom_role_proposal` and `ensure_default_pipeline` are called by the signed-in app and do not call `auth.uid()` themselves. `anon` cannot execute them. They still trust the user id argument.

## anon

Logged-out callers, or a policy that applies to `anon`.

| Function | Why |
| --- | --- |
| `can_manage_event(uuid, uuid)` | Public moodboard policy |
| `cinema_playback(uuid, uuid)` | Playback for a logged-out viewer. Checks `auth.uid()` inside |
| `get_artist_payout_status(uuid)` | Public profile buy state |
| `get_client_project_by_token(text)` | Public client portal |
| `get_platform_stats()` | Landing page counts |
| `get_public_creator_profile(uuid)` | Public project page |
| `has_blocked(uuid, uuid)` | Public post and comment policies |
| `has_role(uuid, app_role)` | Policies that apply to `public` |
| `is_board_member(uuid, uuid)` | Policies that apply to `public` |
| `is_conversation_participant(uuid, uuid)` | Policies that apply to `public` |
| `is_team_admin(uuid, uuid)` | Policies that apply to `public` |
| `is_team_member(uuid, uuid)` | Policies that apply to `public` |
| `membership_fund_snapshot(timestamptz, timestamptz)` | Home page fund totals |

## user

Signed-in callers, or a policy that applies only to `authenticated`.

| Function | Why |
| --- | --- |
| `accept_custom_role_proposal(uuid, text, uuid)` | Client RPC. Does not call `auth.uid()` |
| `check_in_attendee(text, uuid, text, text)` | Checks `auth.uid()` |
| `credit_balance_rows()` | Checks `auth.uid()` |
| `end_live_stream(uuid)` | Checks `auth.uid()` |
| `ensure_default_pipeline(uuid, uuid)` | Client RPC. Does not call `auth.uid()` |
| `get_admin_user_data()` | Checks `auth.uid()` |
| `get_attendee_crm_profile(text, uuid)` | Checks `auth.uid()` |
| `get_audience_estimate(jsonb)` | Checks `auth.uid()` |
| `get_audience_preview(jsonb, integer)` | Checks `auth.uid()` |
| `get_campaign_analytics(uuid)` | Checks `auth.uid()` |
| `get_user_emails_for_admin()` | Checks `auth.uid()` |
| `is_project_client(uuid, uuid)` | Authenticated project policies |
| `is_project_creator(uuid, uuid)` | Authenticated project policies |
| `record_content_view(uuid)` | Checks `auth.uid()` |
| `sender_blocked_in_conversation(uuid, uuid)` | Authenticated message insert policy |
| `touch_last_active()` | Checks `auth.uid()` |
| `touch_stream_presence(uuid)` | Checks `auth.uid()` |
| `upsert_attendee_note(text, uuid, text)` | Checks `auth.uid()` |

## trigger

`service_role` only. The writer does not need `EXECUTE`.

`add_org_owner_as_member`, `create_notification_preferences_for_new_user`, `enforce_report_insert`, `grant_genesis_credits`, `handle_application_accepted`, `handle_new_user`, `live_streams_seal_keys`, `log_task_event`, `prevent_blocked_follow`, `prevent_blocked_message`, `prevent_blocked_participant`, `touch_updated_at`, `update_conversation_timestamp`, `update_reputation_from_review`, `update_updated_at_column`, `update_user_credits`, `update_user_credits_dual`, `validate_credit_balances`, `validate_profile_completion`, `xp_on_application`, `xp_on_board_member`, `xp_on_post`, `xp_on_project_completed`, `xp_on_rsvp`.

`update_user_credits` is a trigger function with no trigger attached.

## internal

`service_role` only. Edge functions and other definer functions call these. The browser does not.

`apply_stream_tip(uuid, uuid, integer, text, text)`, `award_xp(uuid, text, uuid, integer)`, `calculate_reputation_score(uuid)`, `can_watch_network(uuid, uuid)`, `cancel_pending_store_order(uuid)`, `cancel_pending_ticket_order(uuid)`, `complete_store_credit_purchase(uuid, uuid, integer)`, `confirm_event_ticket_order(uuid, text)`, `confirm_store_card_order(uuid, text)`, `delete_email(text, bigint)`, `enqueue_email(text, jsonb)`, `is_user_blocked(uuid, uuid)`, `mark_store_order_refunded(text)`, `move_to_dlq(text, text, bigint, jsonb)`, `purge_user_personal_data(uuid)`, `read_email_batch(text, integer, integer)`.

`can_watch_network` is only called by `cinema_playback` and `record_content_view`, which run as the function owner. `is_user_blocked` has no caller in the app or in a policy. `calculate_reputation_score` is called by `update_reputation_from_review`.
