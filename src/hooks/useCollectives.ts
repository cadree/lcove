import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface Collective {
  id: string;
  name: string | null;
  description: string | null;
  avatar_url: string | null;
  cover_image_url: string | null;
  collective_topic: string | null;
  visibility: 'public' | 'private' | 'discoverable' | null;
  max_members: number | null;
  join_requests_enabled: boolean | null;
  created_by: string;
  created_at: string;
  member_count?: number;
}

export interface JoinRequest {
  id: string;
  conversation_id: string;
  user_id: string;
  message: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export const COLLECTIVE_TOPICS = [
  'models',
  'dancers',
  'djs',
  'filmmakers',
  'photographers',
  'musicians',
  'travelers',
  'writers',
  'artists',
  'general',
] as const;

export type CollectiveTopic = typeof COLLECTIVE_TOPICS[number];

export function useCollectives(topic?: string) {
  return useQuery({
    queryKey: ['collectives', topic],
    queryFn: async () => {
      let query = supabase
        .from('conversations')
        .select(`
          id,
          name,
          description,
          avatar_url,
          cover_image_url,
          collective_topic,
          visibility,
          max_members,
          join_requests_enabled,
          created_by,
          created_at,
          conversation_participants(count)
        `)
        .eq('type', 'group')
        .eq('is_community_hub', true)
        .in('visibility', ['public', 'discoverable'])
        .order('created_at', { ascending: false });

      if (topic && topic !== 'all') {
        query = query.eq('collective_topic', topic);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []).map((c: any) => ({
        ...c,
        member_count: c.conversation_participants?.[0]?.count || 0,
      })) as Collective[];
    },
  });
}

export function useMyCollectives() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-collectives', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('conversation_participants')
        .select(`
          conversation_id,
          role,
          conversations!inner(
            id,
            name,
            description,
            avatar_url,
            cover_image_url,
            collective_topic,
            visibility,
            max_members,
            join_requests_enabled,
            created_by,
            created_at,
            type,
            is_community_hub
          )
        `)
        .eq('user_id', user.id)
        .eq('conversations.type', 'group')
        .eq('conversations.is_community_hub', true);

      if (error) throw error;

      return (data || []).map((p: any) => ({
        ...p.conversations,
        role: p.role,
      })) as (Collective & { role: string })[];
    },
    enabled: !!user,
  });
}

export function useCreateCollective() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      topic: string;
      visibility: 'public' | 'private' | 'discoverable';
      maxMembers?: number;
      avatarUrl?: string;
      coverImageUrl?: string;
      inviteUserIds?: string[];
    }) => {
      if (!user) throw new Error('Must be logged in');

      // Create the conversation as a collective
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .insert({
          name: data.name,
          description: data.description,
          type: 'group',
          is_community_hub: true,
          visibility: data.visibility,
          collective_topic: data.topic,
          max_members: data.maxMembers || 100,
          join_requests_enabled: data.visibility === 'discoverable',
          avatar_url: data.avatarUrl,
          cover_image_url: data.coverImageUrl,
          created_by: user.id,
        })
        .select()
        .single();

      if (convError) throw convError;

      // Add creator as owner
      const { error: partError } = await supabase
        .from('conversation_participants')
        .insert({
          conversation_id: conversation.id,
          user_id: user.id,
          role: 'owner',
        });

      if (partError) throw partError;

      // Invite additional members if any
      if (data.inviteUserIds && data.inviteUserIds.length > 0) {
        const participants = data.inviteUserIds.map((uid) => ({
          conversation_id: conversation.id,
          user_id: uid,
          role: 'member' as const,
        }));

        await supabase.from('conversation_participants').insert(participants);
      }

      return conversation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collectives'] });
      queryClient.invalidateQueries({ queryKey: ['my-collectives'] });
      toast.success('Collective created successfully!');
    },
    onError: (error) => {
      toast.error('Failed to create collective: ' + error.message);
    },
  });
}

export function useJoinCollective() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      if (!user) throw new Error('Must be logged in');

      // Check if join requests are enabled
      const { data: conv } = await supabase
        .from('conversations')
        .select('visibility, join_requests_enabled')
        .eq('id', conversationId)
        .single();

      if (conv?.visibility === 'public') {
        // Direct join for public collectives
        const { error } = await supabase
          .from('conversation_participants')
          .insert({
            conversation_id: conversationId,
            user_id: user.id,
            role: 'member',
          });

        if (error) throw error;
        return { type: 'joined' as const };
      } else {
        // Create join request for discoverable collectives
        const { error } = await supabase
          .from('collective_join_requests')
          .insert({
            conversation_id: conversationId,
            user_id: user.id,
          });

        if (error) throw error;
        return { type: 'requested' as const };
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['collectives'] });
      queryClient.invalidateQueries({ queryKey: ['my-collectives'] });
      if (result.type === 'joined') {
        toast.success('You joined the collective!');
      } else {
        toast.success('Join request sent!');
      }
    },
    onError: (error) => {
      toast.error('Failed to join: ' + error.message);
    },
  });
}

export function useJoinRequests(conversationId: string) {
  return useQuery({
    queryKey: ['join-requests', conversationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('collective_join_requests')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as JoinRequest[];
    },
  });
}

export function useManageJoinRequest() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      requestId,
      action,
    }: {
      requestId: string;
      action: 'approve' | 'reject';
    }) => {
      if (!user) throw new Error('Must be logged in');

      const { data: request, error: fetchError } = await supabase
        .from('collective_join_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (fetchError) throw fetchError;

      // Update the request status
      const { error: updateError } = await supabase
        .from('collective_join_requests')
        .update({
          status: action === 'approve' ? 'approved' : 'rejected',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (updateError) throw updateError;

      // If approved, add user to participants
      if (action === 'approve') {
        const { error: partError } = await supabase
          .from('conversation_participants')
          .insert({
            conversation_id: request.conversation_id,
            user_id: request.user_id,
            role: 'member',
          });

        if (partError) throw partError;
      }

      return { action };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['join-requests'] });
      queryClient.invalidateQueries({ queryKey: ['collectives'] });
      toast.success(
        result.action === 'approve' ? 'Member approved!' : 'Request rejected'
      );
    },
    onError: (error) => {
      toast.error('Failed to process request: ' + error.message);
    },
  });
}
