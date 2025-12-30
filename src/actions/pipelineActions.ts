import { supabase } from "@/integrations/supabase/client";

// Types for pipeline data
export interface PipelineStage {
  id: string;
  owner_user_id: string;
  name: string;
  sort_order: number;
  color: string | null;
  created_at: string;
  updated_at: string;
}

export interface PipelineItem {
  id: string;
  owner_user_id: string;
  stage_id: string;
  title: string;
  subtitle: string | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PipelineEvent {
  id: string;
  owner_user_id: string;
  item_id: string;
  type: string;
  data: Record<string, unknown>;
  created_at: string;
}

export interface PipelineData {
  stages: PipelineStage[];
  items: PipelineItem[];
  events: PipelineEvent[];
}

// Helper to get authenticated user ID
async function getAuthUserId(): Promise<string> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error("Not authenticated");
  }
  return user.id;
}

/**
 * Ensures default pipeline stages exist for the authenticated user.
 * Calls the database function public.ensure_default_pipeline(auth.uid())
 */
export async function ensureMyDefaultPipeline(): Promise<void> {
  const userId = await getAuthUserId();
  
  const { error } = await supabase.rpc('ensure_default_pipeline', {
    p_user_id: userId
  });
  
  if (error) {
    throw new Error(`Failed to ensure default pipeline: ${error.message}`);
  }
}

/**
 * Gets the full pipeline for the authenticated user.
 * Returns stages ordered by sort_order, items grouped by stage, and recent events.
 */
export async function getMyPipeline(): Promise<PipelineData> {
  const userId = await getAuthUserId();
  
  // Fetch stages
  const { data: stages, error: stagesError } = await supabase
    .from('pipeline_stages')
    .select('*')
    .eq('owner_user_id', userId)
    .order('sort_order', { ascending: true });
  
  if (stagesError) {
    throw new Error(`Failed to fetch stages: ${stagesError.message}`);
  }
  
  // Fetch items
  const { data: items, error: itemsError } = await supabase
    .from('pipeline_items')
    .select('*')
    .eq('owner_user_id', userId)
    .order('sort_order', { ascending: true });
  
  if (itemsError) {
    throw new Error(`Failed to fetch items: ${itemsError.message}`);
  }
  
  // Fetch recent events (last 50 per user, can be filtered per item client-side)
  const { data: events, error: eventsError } = await supabase
    .from('pipeline_events')
    .select('*')
    .eq('owner_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);
  
  if (eventsError) {
    throw new Error(`Failed to fetch events: ${eventsError.message}`);
  }
  
  return {
    stages: stages as PipelineStage[],
    items: items as PipelineItem[],
    events: events as PipelineEvent[]
  };
}

/**
 * Creates a new pipeline item in the specified stage.
 * Also creates a 'created' event.
 */
export async function createPipelineItem(
  stage_id: string,
  title: string,
  subtitle?: string
): Promise<PipelineItem> {
  const userId = await getAuthUserId();
  
  // Get max sort_order for items in this stage
  const { data: existingItems } = await supabase
    .from('pipeline_items')
    .select('sort_order')
    .eq('owner_user_id', userId)
    .eq('stage_id', stage_id)
    .order('sort_order', { ascending: false })
    .limit(1);
  
  const nextSortOrder = existingItems && existingItems.length > 0 
    ? existingItems[0].sort_order + 1 
    : 0;
  
  // Insert the item
  const { data: item, error: itemError } = await supabase
    .from('pipeline_items')
    .insert({
      owner_user_id: userId,
      stage_id,
      title,
      subtitle: subtitle || null,
      sort_order: nextSortOrder
    })
    .select()
    .single();
  
  if (itemError || !item) {
    throw new Error(`Failed to create item: ${itemError?.message}`);
  }
  
  // Insert created event
  const { error: eventError } = await supabase
    .from('pipeline_events')
    .insert({
      owner_user_id: userId,
      item_id: item.id,
      type: 'created',
      data: { title, stage_id }
    });
  
  if (eventError) {
    console.warn(`Failed to create event: ${eventError.message}`);
  }
  
  return item as PipelineItem;
}

/**
 * Updates an existing pipeline item.
 * Only updates owned items.
 */
export async function updatePipelineItem(
  item_id: string,
  fields: { title?: string; subtitle?: string; notes?: string }
): Promise<PipelineItem> {
  const userId = await getAuthUserId();
  
  const updateData: Record<string, unknown> = {};
  if (fields.title !== undefined) updateData.title = fields.title;
  if (fields.subtitle !== undefined) updateData.subtitle = fields.subtitle;
  if (fields.notes !== undefined) updateData.notes = fields.notes;
  
  const { data: item, error } = await supabase
    .from('pipeline_items')
    .update(updateData)
    .eq('id', item_id)
    .eq('owner_user_id', userId)
    .select()
    .single();
  
  if (error || !item) {
    throw new Error(`Failed to update item: ${error?.message}`);
  }
  
  return item as PipelineItem;
}

/**
 * Moves a pipeline item to a new stage and/or position.
 * Creates a 'stage_changed' event if the stage changes.
 */
export async function movePipelineItem(
  item_id: string,
  to_stage_id: string,
  new_sort_order: number
): Promise<PipelineItem> {
  const userId = await getAuthUserId();
  
  // Get current item to check stage change
  const { data: currentItem, error: fetchError } = await supabase
    .from('pipeline_items')
    .select('stage_id')
    .eq('id', item_id)
    .eq('owner_user_id', userId)
    .single();
  
  if (fetchError || !currentItem) {
    throw new Error(`Failed to fetch item: ${fetchError?.message}`);
  }
  
  const from_stage_id = currentItem.stage_id;
  const stageChanged = from_stage_id !== to_stage_id;
  
  // Update the item
  const { data: item, error: updateError } = await supabase
    .from('pipeline_items')
    .update({
      stage_id: to_stage_id,
      sort_order: new_sort_order
    })
    .eq('id', item_id)
    .eq('owner_user_id', userId)
    .select()
    .single();
  
  if (updateError || !item) {
    throw new Error(`Failed to move item: ${updateError?.message}`);
  }
  
  // Create stage_changed event if stage actually changed
  if (stageChanged) {
    const { error: eventError } = await supabase
      .from('pipeline_events')
      .insert({
        owner_user_id: userId,
        item_id: item_id,
        type: 'stage_changed',
        data: { from_stage_id, to_stage_id }
      });
    
    if (eventError) {
      console.warn(`Failed to create stage_changed event: ${eventError.message}`);
    }
  }
  
  return item as PipelineItem;
}

/**
 * Deletes a pipeline item.
 * Events are cascaded by the database.
 */
export async function deletePipelineItem(item_id: string): Promise<void> {
  const userId = await getAuthUserId();
  
  const { error } = await supabase
    .from('pipeline_items')
    .delete()
    .eq('id', item_id)
    .eq('owner_user_id', userId);
  
  if (error) {
    throw new Error(`Failed to delete item: ${error.message}`);
  }
}

/**
 * Adds a note to a pipeline item and creates a 'note_added' event.
 * Appends the note to existing notes with a timestamp.
 */
export async function addPipelineNoteEvent(
  item_id: string,
  noteText: string
): Promise<PipelineItem> {
  const userId = await getAuthUserId();
  
  // Get current item to append note
  const { data: currentItem, error: fetchError } = await supabase
    .from('pipeline_items')
    .select('notes')
    .eq('id', item_id)
    .eq('owner_user_id', userId)
    .single();
  
  if (fetchError || !currentItem) {
    throw new Error(`Failed to fetch item: ${fetchError?.message}`);
  }
  
  // Append note with timestamp
  const timestamp = new Date().toISOString();
  const newNote = `[${timestamp}] ${noteText}`;
  const updatedNotes = currentItem.notes 
    ? `${currentItem.notes}\n\n${newNote}`
    : newNote;
  
  // Update item notes
  const { data: item, error: updateError } = await supabase
    .from('pipeline_items')
    .update({ notes: updatedNotes })
    .eq('id', item_id)
    .eq('owner_user_id', userId)
    .select()
    .single();
  
  if (updateError || !item) {
    throw new Error(`Failed to update notes: ${updateError?.message}`);
  }
  
  // Create note_added event
  const { error: eventError } = await supabase
    .from('pipeline_events')
    .insert({
      owner_user_id: userId,
      item_id: item_id,
      type: 'note_added',
      data: { note: noteText, timestamp }
    });
  
  if (eventError) {
    console.warn(`Failed to create note_added event: ${eventError.message}`);
  }
  
  return item as PipelineItem;
}

/**
 * Gets events for a specific pipeline item.
 */
export async function getPipelineItemEvents(item_id: string): Promise<PipelineEvent[]> {
  const userId = await getAuthUserId();
  
  const { data: events, error } = await supabase
    .from('pipeline_events')
    .select('*')
    .eq('owner_user_id', userId)
    .eq('item_id', item_id)
    .order('created_at', { ascending: false });
  
  if (error) {
    throw new Error(`Failed to fetch events: ${error.message}`);
  }
  
  return events as PipelineEvent[];
}
