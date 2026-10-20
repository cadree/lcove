import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useFavorites } from '@/hooks/useFavorites';
import { useUserBlocks } from '@/hooks/useUserBlocks';
import { toast } from 'sonner';
import {
  excludeBlocked,
  shareMessageInsert,
  type SharePerson,
  type ShareTarget,
} from '@/lib/sharing';

async function findOrCreateDirectConversation(userId: string, otherUserId: string) {
  const { data: mine, error: mineError } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', userId);
  if (mineError) throw mineError;

  const myIds = mine?.map((row) => row.conversation_id) ?? [];
  if (myIds.length > 0) {
    const { data: theirs, error: theirsError } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', otherUserId)
      .in('conversation_id', myIds);
    if (theirsError) throw theirsError;

    for (const row of theirs ?? []) {
      const { data: conv, error: convError } = await supabase
        .from('conversations')
        .select('id')
        .eq('id', row.conversation_id)
        .eq('type', 'direct')
        .maybeSingle();
      if (convError) throw convError;
      if (conv) return conv.id;
    }
  }

  const { data: created, error: createError } = await supabase
    .from('conversations')
    .insert({ type: 'direct', created_by: userId })
    .select('id')
    .single();
  if (createError) throw createError;

  const { error: partError } = await supabase.from('conversation_participants').insert([
    { conversation_id: created.id, user_id: userId },
    { conversation_id: created.id, user_id: otherUserId },
  ]);
  if (partError) throw partError;
  return created.id;
}

async function loadProfiles(userIds: string[]): Promise<SharePerson[]> {
  if (userIds.length === 0) return [];
  const { data, error } = await supabase
    .from('profiles_public')
    .select('user_id, display_name, avatar_url')
    .in('user_id', userIds);
  if (error) throw error;
  const byId = new Map((data ?? []).map((profile) => [profile.user_id, profile]));
  return userIds.flatMap((id) => {
    const profile = byId.get(id);
    return profile ? [profile] : [];
  });
}

export function useShareRecipients(open: boolean, search: string) {
  const { user } = useAuth();
  const { blockedIds } = useUserBlocks();
  const { favorites } = useFavorites();
  const query = search.trim();

  const recentQuery = useQuery({
    queryKey: ['share-recent', user?.id],
    enabled: open && !!user,
    queryFn: async () => {
      if (!user) return [] as SharePerson[];
      const { data: mine, error } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);
      if (error) throw error;
      const myIds = mine?.map((row) => row.conversation_id) ?? [];
      if (myIds.length === 0) return [] as SharePerson[];

      const { data: convos, error: convError } = await supabase
        .from('conversations')
        .select('id, updated_at')
        .in('id', myIds)
        .eq('type', 'direct')
        .order('updated_at', { ascending: false })
        .limit(30);
      if (convError) throw convError;
      const convIds = (convos ?? []).map((conv) => conv.id);
      if (convIds.length === 0) return [] as SharePerson[];

      const { data: others, error: othersError } = await supabase
        .from('conversation_participants')
        .select('conversation_id, user_id')
        .in('conversation_id', convIds)
        .neq('user_id', user.id);
      if (othersError) throw othersError;

      const order = new Map((convos ?? []).map((conv, index) => [conv.id, index]));
      const ranked = [...(others ?? [])].sort(
        (a, b) => (order.get(a.conversation_id) ?? 0) - (order.get(b.conversation_id) ?? 0),
      );
      const ids = [...new Set(ranked.map((row) => row.user_id))].slice(0, 20);
      return loadProfiles(ids);
    },
  });

  const suggestedQuery = useQuery({
    queryKey: ['share-suggested', user?.id, favorites],
    enabled: open && !!user && favorites.length > 0,
    queryFn: () => loadProfiles(favorites.slice(0, 30)),
  });

  const searchQuery = useQuery({
    queryKey: ['share-search', user?.id, query],
    enabled: open && !!user && query.length > 0,
    queryFn: async () => {
      if (!user) return [] as SharePerson[];
      const { data, error } = await supabase
        .from('profiles_public')
        .select('user_id, display_name, avatar_url')
        .neq('user_id', user.id)
        .ilike('display_name', `%${query}%`)
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });

  const recent = useMemo(
    () => excludeBlocked(recentQuery.data ?? [], blockedIds, user?.id),
    [recentQuery.data, blockedIds, user?.id],
  );
  const recentIds = useMemo(() => new Set(recent.map((person) => person.user_id)), [recent]);
  const suggested = useMemo(
    () => excludeBlocked(suggestedQuery.data ?? [], blockedIds, user?.id).filter((person) => !recentIds.has(person.user_id)),
    [suggestedQuery.data, blockedIds, user?.id, recentIds],
  );
  const results = useMemo(
    () => excludeBlocked(searchQuery.data ?? [], blockedIds, user?.id),
    [searchQuery.data, blockedIds, user?.id],
  );

  return {
    recent,
    suggested,
    results,
    searching: query.length > 0,
    isLoading: recentQuery.isLoading || (query.length > 0 && searchQuery.isLoading),
  };
}

export function useMyReposts() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ['my-reposts', user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [] as { id: string; post_id: string }[];
      const { data, error } = await supabase
        .from('reposts')
        .select('id, post_id')
        .eq('user_id', user.id);
      if (error) return [] as { id: string; post_id: string }[];
      return data ?? [];
    },
  });
  const postIds = useMemo(() => new Set((query.data ?? []).map((row) => row.post_id)), [query.data]);
  return { postIds };
}

function errorText(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function useSharingActions() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
    queryClient.invalidateQueries({ queryKey: ['messages'] });
    queryClient.invalidateQueries({ queryKey: ['posts'] });
    queryClient.invalidateQueries({ queryKey: ['profile-posts'] });
    queryClient.invalidateQueries({ queryKey: ['my-reposts'] });
    queryClient.invalidateQueries({ queryKey: ['stories'] });
  };

  const sendShare = useMutation({
    mutationFn: async ({
      target,
      recipientIds,
      note,
    }: {
      target: ShareTarget;
      recipientIds: string[];
      note: string;
    }) => {
      if (!user) throw new Error('Sign in to send');
      if (recipientIds.length === 0) throw new Error('Choose someone');
      const failures: string[] = [];
      let sent = 0;
      for (const recipientId of recipientIds) {
        try {
          const conversationId = await findOrCreateDirectConversation(user.id, recipientId);
          const { data: message, error } = await supabase
            .from('messages')
            .insert(shareMessageInsert(user.id, conversationId, target, note))
            .select('id')
            .single();
          if (error) throw error;
          sent += 1;
          supabase.functions.invoke('notify-chat-message', {
            body: { conversation_id: conversationId, message_id: message.id },
          }).catch(() => undefined);
        } catch (err) {
          failures.push(errorText(err, 'Could not send'));
        }
      }
      if (sent === 0) throw new Error(failures[0] || 'Could not send');
      return { partial: failures.length > 0 };
    },
    onSuccess: (result) => {
      toast.success(result.partial ? 'Sent to some people' : 'Sent');
      refresh();
    },
    onError: (err) => toast.error(errorText(err, 'Could not send')),
  });

  const addPostToStory = useMutation({
    mutationFn: async (post: ShareTarget & { kind: 'post' }) => {
      if (!user) throw new Error('Sign in to add to your story');
      if (!post.post.media_url || (post.post.media_type !== 'photo' && post.post.media_type !== 'video')) {
        throw new Error('Only photos and videos can be added to a story');
      }
      const { error } = await supabase.from('stories').insert({
        user_id: user.id,
        media_url: post.post.media_url,
        media_type: post.post.media_type,
        source_post_id: post.post.id,
        credit_user_id: post.post.user_id === user.id ? null : post.post.user_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Added to your story');
      refresh();
    },
    onError: (err) => toast.error(errorText(err, 'Could not add to your story')),
  });

  const repostPost = useMutation({
    mutationFn: async (postId: string) => {
      if (!user) throw new Error('Sign in to repost');
      const { error } = await supabase.from('reposts').insert({ user_id: user.id, post_id: postId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Reposted');
      refresh();
    },
    onError: (err) => toast.error(errorText(err, 'Could not repost')),
  });

  const undoRepost = useMutation({
    mutationFn: async (postId: string) => {
      if (!user) throw new Error('Sign in to undo');
      const { error } = await supabase.from('reposts').delete().eq('user_id', user.id).eq('post_id', postId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Repost removed');
      refresh();
    },
    onError: (err) => toast.error(errorText(err, 'Could not remove repost')),
  });

  const sendStoryReply = useMutation({
    mutationFn: async ({ storyId, ownerId, text }: { storyId: string; ownerId: string; text: string }) => {
      if (!user) throw new Error('Sign in to send');
      const trimmed = text.trim();
      if (!trimmed) throw new Error('Write a message');
      const conversationId = await findOrCreateDirectConversation(user.id, ownerId);
      const { data: message, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          content: trimmed,
          shared_story_id: storyId,
        })
        .select('id')
        .single();
      if (error) throw error;
      supabase.functions.invoke('notify-chat-message', {
        body: { conversation_id: conversationId, message_id: message.id },
      }).catch(() => undefined);
    },
    onSuccess: () => {
      refresh();
    },
    onError: (err) => toast.error(errorText(err, 'Could not send')),
  });

  return { sendShare, addPostToStory, repostPost, undoRepost, sendStoryReply };
}
