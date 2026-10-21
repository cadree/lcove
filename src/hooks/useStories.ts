import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserBlocks } from '@/hooks/useUserBlocks';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/errorMessage';
import { shotContentThin, shotSessionEnabled, shotStories } from '@/lib/shotSession';
import { useUserBlocks } from '@/hooks/useUserBlocks';

interface Story {
  id: string;
  user_id: string;
  media_url: string;
  media_type: 'photo' | 'video';
  is_live: boolean;
  created_at: string;
  expires_at: string;
  profile?: {
    display_name: string | null;
    avatar_url: string | null;
  };
  view_count?: number;
  has_viewed?: boolean;
  source_post_id?: string | null;
  credit_user_id?: string | null;
  credit_profile?: {
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

interface StoryWithProfile extends Story {
  profile: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

export function useStories() {
  const { user } = useAuth();
  const { blockedIds } = useUserBlocks();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch, error } = useQuery({
    queryKey: ['stories'],
    queryFn: async () => {
      if (shotSessionEnabled()) return shotContentThin() ? { stories: [], grouped: {} } : shotStories();
      console.log('[useStories] Fetching stories...');
      
      // Get all non-expired stories
      const { data: storiesData, error: storiesError } = await supabase
        .from('stories')
        .select('*')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (storiesError) {
        console.error('[useStories] Error fetching stories:', storiesError);
        throw storiesError;
      }

      console.log('[useStories] Fetched', storiesData?.length || 0, 'stories');

      if (!storiesData || storiesData.length === 0) {
        return { stories: [], grouped: {} };
      }

      // Get profiles for story creators
      const userIds = [...new Set([
        ...storiesData.map(s => s.user_id),
        ...storiesData.flatMap(s => s.credit_user_id ? [s.credit_user_id] : []),
      ])];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles_public')
        .select('user_id, display_name, avatar_url')
        .in('user_id', userIds);

      if (profilesError) {
        console.error('[useStories] Error fetching profiles:', profilesError);
        // Don't throw - continue with empty profiles
      }

      console.log('[useStories] Fetched', profiles?.length || 0, 'profiles for story creators');

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      // Get view counts for each story (only for own stories)
      const storiesWithProfiles = await Promise.all(
        storiesData.map(async (story) => {
          let viewCount = 0;
          let hasViewed = false;

          if (user) {
            // Check if current user has viewed this story
            const { data: viewData } = await supabase
              .from('story_views')
              .select('id')
              .eq('story_id', story.id)
              .eq('viewer_id', user.id)
              .maybeSingle();
            
            hasViewed = !!viewData;

            // Get view count only if user owns this story
            if (story.user_id === user.id) {
              const { count } = await supabase
                .from('story_views')
                .select('*', { count: 'exact', head: true })
                .eq('story_id', story.id);
              viewCount = count || 0;
            }
          }

          return {
            ...story,
            profile: profileMap.get(story.user_id) || { display_name: 'Private profile', avatar_url: null },
            credit_profile: story.credit_user_id ? profileMap.get(story.credit_user_id) || null : null,
            view_count: viewCount,
            has_viewed: hasViewed,
          } as StoryWithProfile;
        })
      );

      // Group stories by user
      const groupedByUser = storiesWithProfiles.reduce((acc, story) => {
        if (!acc[story.user_id]) {
          acc[story.user_id] = [];
        }
        acc[story.user_id].push(story);
        return acc;
      }, {} as Record<string, StoryWithProfile[]>);

      return { stories: storiesWithProfiles, grouped: groupedByUser };
    },
    retry: 2,
    retryDelay: 1000,
  });

  // Set up realtime subscription for story views
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('story-views-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'story_views',
        },
        (payload) => {
          // Invalidate stories query to refresh view counts
          queryClient.invalidateQueries({ queryKey: ['stories'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  const uploadStory = useMutation({
    mutationFn: async ({ file, mediaType }: { file: File; mediaType: 'photo' | 'video' }) => {
      if (!user) throw new Error('Must be logged in');

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(fileName);

      const { error: insertError } = await supabase
        .from('stories')
        .insert({
          user_id: user.id,
          media_url: publicUrl,
          media_type: mediaType,
        });

      if (insertError) throw insertError;
      return { mediaUrl: publicUrl };
    },
    onMutate: async ({ file, mediaType }) => {
      if (!user) return;
      await queryClient.cancelQueries({ queryKey: ['stories'] });
      const previous = queryClient.getQueryData(['stories']);
      const preview = URL.createObjectURL(file);
      const optimistic = {
        id: `optimistic-${Date.now()}`,
        user_id: user.id,
        media_url: preview,
        media_type: mediaType,
        is_live: false,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        profile: { display_name: 'You', avatar_url: null },
        view_count: 0,
        has_viewed: true,
      };
      queryClient.setQueryData(['stories'], (current: { stories?: StoryWithProfile[]; grouped?: Record<string, StoryWithProfile[]> } | undefined) => {
        const stories = [optimistic, ...(current?.stories ?? [])];
        const grouped = {
          ...(current?.grouped ?? {}),
          [user.id]: [optimistic, ...(current?.grouped?.[user.id] ?? [])],
        };
        return { stories, grouped };
      });
      return { previous, preview };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stories'] });
      toast.success('Story posted');
    },
    onError: (error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['stories'], context.previous);
      if (context?.preview) URL.revokeObjectURL(context.preview);
      toast.error(errorMessage(error, 'Failed to upload story'));
      console.error(error);
    },
  });

  const recordView = useMutation({
    mutationFn: async (storyId: string) => {
      if (!user) return;
      
      // Use insert with onConflict to handle duplicates
      const { error } = await supabase
        .from('story_views')
        .upsert({
          story_id: storyId,
          viewer_id: user.id,
          viewed_at: new Date().toISOString(),
        }, { 
          onConflict: 'story_id,viewer_id',
          ignoreDuplicates: true 
        });

      if (error) {
        console.error('Failed to record view:', error);
        throw error;
      }
    },
    onSuccess: () => {
      // Immediately invalidate to update view counts
      queryClient.invalidateQueries({ queryKey: ['stories'] });
    },
    onError: (error) => {
      console.error('Record view error:', error);
    },
  });

  const addReaction = useMutation({
    mutationFn: async ({ storyId, emoji }: { storyId: string; emoji: string }) => {
      if (!user) throw new Error('Must be logged in');

      await supabase
        .from('story_reactions')
        .upsert({
          story_id: storyId,
          user_id: user.id,
          emoji,
        }, { onConflict: 'story_id,user_id' });
    },
    onSuccess: () => {
      toast.success('Reaction sent!');
    },
  });

  const stories = useMemo(() => {
    const rows = (data?.stories || []) as StoryWithProfile[];
    return rows.filter((story) => {
      if (blockedIds.includes(story.user_id)) return false;
      if (story.credit_user_id && blockedIds.includes(story.credit_user_id)) return false;
      return true;
    });
  }, [data?.stories, blockedIds]);

  const groupedStories = useMemo(() => {
    return stories.reduce((acc, story) => {
      if (!acc[story.user_id]) acc[story.user_id] = [];
      acc[story.user_id].push(story);
      return acc;
    }, {} as Record<string, StoryWithProfile[]>);
  }, [stories]);

  return {
    stories,
    groupedStories,
    isLoading,
    error,
    uploadStory,
    recordView,
    addReaction,
    refetch,
  };
}
