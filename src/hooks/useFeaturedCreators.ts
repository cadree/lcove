import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface FeaturedCreator {
  id: string;
  user_id: string;
  feature_type: 'weekly' | 'monthly' | 'spotlight';
  title: string | null;
  description: string | null;
  cover_image_url: string | null;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  display_order: number;
  profile?: {
    display_name: string | null;
    avatar_url: string | null;
    bio: string | null;
    city: string | null;
  };
  verification?: {
    status: string;
    badge_label: string | null;
    verification_type: string;
  } | null;
}

export function useFeaturedCreators(featureType?: 'weekly' | 'monthly' | 'spotlight') {
  return useQuery({
    queryKey: ['featured-creators', featureType],
    queryFn: async () => {
      let query = supabase
        .from('featured_creators')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (featureType) {
        query = query.eq('feature_type', featureType);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (!data || data.length === 0) return [];

      // Fetch profiles separately
      const userIds = data.map(f => f.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url, bio, city')
        .in('user_id', userIds);

      // Fetch verifications separately
      const { data: verifications } = await supabase
        .from('creator_verifications')
        .select('user_id, status, badge_label, verification_type')
        .in('user_id', userIds)
        .eq('status', 'approved');

      const profilesMap = new Map(profiles?.map(p => [p.user_id, p]));
      const verificationsMap = new Map(verifications?.map(v => [v.user_id, v]));

      return data.map(f => ({
        ...f,
        profile: profilesMap.get(f.user_id) || null,
        verification: verificationsMap.get(f.user_id) || null,
      })) as FeaturedCreator[];
    },
  });
}
