# Ether ID

A member card for every account. The in-app card is `/id`. The profile entry is **Show my ID**. The QR opens `/id/v/<token>`, which reads the live status. A saved image of the card is not proof.

## Where the fields come from

| Field | Source |
| --- | --- |
| Name, avatar | `profiles.display_name`, `profiles.avatar_url` |
| @username | `profiles.username`. There was no username column. It is lowercase, 3–20 letters, numbers, or underscores. |
| Passion | Earliest `user_passions` row: `custom_name`, otherwise `passions.name`. Empty when they have none. The card prints it on the cream bar. The red line uses the first word plus the city. |
| Status | `ether_member_status`. See below. |
| Peer reviews | `user_reviews` average and count. `reputation_scores` is store reviews and is not used. There is no endorsements table. Zero reviews is "No peer reviews", not a made-up average. The card prints `4.5 · 2`. |
| Projects completed | Distinct `projects` with `status = 'completed'` where the member is the creator or has an accepted application. Pending applications are not counted. The card prints the count. |
| Member since | `profiles.created_at`. The card prints a short month, such as `Oct 2026`. |
| Member of | `profiles.member_of`. Trimmed, at most 24 characters. Empty prints `LCOVE`. |
| City | `profiles.city_display`, or `profiles.city` when the display is blank. |
| Footer | The site and “scan the code to verify”. The member code is not printed. |
| Birthday | `birthday_month` and `birthday_day` only when `show_birthday` is true. No year is stored. The label is `self-reported`. `birth_year` stays an audience filter. The dossier face does not print the birthday. The edit form on `/id` still saves it. |

## Status

1. **Banned** when `access_status = 'banned'`.
2. **Suspended** when `is_suspended` is true.
3. **Active** when `access_status = 'active'`, onboarding is complete, and `last_active_at` is within 30 days. That 30-day window is the one audience targeting already uses.
4. **Inactive** otherwise.

A member cannot ban, unban, suspend, or unsuspend themselves. Onboarding can still move a non-banned account to active. Admins change standing through `admin_set_user_access`. That update moves `ether_id_passes.updated_at` and queues an Apple push when a device is registered. The verify function reads `profiles` on each call, so the public page flips without waiting for Wallet.

## Token

The QR is `eid1.<jti>.<exp>.<hmac>`. Signing calls `extensions.hmac` and `extensions.gen_random_bytes`, because hosted Supabase keeps pgcrypto in the `extensions` schema. The HMAC key is one row in `ether_id_secret`. The jti is a row in `ether_id_tokens`, not the user id. Tokens last 30 days, rotate when the member taps **Refresh code**, and stop verifying when revoked or expired. Anon cannot read the token table or the secret. Anon may call `get_ether_id_by_token` only. That function returns name, username, avatar, member since, and the live status.

## Apple Wallet

Generic pass. The status field is the live word in capitals (`ACTIVE`, `INACTIVE`, `SUSPENDED`, `BANNED`). The barcode is the same verify URL. `webServiceURL` is the `ether-id-pass` function.

PassKit routes, all without a Supabase JWT. The device sends `Authorization: ApplePass <token>` except on the serial-number list, which is how PassKit is specified:

- `POST /v1/devices/{device}/registrations/{passTypeId}/{serial}`
- `DELETE` that same path
- `GET /v1/devices/{device}/registrations/{passTypeId}?passesUpdatedSince=`
- `GET /v1/passes/{passTypeId}/{serial}`
- `POST /v1/log`

`POST /ether-id-pass/push` with `x-ether-id-push-secret` sends an empty APNs payload (`{}`, topic = Pass Type ID) to each registered device. The device then downloads a new pass.

The **Add to Apple Wallet** button is hidden unless `ether-id-pass` reports `configured: true`.

### Secrets

Set these on the `ether-id-pass` function. Do not commit the values.

| Secret | What it is |
| --- | --- |
| `APPLE_PASS_TYPE_ID` | Pass Type ID from Cadre's Apple Developer account, for example `pass.com.ether.member`. |
| `APPLE_TEAM_ID` | 10-character Team ID. Also the APNs JWT `iss`. |
| `APPLE_PASS_CERT_PEM` | Pass Type ID certificate PEM (the cert that signs passes). |
| `APPLE_PASS_KEY_PEM` | Private key PEM for that certificate. |
| `APPLE_WWDR_CERT_PEM` | Apple Worldwide Developer Relations intermediate certificate PEM (G4). |
| `APPLE_APNS_KEY_P8` | APNs auth key (`.p8`) from the same Apple account. |
| `APPLE_APNS_KEY_ID` | Key ID for that `.p8` (10 characters). |
| `ETHER_ID_PUSH_SECRET` | Shared secret for the status-change push. The database row must use the same value. |
| `ETHER_PUBLIC_SITE_URL` | Optional. Defaults to `https://etherbylcove.com`. Used as the QR origin inside the pass. |

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are already injected into edge functions.

After the secrets exist, point the database trigger at the function. This is the only step that is not in the migration, because the URL and secret are environment-specific:

```sql
UPDATE public.ether_id_runtime
SET
  push_url = 'https://<project-ref>.supabase.co/functions/v1/ether-id-pass/push',
  push_secret = '<same value as ETHER_ID_PUSH_SECRET>'
WHERE id = 1;
```

Until those secrets and that row are set, the in-app card and the verify page work. Wallet passes are not issued, and a ban does not push to Apple. The pass row's `updated_at` still moves, so the next device fetch would get the new status once signing is configured.

`deploy-supabase` is manual (`workflow_dispatch` only). A push does not deploy this function. When it is deployed, it returns `{ configured: false }` and does not sign anything while the secrets are missing.
