import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

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
}

interface StoryWithProfile extends Story {
  profile: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

export function useStories() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['stories'],
    queryFn: async () => {
      // Get all non-expired stories
      const { data: storiesData, error } = await supabase
        .from('stories')
        .select('*')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get profiles for story creators
      const userIds = [...new Set(storiesData?.map(s => s.user_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]));

      // Get view counts for each story (only for own stories)
      const storiesWithProfiles = await Promise.all(
        (storiesData || []).map(async (story) => {
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
            profile: profileMap.get(story.user_id) || { display_name: null, avatar_url: null },
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
  });

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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stories'] });
      toast.success('Story uploaded!');
    },
    onError: (error) => {
      toast.error('Failed to upload story');
      console.error(error);
    },
  });

  const recordView = useMutation({
    mutationFn: async (storyId: string) => {
      if (!user) return;
      
      await supabase
        .from('story_views')
        .upsert({
          story_id: storyId,
          viewer_id: user.id,
        }, { onConflict: 'story_id,viewer_id' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stories'] });
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

  return {
    stories: data?.stories || [],
    groupedStories: data?.grouped || {},
    isLoading,
    uploadStory,
    recordView,
    addReaction,
    refetch,
  };
}
