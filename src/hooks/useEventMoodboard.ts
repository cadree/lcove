import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface MoodboardItem {
  id: string;
  event_id: string;
  type: 'image' | 'link' | 'note' | 'itinerary';
  media_url: string | null;
  link_url: string | null;
  title: string | null;
  body: string | null;
  start_time: string | null;
  sort_order: number;
  created_by: string;
  created_at: string;
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
  const ext = file.name.split('.').pop();
  const path = `${userId}/event-moodboards/${eventId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('media').upload(path, file);
  if (error) throw error;
  return supabase.storage.from('media').getPublicUrl(path).data.publicUrl;
}
