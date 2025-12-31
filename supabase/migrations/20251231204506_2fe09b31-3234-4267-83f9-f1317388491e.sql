-- Create storage bucket for contact media
INSERT INTO storage.buckets (id, name, public) 
VALUES ('contact-media', 'contact-media', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for contact media
CREATE POLICY "Users can upload contact media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'contact-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view contact media"
ON storage.objects FOR SELECT
USING (bucket_id = 'contact-media');

CREATE POLICY "Users can delete own contact media"
ON storage.objects FOR DELETE
USING (bucket_id = 'contact-media' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Contact media gallery table
CREATE TABLE public.contact_media (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pipeline_item_id UUID NOT NULL REFERENCES public.pipeline_items(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'image', -- 'image' or 'video'
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.contact_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own contact media"
ON public.contact_media FOR SELECT
USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can create contact media"
ON public.contact_media FOR INSERT
WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Users can update own contact media"
ON public.contact_media FOR UPDATE
USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can delete own contact media"
ON public.contact_media FOR DELETE
USING (auth.uid() = owner_user_id);

CREATE INDEX idx_contact_media_pipeline_item ON public.contact_media(pipeline_item_id);

-- Contact quotes table
CREATE TABLE public.contact_quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pipeline_item_id UUID NOT NULL REFERENCES public.pipeline_items(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'sent', 'accepted', 'rejected'
  valid_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.contact_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own quotes"
ON public.contact_quotes FOR SELECT
USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can create quotes"
ON public.contact_quotes FOR INSERT
WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Users can update own quotes"
ON public.contact_quotes FOR UPDATE
USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can delete own quotes"
ON public.contact_quotes FOR DELETE
USING (auth.uid() = owner_user_id);

CREATE INDEX idx_contact_quotes_pipeline_item ON public.contact_quotes(pipeline_item_id);

-- Contact invoices table
CREATE TABLE public.contact_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pipeline_item_id UUID NOT NULL REFERENCES public.pipeline_items(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL,
  invoice_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  attached_images TEXT[] DEFAULT '{}',
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_rate NUMERIC DEFAULT 0,
  tax_amount NUMERIC DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'sent', 'paid', 'overdue', 'cancelled'
  due_date TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  sent_via TEXT, -- 'email' or 'sms'
  recipient_email TEXT,
  recipient_phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.contact_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own invoices"
ON public.contact_invoices FOR SELECT
USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can create invoices"
ON public.contact_invoices FOR INSERT
WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Users can update own invoices"
ON public.contact_invoices FOR UPDATE
USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can delete own invoices"
ON public.contact_invoices FOR DELETE
USING (auth.uid() = owner_user_id);

CREATE INDEX idx_contact_invoices_pipeline_item ON public.contact_invoices(pipeline_item_id);
CREATE INDEX idx_contact_invoices_status ON public.contact_invoices(status);