import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { shouldRecordPostView } from '@/lib/sharing';
import { shotSessionEnabled } from '@/lib/shotSession';

const emptyDashboard = { views_30d: 0, photo_views_30d: 0, video_views_30d: 0 };

export function useOwnPostViewCounts(enabled = true) {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ['own-post-view-counts', user?.id],
    enabled: Boolean(user) && enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_own_post_view_counts', { p_post_ids: null });
      if (error) return {} as Record<string, number>;
      const counts: Record<string, number> = {};
      for (const row of data ?? []) counts[row.post_id] = Number(row.view_count);
      return counts;
    },
  });
  return query.data;
}

export function useOwnViewDashboard(enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['own-view-dashboard', user?.id],
    enabled: Boolean(user) && enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_own_view_dashboard');
      if (error || !data?.[0]) return emptyDashboard;
      const row = data[0];
      return {
        views_30d: Number(row.views_30d),
        photo_views_30d: Number(row.photo_views_30d),
        video_views_30d: Number(row.video_views_30d),
      };
    },
  });
}

export function useRecordPostView(postId: string | undefined, ownerId: string | undefined) {
  const { user } = useAuth();
  const ref = useRef<HTMLDivElement | null>(null);
  const sent = useRef<string | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || !postId || !shouldRecordPostView(user?.id, ownerId) || shotSessionEnabled()) return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      if (sent.current === postId) return;
      sent.current = postId;
      void supabase.rpc('record_post_view', { p_post_id: postId });
    }, { threshold: 0.5 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [postId, ownerId, user?.id]);

  return ref;
}
