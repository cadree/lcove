
CREATE OR REPLACE FUNCTION public.accept_custom_role_proposal(
  p_application_id UUID,
  p_custom_role_name TEXT,
  p_reviewer_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_application RECORD;
  v_project RECORD;
  v_new_role_id UUID;
BEGIN
  -- Get application
  SELECT * INTO v_application
  FROM project_applications
  WHERE id = p_application_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  IF v_application.status != 'pending' THEN
    RAISE EXCEPTION 'Application is not pending';
  END IF;

  -- Verify reviewer is project creator
  SELECT * INTO v_project
  FROM projects
  WHERE id = v_application.project_id;

  IF v_project.creator_id != p_reviewer_id THEN
    RAISE EXCEPTION 'Only the project creator can accept applications';
  END IF;

  -- Create the new role
  INSERT INTO project_roles (project_id, role_name, description, payout_amount, slots_available, slots_filled)
  VALUES (v_application.project_id, p_custom_role_name, 'Custom role proposed by applicant', 0, 1, 0)
  RETURNING id INTO v_new_role_id;

  -- Reassign application to new role
  UPDATE project_applications
  SET role_id = v_new_role_id
  WHERE id = p_application_id;

  -- Accept the application (trigger handles slots_filled increment)
  UPDATE project_applications
  SET status = 'accepted', reviewed_by = p_reviewer_id, reviewed_at = now()
  WHERE id = p_application_id;

  RETURN v_new_role_id;
END;
$$;
