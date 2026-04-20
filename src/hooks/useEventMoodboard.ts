import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type MoodboardFileType = 'image' | 'video' | 'pdf' | 'doc' | 'presentation' | 'other';
type MoodboardDbType = 'image' | 'link' | 'note' | 'itinerary';

type MoodboardDbItem = {
  id: string;
  event_id: string;
  type: MoodboardDbType;
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
};

export interface MoodboardItem extends Omit<MoodboardDbItem, 'type'> {
  type: MoodboardDbType | 'file';
}

function normalizeMoodboardItem(item: MoodboardDbItem): MoodboardItem {
  const isUploadedFile = item.type === 'link' && !!item.media_url && (!!item.file_type || !!item.file_name);
  return {
    ...item,
    type: isUploadedFile ? 'file' : item.type,
  };
}

function getInsertType(item: Pick<MoodboardItem, 'type' | 'media_url' | 'file_type' | 'file_name'>): MoodboardDbType {
  if (item.type === 'file') return 'link';
  if (item.type === 'link' && item.media_url && (item.file_type || item.file_name)) return 'link';
  return item.type;
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
      return ((data || []) as MoodboardDbItem[]).map(normalizeMoodboardItem);
    },
    enabled: !!eventId,
  });
}

export function useAddMoodboardItem() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (item: Partial<Omit<MoodboardItem, 'id' | 'created_at' | 'created_by'>> & Pick<MoodboardItem, 'event_id' | 'type'>) => {
      if (!user) throw new Error('Must be logged in');
      const payload = {
        ...item,
        type: getInsertType({
          type: item.type,
          media_url: item.media_url ?? null,
          file_type: item.file_type ?? null,
          file_name: item.file_name ?? null,
        }),
        created_by: user.id,
      };
      const { data, error } = await supabase
        .from('event_moodboard_items')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return normalizeMoodboardItem(data as MoodboardDbItem);
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
