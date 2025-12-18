import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useEffect } from 'react';

export interface LiveStream {
  id: string;
  host_id: string;
  title: string;
  description: string | null;
  stream_type: 'webrtc' | 'youtube' | 'twitch' | 'soundcloud' | 'opus';
  external_url: string | null;
  thumbnail_url: string | null;
  is_live: boolean;
  started_at: string | null;
  ended_at: string | null;
  viewer_count: number;
  total_tips: number;
  created_at: string;
  host?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

export interface StreamReaction {
  id: string;
  stream_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export const useLiveStreams = (liveOnly = false) => {
  const queryClient = useQueryClient();

  const { data: streams = [], isLoading } = useQuery({
    queryKey: ['live-streams', liveOnly],
    queryFn: async () => {
      let query = supabase
        .from('live_streams')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (liveOnly) {
        query = query.eq('is_live', true);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as LiveStream[];
    },
  });

  // Subscribe to realtime updates for live streams
  useEffect(() => {
    const channel = supabase
      .channel('live-streams-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_streams' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['live-streams'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return { streams, isLoading };
};

export const useStream = (streamId: string | undefined) => {
  const queryClient = useQueryClient();

  const { data: stream, isLoading } = useQuery({
    queryKey: ['stream', streamId],
    queryFn: async () => {
      if (!streamId) return null;
      const { data, error } = await supabase
        .from('live_streams')
        .select('*')
        .eq('id', streamId)
        .single();
      if (error) throw error;
      return data as LiveStream;
    },
    enabled: !!streamId,
  });

  // Realtime subscription
  useEffect(() => {
    if (!streamId) return;

    const channel = supabase
      .channel(`stream-${streamId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_streams', filter: `id=eq.${streamId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['stream', streamId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId, queryClient]);

  return { stream, isLoading };
};

export const useStreamReactions = (streamId: string | undefined) => {
  const queryClient = useQueryClient();

  const { data: reactions = [] } = useQuery({
    queryKey: ['stream-reactions', streamId],
    queryFn: async () => {
      if (!streamId) return [];
      const { data, error } = await supabase
        .from('stream_reactions')
        .select('*')
        .eq('stream_id', streamId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as StreamReaction[];
    },
    enabled: !!streamId,
  });

  // Realtime reactions
  useEffect(() => {
    if (!streamId) return;

    const channel = supabase
      .channel(`stream-reactions-${streamId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'stream_reactions', filter: `stream_id=eq.${streamId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['stream-reactions', streamId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId, queryClient]);

  return { reactions };
};

export const useCreateStream = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      title: string;
      description?: string;
      stream_type: 'webrtc' | 'youtube' | 'twitch' | 'soundcloud' | 'opus';
      external_url?: string;
      thumbnail_url?: string;
    }) => {
      if (!user) throw new Error('Not authenticated');

      const { data: stream, error } = await supabase
        .from('live_streams')
        .insert({
          host_id: user.id,
          title: data.title,
          description: data.description,
          stream_type: data.stream_type,
          external_url: data.external_url,
          thumbnail_url: data.thumbnail_url,
        })
        .select()
        .single();

      if (error) throw error;
      return stream;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['live-streams'] });
      toast({ title: 'Stream created!' });
    },
    onError: (error) => {
      toast({ title: 'Error creating stream', description: error.message, variant: 'destructive' });
    },
  });
};

export const useGoLive = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ streamId, isLive }: { streamId: string; isLive: boolean }) => {
      const updates: any = { is_live: isLive };
      if (isLive) {
        updates.started_at = new Date().toISOString();
      } else {
        updates.ended_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('live_streams')
        .update(updates)
        .eq('id', streamId);

      if (error) throw error;
    },
    onSuccess: (_, { isLive }) => {
      queryClient.invalidateQueries({ queryKey: ['live-streams'] });
      toast({ title: isLive ? 'You are now live!' : 'Stream ended' });
    },
  });
};

export const useSendReaction = () => {
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ streamId, emoji }: { streamId: string; emoji: string }) => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('stream_reactions')
        .insert({
          stream_id: streamId,
          user_id: user.id,
          emoji,
        });

      if (error) throw error;
    },
  });
};

export const useTipStream = () => {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ streamId, amount, message }: { streamId: string; amount: number; message?: string }) => {
      const { data, error } = await supabase.functions.invoke('tip-stream', {
        body: { stream_id: streamId, amount, message },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (_, { amount }) => {
      toast({ title: `Tipped ${amount} LC!` });
    },
    onError: (error) => {
      toast({ title: 'Failed to tip', description: error.message, variant: 'destructive' });
    },
  });
};

export const useJoinStream = () => {
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (streamId: string) => {
      if (!user) return;

      const { error } = await supabase
        .from('stream_viewers')
        .upsert({
          stream_id: streamId,
          viewer_id: user.id,
          joined_at: new Date().toISOString(),
        }, { onConflict: 'stream_id,viewer_id' });

      if (error) throw error;
    },
  });
};
