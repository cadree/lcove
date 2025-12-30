-- Pipeline Stages table
CREATE TABLE public.pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  color text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Pipeline Items table
CREATE TABLE public.pipeline_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stage_id uuid NOT NULL REFERENCES public.pipeline_stages(id) ON DELETE CASCADE,
  title text NOT NULL,
  subtitle text NULL,
  notes text NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Pipeline Events table
CREATE TABLE public.pipeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.pipeline_items(id) ON DELETE CASCADE,
  type text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_pipeline_stages_owner_sort ON public.pipeline_stages(owner_user_id, sort_order);
CREATE INDEX idx_pipeline_items_owner_stage_sort ON public.pipeline_items(owner_user_id, stage_id, sort_order);
CREATE INDEX idx_pipeline_events_owner_item_created ON public.pipeline_events(owner_user_id, item_id, created_at DESC);

-- Updated_at triggers
CREATE TRIGGER update_pipeline_stages_updated_at
  BEFORE UPDATE ON public.pipeline_stages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pipeline_items_updated_at
  BEFORE UPDATE ON public.pipeline_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_events ENABLE ROW LEVEL SECURITY;

-- Pipeline Stages RLS policies (owner-only)
CREATE POLICY "Users can view own stages"
  ON public.pipeline_stages FOR SELECT
  USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can create own stages"
  ON public.pipeline_stages FOR INSERT
  WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Users can update own stages"
  ON public.pipeline_stages FOR UPDATE
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Users can delete own stages"
  ON public.pipeline_stages FOR DELETE
  USING (auth.uid() = owner_user_id);

-- Pipeline Items RLS policies (owner-only)
CREATE POLICY "Users can view own items"
  ON public.pipeline_items FOR SELECT
  USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can create own items"
  ON public.pipeline_items FOR INSERT
  WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Users can update own items"
  ON public.pipeline_items FOR UPDATE
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Users can delete own items"
  ON public.pipeline_items FOR DELETE
  USING (auth.uid() = owner_user_id);

-- Pipeline Events RLS policies (owner-only)
CREATE POLICY "Users can view own events"
  ON public.pipeline_events FOR SELECT
  USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can create own events"
  ON public.pipeline_events FOR INSERT
  WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Users can delete own events"
  ON public.pipeline_events FOR DELETE
  USING (auth.uid() = owner_user_id);

-- Helper function to ensure default pipeline stages
CREATE OR REPLACE FUNCTION public.ensure_default_pipeline(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only insert default stages if user has zero stages
  IF NOT EXISTS (SELECT 1 FROM public.pipeline_stages WHERE owner_user_id = p_user_id) THEN
    INSERT INTO public.pipeline_stages (owner_user_id, name, sort_order, color) VALUES
      (p_user_id, 'New', 0, '#6366f1'),
      (p_user_id, 'Contacted', 1, '#f59e0b'),
      (p_user_id, 'Appointment', 2, '#10b981'),
      (p_user_id, 'Presented', 3, '#8b5cf6');
  END IF;
END;
$$;