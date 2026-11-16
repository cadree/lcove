# ETHER applicant approval: rollout and delivery verification

This change introduces a mandatory public social/portfolio URL, a database-triggered review email, and optional admin-only new-application push alerts. **Do not merge the frontend or release a native build before applying the SQL to the same environment.**

## Order of operations

1. On **ether-staging** only, confirm that the `pgmq` extension and `transactional_emails` queue exist. Confirm that `process-email-queue` has `RESEND_API_KEY`, a verified `EMAIL_FROM`, `INTERNAL_FUNCTION_SECRET`, and its cron calls the worker every minute. Do not expose secret values.
2. Apply `supabase/migrations/20261116103000_onboarding_review_links_email.sql`, then `20261116104000_admin_application_push_preferences.sql` after prior pending-member access migrations. The second migration creates a durable push queue and per-admin preference (default OFF). It does not change existing user approval status.
3. Deploy the updated **process-email-queue** and **send-push-notification** Edge Functions to staging after the two SQL migrations. Confirm push credentials (VAPID for web, APNs for native iOS), the cron, and device subscriptions. Do not expose credentials in client code.
4. Submit a new **disposable staging account** and include either a public social profile link or a website. Both fields must reject invalid URLs and an empty pair.
5. Confirm the applicant appears in Admin → Onboarding with both supplied review links. Check that `transactional_emails` contains one `ether_application_pending` message and that `email_send_log` eventually records `sent`.
6. Confirm the **actual message** arrives at `etherbylcove@gmail.com` (Inbox or Spam), with name, city, links and admin review path. A queued message alone is not delivery.
7. In two staging admin accounts, turn **New member applications** push ON for the assigned reviewer and OFF for the other. Both should have global push enabled and a valid subscription. Submit a fresh application: only the opted-in admin receives the device push; neither the other admin nor an ordinary user does. Replaying the same queue job must not duplicate a delivered alert.
8. Edit the applicant profile; confirm no second email or push is generated. Test a new applicant with only a website. Approved legacy accounts without links must remain editable.
9. Check the oath wordmark on iPhone Safari and a native staging device; confirm visible form buttons with keyboard open. Reconfirm the new step and approval flow.
10. **Only after staging passes**, apply SQL to production, release the matching web frontend, and create a **new** native build. Older native builds lack the required review step, so don't roll out the database requirement until supported clients are available.

## Failure and rollback

Do not change production SMTP while investigating. Check queue worker logs, `email_send_log` (including failed/suppressed/dead-letter records), Resend activity and DNS/domain validation. Verify the `process-email-queue` scheduled job actually runs.

If rollback is necessary, first revert the frontend and stop the new push worker, then:

```sql
DROP TRIGGER IF EXISTS ether_enqueue_member_application_push ON public.profiles;
DROP FUNCTION IF EXISTS public.ether_enqueue_member_application_push();
DROP TRIGGER IF EXISTS ether_guard_admin_application_push_preference ON public.notification_preferences;
DROP FUNCTION IF EXISTS public.ether_guard_admin_application_push_preference();
DROP TRIGGER IF EXISTS ether_notify_pending_application ON public.profiles;
DROP TRIGGER IF EXISTS ether_require_application_links ON public.profiles;
DROP FUNCTION IF EXISTS public.ether_notify_pending_application();
DROP FUNCTION IF EXISTS public.ether_require_application_links();
```

Already enqueued emails or pushes may still be delivered; drain or stop the application push queue if rolling back. The added preference column and delivery ledger are deliberately retained to avoid losing audit data. Already saved social links remain on profiles. This migration does not backfill notifications for applications completed before installation. Never re-send real applications in bulk without checking queue history.
