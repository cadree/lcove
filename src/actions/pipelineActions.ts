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
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  // Contact info
  email: string | null;
  phone: string | null;
  company: string | null;
  role: string | null;
  // Social links (plain URLs)
  instagram_url: string | null;
  twitter_url: string | null;
  linkedin_url: string | null;
  tiktok_url: string | null;
  website_url: string | null;
  // CRM fields
  notes: string | null;
  priority: 'low' | 'medium' | 'high' | null;
  status: string | null;
  tags: string[] | null;
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
 */
export async function getMyPipeline(): Promise<PipelineData> {
  const userId = await getAuthUserId();
  
  const { data: stages, error: stagesError } = await supabase
    .from('pipeline_stages')
    .select('*')
    .eq('owner_user_id', userId)
    .order('sort_order', { ascending: true });
  
  if (stagesError) {
    throw new Error(`Failed to fetch stages: ${stagesError.message}`);
  }
  
  const { data: items, error: itemsError } = await supabase
    .from('pipeline_items')
    .select('*')
    .eq('owner_user_id', userId)
    .order('sort_order', { ascending: true });
  
  if (itemsError) {
    throw new Error(`Failed to fetch items: ${itemsError.message}`);
  }
  
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
 */
export interface CreatePipelineItemData {
  stageId: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  role?: string;
  instagramUrl?: string;
  twitterUrl?: string;
  linkedinUrl?: string;
  tiktokUrl?: string;
  websiteUrl?: string;
  notes?: string;
  priority?: 'low' | 'medium' | 'high';
  status?: string;
  tags?: string[];
}

export async function createPipelineItem(
  data: CreatePipelineItemData
): Promise<PipelineItem> {
  const userId = await getAuthUserId();
  
  const { data: existingItems } = await supabase
    .from('pipeline_items')
    .select('sort_order')
    .eq('owner_user_id', userId)
    .eq('stage_id', data.stageId)
    .order('sort_order', { ascending: false })
    .limit(1);
  
  const nextSortOrder = existingItems && existingItems.length > 0 
    ? existingItems[0].sort_order + 1 
    : 0;
  
  const { data: item, error: itemError } = await supabase
    .from('pipeline_items')
    .insert({
      owner_user_id: userId,
      stage_id: data.stageId,
      name: data.name,
      sort_order: nextSortOrder,
      email: data.email || null,
      phone: data.phone || null,
      company: data.company || null,
      role: data.role || null,
      instagram_url: data.instagramUrl || null,
      twitter_url: data.twitterUrl || null,
      linkedin_url: data.linkedinUrl || null,
      tiktok_url: data.tiktokUrl || null,
      website_url: data.websiteUrl || null,
      notes: data.notes || null,
      priority: data.priority || null,
      status: data.status || null,
      tags: data.tags || null
    })
    .select()
    .single();
  
  if (itemError || !item) {
    throw new Error(`Failed to create item: ${itemError?.message}`);
  }
  
  // Insert created event
  await supabase
    .from('pipeline_events')
    .insert({
      owner_user_id: userId,
      item_id: item.id,
      type: 'created',
      data: { name: data.name, stage_id: data.stageId }
    });
  
  return item as PipelineItem;
}

/**
 * Updates an existing pipeline item.
 */
export async function updatePipelineItem(
  item_id: string,
  fields: Partial<Omit<PipelineItem, 'id' | 'owner_user_id' | 'created_at' | 'updated_at'>>
): Promise<PipelineItem> {
  const userId = await getAuthUserId();
  
  const { data: item, error } = await supabase
    .from('pipeline_items')
    .update(fields)
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
 */
export async function movePipelineItem(
  item_id: string,
  to_stage_id: string,
  new_sort_order: number
): Promise<PipelineItem> {
  const userId = await getAuthUserId();
  
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
  
  if (stageChanged) {
    await supabase
      .from('pipeline_events')
      .insert({
        owner_user_id: userId,
        item_id: item_id,
        type: 'stage_changed',
        data: { from_stage_id, to_stage_id }
      });
  }
  
  return item as PipelineItem;
}

/**
 * Deletes a pipeline item.
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
 */
export async function addPipelineNoteEvent(
  item_id: string,
  noteText: string
): Promise<PipelineItem> {
  const userId = await getAuthUserId();
  
  const { data: currentItem, error: fetchError } = await supabase
    .from('pipeline_items')
    .select('notes')
    .eq('id', item_id)
    .eq('owner_user_id', userId)
    .single();
  
  if (fetchError || !currentItem) {
    throw new Error(`Failed to fetch item: ${fetchError?.message}`);
  }
  
  const timestamp = new Date().toISOString();
  const newNote = `[${timestamp}] ${noteText}`;
  const updatedNotes = currentItem.notes 
    ? `${currentItem.notes}\n\n${newNote}`
    : newNote;
  
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
  
  await supabase
    .from('pipeline_events')
    .insert({
      owner_user_id: userId,
      item_id: item_id,
      type: 'note_added',
      data: { note: noteText, timestamp }
    });
  
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
