-- Drop existing calendar_tasks policies that might conflict
DROP POLICY IF EXISTS "Users can view their own calendar tasks" ON calendar_tasks;
DROP POLICY IF EXISTS "Users can delete their own calendar tasks" ON calendar_tasks;
DROP POLICY IF EXISTS "Users can update their own calendar tasks" ON calendar_tasks;
DROP POLICY IF EXISTS "Users can create their own calendar tasks" ON calendar_tasks;

-- Recreate calendar_tasks policies properly
CREATE POLICY "Users can view their own calendar tasks"
ON calendar_tasks FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own calendar tasks"
ON calendar_tasks FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own calendar tasks"
ON calendar_tasks FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own calendar tasks"
ON calendar_tasks FOR DELETE
USING (user_id = auth.uid());