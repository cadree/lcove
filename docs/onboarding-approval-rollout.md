# ETHER applicant approval: rollout and delivery verification

This change introduces a mandatory public social/portfolio URL and a database-triggered review notification. **Do not merge the frontend or release a native build before applying the SQL to the same environment.**

## Order of operations

1. On **ether-staging** only, confirm that the `pgmq` extension and `transactional_emails` queue exist. Confirm that `process-email-queue` has `RESEND_API_KEY`, a verified `EMAIL_FROM`, `INTERNAL_FUNCTION_SECRET`, and its cron calls the worker every minute. Do not expose secret values.
2. Apply `supabase/migrations/20261116103000_onboarding_review_links_email.sql` after prior pending-member access migrations. It modifies only the `profiles` triggers and adds two private functions; it does not change existing profile data.
3. Submit a new **disposable staging account** and include either a public social profile link or a website. Both fields must reject invalid URLs and an empty pair.
4. Confirm the applicant appears in Admin → Onboarding with both supplied review links. Check that `transactional_emails` contains one `ether_application_pending` message and that `email_send_log` eventually records `sent`.
5. Confirm the **actual message** arrives at `etherbylcove@gmail.com` (Inbox or Spam), with name, city, links and admin review path. A queued message alone is not delivery.
6. Edit the applicant profile; confirm no second email is generated. Test a new applicant with only a website. Approved legacy accounts without links must remain editable.
7. Check the oath wordmark on iPhone Safari and a native staging device; confirm visible form buttons with keyboard open. Reconfirm the new step and approval flow.
8. **Only after staging passes**, apply SQL to production, release the matching web frontend, and create a **new** native build. Older native builds lack the required review step, so don't roll out the database requirement until supported clients are available.

## Failure and rollback

Do not change production SMTP while investigating. Check queue worker logs, `email_send_log` (including failed/suppressed/dead-letter records), Resend activity and DNS/domain validation. Verify the `process-email-queue` scheduled job actually runs.

If rollback is necessary, first revert the frontend, then:

```sql
DROP TRIGGER IF EXISTS ether_notify_pending_application ON public.profiles;
DROP TRIGGER IF EXISTS ether_require_application_links ON public.profiles;
DROP FUNCTION IF EXISTS public.ether_notify_pending_application();
DROP FUNCTION IF EXISTS public.ether_require_application_links();
```

Already enqueued emails may still be delivered, and already saved social links remain on profiles. This migration does not backfill notifications for applications completed before installation. Never re-send real applications in bulk without checking queue history.
