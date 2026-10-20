import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserBlocks } from '@/hooks/useUserBlocks';
import { toast } from 'sonner';
import { messageSharePreview, type MessageSharePreview } from '@/lib/sharing';

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  media_url: string | null;
  media_type: 'image' | 'video' | 'audio' | null;
  reply_to_id: string | null;
  created_at: string;
  updated_at: string;
  profile?: {
    display_name: string | null;
    avatar_url: string | null;
  };
  read_by?: string[];
  shared_post_id?: string | null;
  shared_story_id?: string | null;
  shared_profile_id?: string | null;
  share?: MessageSharePreview | null;
}

interface TypingUser {
  user_id: string;
  profile?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

export function useMessages(conversationId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { blockedIds } = useUserBlocks();
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: messages = [], isLoading, refetch } = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: async () => {
      if (!conversationId || !user) return [];

      const { data: messagesData, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Get profiles for senders using profiles_public view
      const senderIds = [...new Set(messagesData?.map(m => m.sender_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles_public')
        .select('user_id, display_name, avatar_url')
        .in('user_id', senderIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]));

      // Get read receipts
      const messageIds = messagesData?.map(m => m.id) || [];
      const { data: receipts } = await supabase
        .from('message_read_receipts')
        .select('message_id, user_id')
        .in('message_id', messageIds);

      const receiptMap = new Map<string, string[]>();
      receipts?.forEach(r => {
        if (!receiptMap.has(r.message_id)) {
          receiptMap.set(r.message_id, []);
        }
        receiptMap.get(r.message_id)!.push(r.user_id);
      });

      const base = (messagesData || []).map(m => ({
        ...m,
        profile: profileMap.get(m.sender_id),
        read_by: receiptMap.get(m.id) || [],
      }));

      const postIds = [...new Set(base.map((m) => m.shared_post_id).filter((id): id is string => !!id))];
      const storyIds = [...new Set(base.map((m) => m.shared_story_id).filter((id): id is string => !!id))];
      const profileIds = [...new Set(base.map((m) => m.shared_profile_id).filter((id): id is string => !!id))];

      const postLookup = new Map<string, { id: string; user_id: string; content: string | null; media_url: string | null; media_type: string | null; author: string | null }>();
      const storyLookup = new Map<string, { id: string; user_id: string; media_url: string; media_type: string; author: string | null }>();
      const profileLookup = new Map<string, { user_id: string; display_name: string | null; avatar_url: string | null }>();

      if (postIds.length) {
        const { data: postRows } = await supabase
          .from('posts')
          .select('id, user_id, content, media_url, media_type')
          .in('id', postIds);
        const authorIds = [...new Set((postRows ?? []).map((post) => post.user_id))];
        const authorMap = new Map<string, string | null>();
        if (authorIds.length) {
          const { data: authors } = await supabase.from('profiles_public').select('user_id, display_name').in('user_id', authorIds);
          authors?.forEach((author) => authorMap.set(author.user_id, author.display_name));
        }
        postRows?.forEach((post) => {
          postLookup.set(post.id, { ...post, author: authorMap.get(post.user_id) ?? null });
        });
      }

      if (storyIds.length) {
        const { data: storyRows } = await supabase
          .from('stories')
          .select('id, user_id, media_url, media_type')
          .in('id', storyIds);
        const authorIds = [...new Set((storyRows ?? []).map((story) => story.user_id))];
        const authorMap = new Map<string, string | null>();
        if (authorIds.length) {
          const { data: authors } = await supabase.from('profiles_public').select('user_id, display_name').in('user_id', authorIds);
          authors?.forEach((author) => authorMap.set(author.user_id, author.display_name));
        }
        storyRows?.forEach((story) => {
          storyLookup.set(story.id, { ...story, author: authorMap.get(story.user_id) ?? null });
        });
      }

      if (profileIds.length) {
        const { data: profileRows } = await supabase
          .from('profiles_public')
          .select('user_id, display_name, avatar_url')
          .in('user_id', profileIds);
        profileRows?.forEach((profile) => profileLookup.set(profile.user_id, profile));
      }

      return base.map((message) => ({
        ...message,
        share: messageSharePreview(message, { posts: postLookup, stories: storyLookup, profiles: profileLookup }),
      })) as Message[];
    },
    enabled: !!conversationId && !!user,
  });

  // Send message
  const sendMessage = useMutation({
    mutationFn: async ({ content, file, mediaType }: { 
      content?: string; 
      file?: File; 
      mediaType?: 'image' | 'video' | 'audio' 
    }) => {
      if (!user || !conversationId) throw new Error('Missing required data');

      let mediaUrl: string | null = null;

      if (file && mediaType) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${conversationId}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('media')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('media')
          .getPublicUrl(fileName);

        mediaUrl = publicUrl;
      }

      const { data: messageData, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          content: content || null,
          media_url: mediaUrl,
          media_type: mediaType || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Clear typing indicator
      await clearTypingIndicator();

      // Push is immediate. Email is throttled to one per chat per 15 minutes.
      // Mute and message preferences are checked in the function, not here.
      supabase.functions.invoke('notify-chat-message', {
        body: {
          conversation_id: conversationId,
          message_id: messageData.id,
        },
      }).catch((err) => {
        console.error('Error sending chat notification:', err);
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to send message');
    },
  });

  // Mark messages as read
  const markAsRead = useCallback(async () => {
    if (!user || !conversationId || messages.length === 0) return;

    const unreadMessages = messages.filter(
      m => m.sender_id !== user.id && !m.read_by?.includes(user.id)
    );

    if (unreadMessages.length === 0) return;

    const receipts = unreadMessages.map(m => ({
      message_id: m.id,
      user_id: user.id,
    }));

    await supabase
      .from('message_read_receipts')
      .upsert(receipts, { onConflict: 'message_id,user_id' });

    // Update last_read_at
    await supabase
      .from('conversation_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id);

    queryClient.invalidateQueries({ queryKey: ['conversations'] });
  }, [user, conversationId, messages, queryClient]);

  const clearTypingIndicator = useCallback(async () => {
    if (!user || !conversationId) return;

    await supabase
      .from('typing_indicators')
      .delete()
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id);
  }, [user, conversationId]);

  // Typing indicator
  const setTypingIndicator = useCallback(async () => {
    if (!user || !conversationId) return;

    await supabase
      .from('typing_indicators')
      .upsert({
        conversation_id: conversationId,
        user_id: user.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'conversation_id,user_id' });

    // Clear after 3 seconds of no typing
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(clearTypingIndicator, 3000);
  }, [user, conversationId, clearTypingIndicator]);

  // Delete message
  const deleteMessage = useMutation({
    mutationFn: async (messageId: string) => {
      if (!user) throw new Error('Must be logged in');

      const { error } = await supabase
        .from('messages')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', messageId)
        .eq('sender_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
      toast.success('Message deleted');
    },
  });

  // Real-time subscriptions
  useEffect(() => {
    if (!conversationId || !user) return;

    // Messages subscription
    const messagesChannel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        () => refetch()
      )
      .subscribe();

    // Typing indicators subscription
    const typingChannel = supabase
      .channel(`typing-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'typing_indicators',
          filter: `conversation_id=eq.${conversationId}`
        },
        async () => {
          // Fetch current typing users
          const { data } = await supabase
            .from('typing_indicators')
            .select('user_id')
            .eq('conversation_id', conversationId)
            .neq('user_id', user.id)
            .gt('updated_at', new Date(Date.now() - 5000).toISOString());

          if (data?.length) {
            const userIds = data.map(t => t.user_id);
            // Use profiles_public view to protect sensitive fields
            const { data: profiles } = await supabase
              .from('profiles_public')
              .select('user_id, display_name, avatar_url')
              .in('user_id', userIds);

            setTypingUsers(
              data.map(t => ({
                user_id: t.user_id,
                profile: profiles?.find(p => p.user_id === t.user_id),
              }))
            );
          } else {
            setTypingUsers([]);
          }
        }
      )
      .subscribe();

    // Read receipts subscription
    const receiptsChannel = supabase
      .channel(`receipts-${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'message_read_receipts' },
        () => refetch()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(typingChannel);
      supabase.removeChannel(receiptsChannel);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      clearTypingIndicator();
    };
  }, [conversationId, user, refetch, clearTypingIndicator]);

  const visibleMessages = useMemo(
    () => messages.filter((message) => !blockedIds.includes(message.sender_id)),
    [messages, blockedIds],
  );

  return {
    messages: visibleMessages,
    isLoading,
    sendMessage,
    deleteMessage,
    markAsRead,
    setTypingIndicator,
    clearTypingIndicator,
    typingUsers,
    refetch,
  };
}
