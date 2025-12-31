-- Drop the old single-parameter version of ensure_default_pipeline to resolve ambiguity
DROP FUNCTION IF EXISTS public.ensure_default_pipeline(uuid);

-- The two-parameter version with default p_pipeline_id is already in place