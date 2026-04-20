-- Event email branding (one row per event)
CREATE TABLE public.event_email_branding (
  event_id uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  from_name_override text,
  organizer_name text,
  reply_to_email text,
  reply_to_verified_at timestamptz,
  signature text,
  header_image_url text,
  brand_color text,
  personal_note text,
  connected_sender_provider text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.event_email_branding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hosts manage event email branding"
ON public.event_email_branding
FOR ALL
TO authenticated
USING (public.can_manage_event(event_id, auth.uid()))
WITH CHECK (public.can_manage_event(event_id, auth.uid()));

CREATE POLICY "Authenticated users can view event email branding"
ON public.event_email_branding
FOR SELECT
TO authenticated
USING (true);

CREATE TRIGGER trg_event_email_branding_updated_at
BEFORE UPDATE ON public.event_email_branding
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Host email verification codes
CREATE TABLE public.host_email_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_host_email_verifications_user ON public.host_email_verifications(user_id, email);

ALTER TABLE public.host_email_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own verifications"
ON public.host_email_verifications
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users create own verifications"
ON public.host_email_verifications
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own verifications"
ON public.host_email_verifications
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);