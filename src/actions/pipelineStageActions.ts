import { supabase } from "@/integrations/supabase/client";

// Helper to get authenticated user ID
async function getAuthUserId(): Promise<string> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error("Not authenticated");
  }
  return user.id;
}

/**
 * Updates a pipeline stage name.
 */
export async function updateStageName(stageId: string, newName: string): Promise<void> {
  const userId = await getAuthUserId();
  
  const { error } = await supabase
    .from('pipeline_stages')
    .update({ name: newName })
    .eq('id', stageId)
    .eq('owner_user_id', userId);
  
  if (error) {
    throw new Error(`Failed to update stage name: ${error.message}`);
  }
}
