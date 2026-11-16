-- Storage has a separate API and does not run PostgREST's request hook.
-- Applicants can manage their own onboarding uploads; private member objects
-- remain unavailable. Public bucket URLs are intentionally still public.
BEGIN;
CREATE POLICY ether_pending_access ON storage.objects AS RESTRICTIVE
 FOR ALL TO authenticated
 USING ((SELECT public.ether_member_approved()) OR owner_id=(SELECT auth.uid())::text)
 WITH CHECK ((SELECT public.ether_member_approved()) OR owner_id=(SELECT auth.uid())::text);
COMMIT;
