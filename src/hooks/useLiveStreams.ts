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
  stream_type: 'webrtc' | 'youtube' | 'twitch' | 'soundcloud' | 'obs_rtmp';
  external_url: string | null;
  thumbnail_url: string | null;
  thumbnail_focal_point: { x: number; y: number } | null;
  is_live: boolean;
  started_at: string | null;
  ended_at: string | null;
  viewer_count: number;
  total_tips: number;
  created_at: string;
  replay_available: boolean | null;
  replay_url: string | null;
  // OBS/RTMP fields
  rtmp_stream_key: string | null;
  rtmp_ingest_url: string | null;
  playback_url: string | null;
  mux_live_stream_id: string | null;
  mux_playback_id: string | null;
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
      // Transform the data to match our interface
      return (data || []).map(item => ({
        ...item,
        thumbnail_focal_point: item.thumbnail_focal_point as { x: number; y: number } | null,
      })) as LiveStream[];
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
      // Transform the data to match our interface
      return {
        ...data,
        thumbnail_focal_point: data.thumbnail_focal_point as { x: number; y: number } | null,
      } as LiveStream;
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
      stream_type: 'webrtc' | 'youtube' | 'twitch' | 'soundcloud' | 'obs_rtmp';
      external_url?: string;
      thumbnail_url?: string;
      // OBS/RTMP fields
      mux_live_stream_id?: string;
      mux_playback_id?: string;
      rtmp_ingest_url?: string;
      rtmp_stream_key?: string;
      playback_url?: string;
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
          // OBS/RTMP fields
          mux_live_stream_id: data.mux_live_stream_id,
          mux_playback_id: data.mux_playback_id,
          rtmp_ingest_url: data.rtmp_ingest_url,
          rtmp_stream_key: data.rtmp_stream_key,
          playback_url: data.playback_url,
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
      const updates: Record<string, unknown> = { is_live: isLive };
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

export const useSaveReplay = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ streamId, replayUrl }: { streamId: string; replayUrl?: string }) => {
      const { error } = await supabase
        .from('live_streams')
        .update({ 
          replay_available: true,
          replay_url: replayUrl || null,
        })
        .eq('id', streamId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['live-streams'] });
      toast({ title: 'Replay saved!', description: 'Viewers can now watch your stream replay.' });
    },
    onError: (error) => {
      toast({ title: 'Failed to save replay', description: error.message, variant: 'destructive' });
    },
  });
};

export const useDeleteStream = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (streamId: string) => {
      if (!user) throw new Error('Not authenticated');

      // First verify user owns this stream
      const { data: stream, error: fetchError } = await supabase
        .from('live_streams')
        .select('host_id')
        .eq('id', streamId)
        .single();

      if (fetchError) throw fetchError;
      if (stream.host_id !== user.id) throw new Error('You can only delete your own streams');

      // Delete stream reactions first
      await supabase
        .from('stream_reactions')
        .delete()
        .eq('stream_id', streamId);

      // Delete stream viewers
      await supabase
        .from('stream_viewers')
        .delete()
        .eq('stream_id', streamId);

      // Delete the stream
      const { error } = await supabase
        .from('live_streams')
        .delete()
        .eq('id', streamId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['live-streams'] });
      toast({ title: 'Stream deleted' });
    },
    onError: (error) => {
      toast({ title: 'Failed to delete stream', description: error.message, variant: 'destructive' });
    },
  });
};

export const useEndOBSStream = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (streamId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mux-stream`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'disable', streamId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to end stream');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['live-streams'] });
      toast({ title: 'Stream ended' });
    },
    onError: (error) => {
      toast({ title: 'Failed to end stream', description: error.message, variant: 'destructive' });
    },
  });
};
