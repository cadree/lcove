-- Reuse the existing transactional queue and process-email-queue Resend worker.
-- Apply manually; this migration does not deploy or configure the worker.
CREATE OR REPLACE FUNCTION public.alert_admin_on_content_report()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  recipient record;
BEGIN
  FOR recipient IN
    SELECT DISTINCT u.id, u.email
    FROM auth.users u
    JOIN public.user_roles r ON r.user_id = u.id
    WHERE r.role = 'admin' AND u.email IS NOT NULL
  LOOP
    PERFORM public.enqueue_email('transactional_emails', jsonb_build_object(
      'message_id', 'content-report-' || NEW.id::text || '-' || recipient.id::text,
      'idempotency_key', 'content-report-' || NEW.id::text || '-' || recipient.id::text,
      'to', recipient.email,
      'subject', 'Ether moderation: new report — review within 24 hours',
      'text', 'A new content report requires review within 24 hours. Report ID: ' || NEW.id::text || '. Open the Ether admin moderation console to review, remove offending content and take action on abusive accounts.',
      'purpose', 'transactional',
      'label', 'content-report-alert',
      'queued_at', now()
    ));
  END LOOP;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.alert_admin_on_content_report() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS alert_admin_on_content_report ON public.content_reports;
CREATE TRIGGER alert_admin_on_content_report
AFTER INSERT ON public.content_reports
FOR EACH ROW EXECUTE FUNCTION public.alert_admin_on_content_report();
