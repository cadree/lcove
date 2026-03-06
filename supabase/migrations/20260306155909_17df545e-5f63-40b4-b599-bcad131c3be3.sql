
-- Add columns to project_clients for external client sharing
ALTER TABLE public.project_clients
  ALTER COLUMN client_user_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS client_token text UNIQUE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS client_name text,
  ADD COLUMN IF NOT EXISTS client_email text;

-- Create index on client_token for fast lookups
CREATE INDEX IF NOT EXISTS idx_project_clients_client_token ON public.project_clients(client_token) WHERE client_token IS NOT NULL;

-- Security definer function to fetch project data by client token (no auth required)
CREATE OR REPLACE FUNCTION public.get_client_project_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_client RECORD;
  v_project RECORD;
  v_creator RECORD;
  v_roles jsonb;
  v_milestones jsonb;
  v_call_sheets jsonb;
  v_attachments jsonb;
  v_deliverables jsonb;
BEGIN
  -- Find the client record by token
  SELECT * INTO v_client
  FROM project_clients
  WHERE client_token = p_token AND status != 'removed';

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Get the project
  SELECT * INTO v_project
  FROM projects
  WHERE id = v_client.project_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Get creator profile
  SELECT display_name, avatar_url INTO v_creator
  FROM profiles
  WHERE user_id = v_project.creator_id;

  -- Get confirmed roles
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', r.id, 'role_name', r.role_name, 'description', r.description,
    'slots_available', r.slots_available, 'slots_filled', r.slots_filled
  )), '[]'::jsonb) INTO v_roles
  FROM project_roles r
  WHERE r.project_id = v_project.id;

  -- Get milestones
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', m.id, 'title', m.title, 'status', m.status,
    'due_date', m.due_date, 'amount', m.amount
  ) ORDER BY m.due_date NULLS LAST), '[]'::jsonb) INTO v_milestones
  FROM project_milestones m
  WHERE m.project_id = v_project.id;

  -- Get call sheets
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', cs.id, 'shoot_date', cs.shoot_date,
    'general_location', cs.general_location, 'general_notes', cs.general_notes,
    'role_entries', cs.role_entries
  ) ORDER BY cs.shoot_date), '[]'::jsonb) INTO v_call_sheets
  FROM project_call_sheets cs
  WHERE cs.project_id = v_project.id;

  -- Get attachments
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', a.id, 'file_name', a.file_name, 'file_url', a.file_url,
    'file_type', a.file_type
  )), '[]'::jsonb) INTO v_attachments
  FROM project_attachments a
  WHERE a.project_id = v_project.id;

  RETURN jsonb_build_object(
    'project', jsonb_build_object(
      'id', v_project.id,
      'title', v_project.title,
      'description', v_project.description,
      'status', v_project.status,
      'progress_percent', v_project.progress_percent,
      'timeline_start', v_project.timeline_start,
      'timeline_end', v_project.timeline_end,
      'venue', v_project.venue,
      'location_secured', v_project.location_secured,
      'equipment_needed', v_project.equipment_needed,
      'props_needed', v_project.props_needed,
      'deliverables', v_project.deliverables,
      'cover_image_url', v_project.cover_image_url,
      'currency', v_project.currency
    ),
    'creator', jsonb_build_object(
      'display_name', v_creator.display_name,
      'avatar_url', v_creator.avatar_url
    ),
    'roles', v_roles,
    'milestones', v_milestones,
    'call_sheets', v_call_sheets,
    'attachments', v_attachments,
    'client_name', v_client.client_name
  );
END;
$$;
