-- Create pipelines table
CREATE TABLE IF NOT EXISTS public.pipelines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own pipelines" ON public.pipelines
  FOR SELECT USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can insert their own pipelines" ON public.pipelines
  FOR INSERT WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Users can update their own pipelines" ON public.pipelines
  FOR UPDATE USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can delete their own pipelines" ON public.pipelines
  FOR DELETE USING (auth.uid() = owner_user_id);

-- Add pipeline_id column to pipeline_stages if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'pipeline_stages' 
    AND column_name = 'pipeline_id'
  ) THEN
    ALTER TABLE public.pipeline_stages ADD COLUMN pipeline_id UUID REFERENCES public.pipelines(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create updated_at trigger for pipelines
CREATE TRIGGER update_pipelines_updated_at
  BEFORE UPDATE ON public.pipelines
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Drop old function if exists and recreate
DROP FUNCTION IF EXISTS public.ensure_default_pipeline(uuid, uuid);

CREATE OR REPLACE FUNCTION public.ensure_default_pipeline(p_user_id uuid, p_pipeline_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pipeline_id UUID;
  stage_colors TEXT[] := ARRAY['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6'];
  stage_names TEXT[] := ARRAY['New', 'Contacted', 'In Progress', 'Closed'];
BEGIN
  IF p_pipeline_id IS NULL THEN
    SELECT id INTO v_pipeline_id
    FROM pipelines
    WHERE owner_user_id = p_user_id
    ORDER BY sort_order, created_at
    LIMIT 1;
    
    IF v_pipeline_id IS NULL THEN
      INSERT INTO pipelines (owner_user_id, name, sort_order)
      VALUES (p_user_id, 'My Pipeline', 0)
      RETURNING id INTO v_pipeline_id;
    END IF;
  ELSE
    v_pipeline_id := p_pipeline_id;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pipeline_stages 
    WHERE owner_user_id = p_user_id AND pipeline_id = v_pipeline_id
  ) THEN
    FOR i IN 1..4 LOOP
      INSERT INTO pipeline_stages (owner_user_id, pipeline_id, name, sort_order, color)
      VALUES (p_user_id, v_pipeline_id, stage_names[i], i - 1, stage_colors[i]);
    END LOOP;
  END IF;
  
  RETURN v_pipeline_id;
END;
$$;