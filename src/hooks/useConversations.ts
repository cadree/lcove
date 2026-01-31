import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Participant {
  user_id: string;
  joined_at: string;
  last_read_at: string | null;
  is_muted: boolean;
  project_role_name?: string | null;
  profile?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface ProjectInfo {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  status: string;
  timeline_start: string | null;
  timeline_end: string | null;
}

interface Conversation {
  id: string;
  type: 'direct' | 'group';
  name: string | null;
  avatar_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  project_id?: string | null;
  project?: ProjectInfo | null;
  participants?: Participant[];
  last_message?: {
    content: string | null;
    media_type: string | null;
    created_at: string;
    sender_id: string;
  };
  unread_count?: number;
}

export function useConversations() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: conversations = [], isLoading, refetch } = useQuery({
    queryKey: ['conversations', user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Get all conversations user is part of
      const { data: participations, error: partError } = await supabase
        .from('conversation_participants')
        .select('conversation_id, last_read_at, is_muted')
        .eq('user_id', user.id);

      if (partError) throw partError;
      if (!participations?.length) return [];

      const conversationIds = participations.map(p => p.conversation_id);

      // Get conversation details
      const { data: convos, error: convError } = await supabase
        .from('conversations')
        .select('*')
        .in('id', conversationIds)
        .order('updated_at', { ascending: false });

      if (convError) throw convError;

      // Get all participants for these conversations
      const { data: allParticipants } = await supabase
        .from('conversation_participants')
        .select('conversation_id, user_id, joined_at, last_read_at, is_muted, project_role_name')
        .in('conversation_id', conversationIds);

      // Fetch project details for project-linked conversations
      const projectIds = convos?.filter(c => (c as any).project_id).map(c => (c as any).project_id) || [];
      let projectMap = new Map<string, ProjectInfo>();
      
      if (projectIds.length > 0) {
        const { data: projects } = await supabase
          .from('projects')
          .select('id, title, description, cover_image_url, status, timeline_start, timeline_end')
          .in('id', projectIds);
        
        projectMap = new Map(projects?.map(p => [p.id, p as ProjectInfo]) || []);
      }

      // Get profiles for all participants using profiles_public view
      const userIds = [...new Set(allParticipants?.map(p => p.user_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles_public')
        .select('user_id, display_name, avatar_url')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]));

      // Get last message for each conversation
      const lastMessages = await Promise.all(
        conversationIds.map(async (convId) => {
          const { data } = await supabase
            .from('messages')
            .select('content, media_type, created_at, sender_id')
            .eq('conversation_id', convId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          return { convId, message: data };
        })
      );

      const lastMessageMap = new Map(lastMessages.map(lm => [lm.convId, lm.message]));

      // Get unread counts
      const unreadCounts = await Promise.all(
        participations.map(async (p) => {
          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', p.conversation_id)
            .is('deleted_at', null)
            .neq('sender_id', user.id)
            .gt('created_at', p.last_read_at || '1970-01-01');
          return { convId: p.conversation_id, count: count || 0 };
        })
      );

      const unreadMap = new Map(unreadCounts.map(uc => [uc.convId, uc.count]));
      const mutedMap = new Map(participations.map(p => [p.conversation_id, p.is_muted]));

      return (convos || []).map(conv => {
        const projectId = (conv as any).project_id;
        return {
          ...conv,
          project_id: projectId,
          project: projectId ? projectMap.get(projectId) : null,
          participants: allParticipants
            ?.filter(p => p.conversation_id === conv.id)
            .map(p => ({
              ...p,
              project_role_name: (p as any).project_role_name,
              profile: profileMap.get(p.user_id),
            })),
          last_message: lastMessageMap.get(conv.id),
          unread_count: unreadMap.get(conv.id) || 0,
          is_muted: mutedMap.get(conv.id) || false,
        };
      }) as Conversation[];
    },
    enabled: !!user,
  });

  // Create direct conversation
  const createDirectConversation = useMutation({
    mutationFn: async (otherUserId: string) => {
      if (!user) throw new Error('Must be logged in');

      // Check if conversation already exists
      const { data: existingParticipations } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      const myConvIds = existingParticipations?.map(p => p.conversation_id) || [];

      if (myConvIds.length > 0) {
        const { data: otherParticipations } = await supabase
          .from('conversation_participants')
          .select('conversation_id')
          .eq('user_id', otherUserId)
          .in('conversation_id', myConvIds);

        if (otherParticipations?.length) {
          // Check if it's a direct conversation
          for (const op of otherParticipations) {
            const { data: conv } = await supabase
              .from('conversations')
              .select('*')
              .eq('id', op.conversation_id)
              .eq('type', 'direct')
              .maybeSingle();
            
            if (conv) return conv;
          }
        }
      }

      // Create new conversation
      const { data: conv, error: convError } = await supabase
        .from('conversations')
        .insert({ type: 'direct', created_by: user.id })
        .select()
        .single();

      if (convError) throw convError;

      // Add participants
      const { error: partError } = await supabase
        .from('conversation_participants')
        .insert([
          { conversation_id: conv.id, user_id: user.id },
          { conversation_id: conv.id, user_id: otherUserId },
        ]);

      if (partError) throw partError;

      return conv;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  // Create group conversation
  const createGroupConversation = useMutation({
    mutationFn: async ({ name, participantIds }: { name: string; participantIds: string[] }) => {
      if (!user) throw new Error('Must be logged in');

      const { data: conv, error: convError } = await supabase
        .from('conversations')
        .insert({ type: 'group', name, created_by: user.id })
        .select()
        .single();

      if (convError) throw convError;

      const participants = [user.id, ...participantIds].map(uid => ({
        conversation_id: conv.id,
        user_id: uid,
      }));

      const { error: partError } = await supabase
        .from('conversation_participants')
        .insert(participants);

      if (partError) throw partError;

      return conv;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Group created');
    },
  });

  // Mute/unmute conversation
  const toggleMute = useMutation({
    mutationFn: async ({ conversationId, muted }: { conversationId: string; muted: boolean }) => {
      if (!user) throw new Error('Must be logged in');

      const { error } = await supabase
        .from('conversation_participants')
        .update({ is_muted: muted })
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: (_, { muted }) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success(muted ? 'Conversation muted' : 'Conversation unmuted');
    },
  });

  // Leave group conversation
  const leaveConversation = useMutation({
    mutationFn: async (conversationId: string) => {
      if (!user) throw new Error('Must be logged in');

      const { error } = await supabase
        .from('conversation_participants')
        .delete()
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('You left the group');
    },
    onError: () => {
      toast.error('Failed to leave group');
    },
  });

  // Real-time subscription for conversation updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('conversations-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        () => refetch()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refetch]);

  return {
    conversations,
    isLoading,
    createDirectConversation,
    createGroupConversation,
    toggleMute,
    leaveConversation,
    refetch,
  };
}
