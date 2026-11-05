# Apple fixes: manual rollout and device verification

No production database changes or deployments are performed by this PR.

## Moderation alerts

1. Apply `supabase/migrations/20261105120000_content_report_alerts.sql` manually after reviewing it. The SQL trigger function queues one alert for each distinct account with `public.user_roles.role = 'admin'` and an email in `auth.users`. Confirm the Ether admin has that role and a monitored email before enabling the trigger.
2. Reuse the existing `process-email-queue` Edge Function. Verify its secrets `RESEND_API_KEY`, `INTERNAL_FUNCTION_SECRET`, and verified `EMAIL_FROM` are configured; Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. No new email provider or secret is needed.
3. Verify the existing dashboard Cron job runs every minute (`* * * * *`), POSTs to the project's `/functions/v1/process-email-queue`, and sends `x-internal-secret` matching Vault's `internal_function_secret` and the Edge Function's `INTERNAL_FUNCTION_SECRET`. See `docs/deploy-ether-prod.md`. Never put secret values in SQL committed to Git.
4. In staging, submit a report as an ordinary user, check `email_send_log` for `content-report-alert`, and confirm receipt by the admin. Ensure that recipient is not suppressed. Monitor the transactional dead-letter queue: the existing worker retries delivery and moves expired/failed mail there (default transactional TTL: 60 minutes).
5. Staff the stated 24-hour moderation response. Email delivery alone does not enforce response time.

The trigger enqueues transactionally: queue failures roll back the report insert rather than silently losing its alert. No report body or reporter identity is sent by email.
