import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface Network {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  banner_url: string | null;
  logo_url: string | null;
  is_paid: boolean;
  subscription_price: number;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
  is_public: boolean;
  genre: string | null;
  subscriber_count: number;
  total_views: number;
  created_at: string;
  updated_at: string;
  owner_profile?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

export interface NetworkContent {
  id: string;
  network_id: string;
  creator_id: string;
  title: string;
  description: string | null;
  cover_art_url: string | null;
  trailer_url: string | null;
  content_type: 'short_film' | 'feature_film' | 'tv_show';
  runtime_minutes: number | null;
  video_url: string | null;
  external_video_url: string | null;
  director: string | null;
  cast_members: string[] | null;
  credits: Record<string, any>;
  genre_tags: string[] | null;
  is_featured: boolean;
  view_count: number;
  release_date: string | null;
  is_published: boolean;
  created_at: string;
}

export interface TVSeason {
  id: string;
  content_id: string;
  season_number: number;
  title: string | null;
  description: string | null;
  cover_art_url: string | null;
  episodes?: TVEpisode[];
}

export interface TVEpisode {
  id: string;
  season_id: string;
  episode_number: number;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  video_url: string | null;
  external_video_url: string | null;
  runtime_minutes: number | null;
}

export interface WatchHistory {
  id: string;
  user_id: string;
  content_id: string | null;
  episode_id: string | null;
  progress_seconds: number;
  duration_seconds: number | null;
  completed: boolean;
  last_watched_at: string;
}

// Fetch all public networks
export const useNetworks = (genre?: string) => {
  return useQuery({
    queryKey: ['networks', genre],
    queryFn: async () => {
      let query = supabase
        .from('networks')
        .select('*')
        .eq('is_public', true)
        .order('subscriber_count', { ascending: false });

      if (genre) {
        query = query.eq('genre', genre);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Network[];
    },
  });
};

// Fetch a single network with content
export const useNetwork = (networkId: string) => {
  return useQuery({
    queryKey: ['network', networkId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('networks')
        .select('*')
        .eq('id', networkId)
        .single();

      if (error) throw error;
      return data as Network;
    },
    enabled: !!networkId,
  });
};

// Fetch network content
export const useNetworkContent = (networkId: string) => {
  return useQuery({
    queryKey: ['network-content', networkId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('network_content')
        .select('*')
        .eq('network_id', networkId)
        .eq('is_published', true)
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as NetworkContent[];
    },
    enabled: !!networkId,
  });
};

// Fetch single content item
export const useContent = (contentId: string) => {
  return useQuery({
    queryKey: ['content', contentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('network_content')
        .select('*')
        .eq('id', contentId)
        .single();

      if (error) throw error;
      return data as NetworkContent;
    },
    enabled: !!contentId,
  });
};

// Fetch TV seasons for content
export const useTVSeasons = (contentId: string) => {
  return useQuery({
    queryKey: ['tv-seasons', contentId],
    queryFn: async () => {
      const { data: seasons, error } = await supabase
        .from('tv_seasons')
        .select('*')
        .eq('content_id', contentId)
        .order('season_number');

      if (error) throw error;

      // Fetch episodes for each season
      const seasonsWithEpisodes = await Promise.all(
        (seasons || []).map(async (season) => {
          const { data: episodes } = await supabase
            .from('tv_episodes')
            .select('*')
            .eq('season_id', season.id)
            .order('episode_number');
          return { ...season, episodes: episodes || [] };
        })
      );

      return seasonsWithEpisodes as TVSeason[];
    },
    enabled: !!contentId,
  });
};

// Fetch user's watch history
export const useWatchHistory = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['watch-history', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('watch_history')
        .select('*')
        .eq('user_id', user.id)
        .order('last_watched_at', { ascending: false });

      if (error) throw error;
      return data as WatchHistory[];
    },
    enabled: !!user,
  });
};

// Update watch progress
export const useUpdateWatchProgress = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      contentId, 
      episodeId, 
      progressSeconds, 
      durationSeconds 
    }: { 
      contentId?: string; 
      episodeId?: string; 
      progressSeconds: number; 
      durationSeconds: number;
    }) => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('watch_history')
        .upsert({
          user_id: user.id,
          content_id: contentId || null,
          episode_id: episodeId || null,
          progress_seconds: progressSeconds,
          duration_seconds: durationSeconds,
          completed: progressSeconds >= durationSeconds * 0.9,
          last_watched_at: new Date().toISOString(),
        }, { onConflict: 'user_id,content_id,episode_id' });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watch-history'] });
    },
  });
};

// Create network
export const useCreateNetwork = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (networkData: Partial<Network>) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('networks')
        .insert({
          name: networkData.name!,
          description: networkData.description,
          banner_url: networkData.banner_url,
          logo_url: networkData.logo_url,
          is_paid: networkData.is_paid,
          subscription_price: networkData.subscription_price,
          is_public: networkData.is_public,
          genre: networkData.genre,
          owner_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['networks'] });
      queryClient.invalidateQueries({ queryKey: ['my-networks'] });
      toast.success('Network created successfully!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
};

// Fetch user's owned networks
export const useMyNetworks = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-networks', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('networks')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Network[];
    },
    enabled: !!user,
  });
};

// Add content to network
export const useAddContent = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contentData: Partial<NetworkContent> & { network_id: string }) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('network_content')
        .insert({
          network_id: contentData.network_id,
          title: contentData.title!,
          content_type: contentData.content_type!,
          description: contentData.description,
          cover_art_url: contentData.cover_art_url,
          trailer_url: contentData.trailer_url,
          runtime_minutes: contentData.runtime_minutes,
          video_url: contentData.video_url,
          external_video_url: contentData.external_video_url,
          director: contentData.director,
          cast_members: contentData.cast_members,
          genre_tags: contentData.genre_tags,
          is_featured: contentData.is_featured,
          is_published: contentData.is_published,
          release_date: contentData.release_date,
          creator_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['network-content', variables.network_id] });
      toast.success('Content added successfully!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
};

// Fetch content genres
export const useContentGenres = () => {
  return useQuery({
    queryKey: ['content-genres'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_genres')
        .select('*')
        .order('name');

      if (error) throw error;
      return data;
    },
  });
};

// Check network subscription
export const useNetworkSubscription = (networkId: string) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['network-subscription', networkId, user?.id],
    queryFn: async () => {
      if (!user) return { subscribed: false };

      const { data, error } = await supabase.functions.invoke('check-network-subscription', {
        body: { networkId },
      });

      if (error) throw error;
      return data;
    },
    enabled: !!user && !!networkId,
  });
};

// Subscribe to network
export const useSubscribeToNetwork = () => {
  return useMutation({
    mutationFn: async (networkId: string) => {
      const { data, error } = await supabase.functions.invoke('create-network-subscription', {
        body: { networkId },
      });

      if (error) throw error;
      if (data.url) {
        // Redirect directly instead of opening new tab (avoids popup blocker)
        window.location.href = data.url;
      }
      return data;
    },
    onError: (error: Error) => {
      toast.error(`Subscription failed: ${error.message}`);
    },
  });
};

// Increment view count (placeholder - would need RPC function)
export const useIncrementViewCount = () => {
  return useMutation({
    mutationFn: async (contentId: string) => {
      // View count increment - silently skip for now
      console.log('View count for:', contentId);
    },
  });
};
