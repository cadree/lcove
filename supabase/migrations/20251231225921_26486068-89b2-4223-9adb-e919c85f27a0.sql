-- Update ensure_default_pipeline function to handle multiple pipelines
CREATE OR REPLACE FUNCTION ensure_default_pipeline(p_user_id UUID, p_pipeline_id UUID DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pipeline_id UUID;
  stage_colors TEXT[] := ARRAY['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6'];
  stage_names TEXT[] := ARRAY['New', 'Contacted', 'In Progress', 'Closed'];
BEGIN
  -- If no pipeline_id provided, get or create default pipeline
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
  
  -- Check if stages exist for this pipeline
  IF NOT EXISTS (
    SELECT 1 FROM pipeline_stages 
    WHERE owner_user_id = p_user_id AND pipeline_id = v_pipeline_id
  ) THEN
    -- Create default stages
    FOR i IN 1..4 LOOP
      INSERT INTO pipeline_stages (owner_user_id, pipeline_id, name, sort_order, color)
      VALUES (p_user_id, v_pipeline_id, stage_names[i], i - 1, stage_colors[i]);
    END LOOP;
  END IF;
  
  RETURN v_pipeline_id;
END;
$$;