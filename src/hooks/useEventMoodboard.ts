import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type MoodboardFileType = 'image' | 'video' | 'pdf' | 'doc' | 'presentation' | 'other';

export interface MoodboardItem {
  id: string;
  event_id: string;
  type: 'image' | 'link' | 'note' | 'itinerary' | 'file';
  media_url: string | null;
  link_url: string | null;
  title: string | null;
  body: string | null;
  start_time: string | null;
  sort_order: number;
  created_by: string;
  created_at: string;
  file_type: MoodboardFileType | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
}

export function classifyFile(file: File): MoodboardFileType {
  const m = file.type.toLowerCase();
  const n = file.name.toLowerCase();
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('video/')) return 'video';
  if (m === 'application/pdf' || n.endsWith('.pdf')) return 'pdf';
  if (n.endsWith('.ppt') || n.endsWith('.pptx') || m.includes('presentation')) return 'presentation';
  if (n.endsWith('.doc') || n.endsWith('.docx') || m.includes('word') || m === 'text/plain') return 'doc';
  return 'other';
}

export async function uploadMoodboardFile(userId: string, eventId: string, file: File) {
  const ext = file.name.split('.').pop() || 'bin';
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${userId}/event-moodboard/${eventId}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from('media').upload(path, file, {
    contentType: file.type || undefined,
  });
  if (error) throw error;
  return supabase.storage.from('media').getPublicUrl(path).data.publicUrl;
}

export function useEventMoodboard(eventId: string | null | undefined) {
  return useQuery({
    queryKey: ['event-moodboard', eventId],
    queryFn: async () => {
      if (!eventId) return [] as MoodboardItem[];
      const { data, error } = await supabase
        .from('event_moodboard_items')
        .select('*')
        .eq('event_id', eventId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as MoodboardItem[];
    },
    enabled: !!eventId,
  });
}

export function useAddMoodboardItem() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (item: Omit<MoodboardItem, 'id' | 'created_at' | 'created_by'>) => {
      if (!user) throw new Error('Must be logged in');
      const { data, error } = await supabase
        .from('event_moodboard_items')
        .insert({ ...item, created_by: user.id })
        .select()
        .single();
      if (error) throw error;
      return data as MoodboardItem;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['event-moodboard', data.event_id] });
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to add item'),
  });
}

export function useDeleteMoodboardItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, eventId }: { id: string; eventId: string }) => {
      const { error } = await supabase.from('event_moodboard_items').delete().eq('id', id);
      if (error) throw error;
      return eventId;
    },
    onSuccess: (eventId) => {
      qc.invalidateQueries({ queryKey: ['event-moodboard', eventId] });
    },
  });
}

export async function uploadMoodboardImage(userId: string, eventId: string, file: File) {
  return uploadMoodboardFile(userId, eventId, file);
}
