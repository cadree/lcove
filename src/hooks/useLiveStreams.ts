import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useRef } from 'react';
import { callRpc } from '@/lib/rpc';
import { watchRows } from '@/lib/liveRoomWatch';
import { fromUntyped } from '@/lib/safetyTables';
import { notifyLiveStream } from '@/lib/notifications';
import { SHOT_USER_ID, shotHostPreview, shotPeople, shotSessionEnabled, shotViewerPreview } from '@/lib/shotSession';
import { useUserBlocks } from '@/hooks/useUserBlocks';
import { assertCleanText } from '@/lib/objectionableText';
import { giftNoticeLabel } from '@/lib/giftNotice';
import { mediaObjectPath } from '@/lib/replayStorage';

export const SHOT_STREAM_ID = "0412aaaa-0000-4000-8000-0000000000c1";

function shotLiveStream(): LiveStream {
  return {
    id: SHOT_STREAM_ID,
    host_id: shotPeople[1].user_id,
    title: "Open Studio",
    description: "Live from the floor",
    stream_type: "youtube",
    external_url: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
    thumbnail_url: null,
    thumbnail_focal_point: null,
    is_live: true,
    started_at: "2026-10-19T15:00:00.000Z",
    ended_at: null,
    viewer_count: 12,
    total_tips: 0,
    created_at: "2026-10-19T15:00:00.000Z",
    replay_available: false,
    replay_url: null,
    rtmp_stream_key: null,
    rtmp_ingest_url: null,
    playback_url: null,
    mux_live_stream_id: null,
    mux_playback_id: null,
  };
}

function shotStreamFixture(): LiveStream {
  const base = shotLiveStream();
  if (shotHostPreview()) {
    return {
      ...base,
      host_id: SHOT_USER_ID,
      title: "Go Live",
      description: "A long description that should stay inside the dialog on a phone.",
      thumbnail_url: "/nuance/dynasty-denim.png",
      stream_type: "webrtc",
      external_url: null,
      is_live: false,
      started_at: null,
      viewer_count: 0,
    };
  }
  if (shotViewerPreview()) {
    return {
      ...base,
      title: "Live room",
      stream_type: "webrtc",
      external_url: null,
      is_live: true,
    };
  }
  return base;
}

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
  const { blockedIds } = useUserBlocks();

  const { data: streams = [], isLoading } = useQuery({
    queryKey: ['live-streams', liveOnly],
    queryFn: async () => {
      if (shotSessionEnabled()) return [shotStreamFixture()];
      let query = supabase
        .from('live_streams_public')
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

  // Refresh the list when a row changes. Poll until the socket is joined so a
  // dropped connection still updates the Live and Replays counts.
  useEffect(() => {
    return watchRows(
      `live-streams-${liveOnly ? "live" : "all"}`,
      "live_streams",
      "",
      queryClient,
      ["live-streams"],
      "*",
    );
  }, [liveOnly, queryClient]);

  const visibleStreams = streams.filter((stream) => !blockedIds.includes(stream.host_id));

  return { streams: visibleStreams, isLoading };
};

export const useStream = (streamId: string | undefined) => {
  const queryClient = useQueryClient();
  const { blockedIds } = useUserBlocks();

  const { data: stream, isLoading } = useQuery({
    queryKey: ['stream', streamId],
    queryFn: async () => {
      if (!streamId) return null;
      if (shotSessionEnabled()) return shotStreamFixture();
      const { data, error } = await supabase
        .from('live_streams_public')
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

  useEffect(() => {
    if (!streamId) return;
    return watchRows(
      `stream-${streamId}`,
      "live_streams",
      `id=eq.${streamId}`,
      queryClient,
      ["stream", streamId],
      "*",
    );
  }, [streamId, queryClient]);

  const visibleStream = stream && blockedIds.includes(stream.host_id) ? null : stream;

  return { stream: visibleStream, isLoading };
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

  useEffect(() => {
    if (!streamId) return;
    return watchRows(
      `stream-reactions-${streamId}`,
      "stream_reactions",
      `stream_id=eq.${streamId}`,
      queryClient,
      ["stream-reactions", streamId],
    );
  }, [streamId, queryClient]);

  return { reactions };
};

export interface StreamCheer {
  id: string;
  label: string;
  created_at: string;
}

export const useStreamCheers = (streamId: string | undefined) => {
  const queryClient = useQueryClient();
  const { reactions } = useStreamReactions(streamId);

  const { data: tips = [] } = useQuery({
    queryKey: ["stream-tips", streamId],
    enabled: !!streamId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stream_tips")
        .select("id, amount, message, created_at")
        .eq("stream_id", streamId!)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) return [];
      return data;
    },
  });

  const { data: gifts = [] } = useQuery({
    queryKey: ["stream-gifts", streamId],
    enabled: !!streamId,
    queryFn: async () => {
      const { data, error } = await fromUntyped("stream_gift_notices")
        .select("id, gift, created_at, sender_name")
        .eq("stream_id", streamId!)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) return [];
      return (data || []) as { id: string; gift: string; created_at: string; sender_name: string | null }[];
    },
  });

  useEffect(() => {
    if (!streamId) return;
    const stopTips = watchRows(
      `stream-tips-${streamId}`,
      "stream_tips",
      `stream_id=eq.${streamId}`,
      queryClient,
      ["stream-tips", streamId],
    );
    // The notice view is not a realtime table. stream_gifts changes are
    // filtered by sender-or-host RLS, so other viewers never get that event.
    const refreshGifts = window.setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: ["stream-gifts", streamId] });
    }, 1000);
    return () => {
      stopTips();
      window.clearInterval(refreshGifts);
    };
  }, [streamId, queryClient]);

  const cheers: StreamCheer[] = [
    ...reactions.map((reaction) => ({
      id: reaction.id,
      label: reaction.emoji,
      created_at: reaction.created_at,
    })),
    ...tips.map((tip) => ({
      id: tip.id,
      label: tip.message ? `${tip.amount} LC · ${tip.message}` : `${tip.amount} LC`,
      created_at: tip.created_at,
    })),
    ...gifts.map((gift) => ({
      id: gift.id,
      label: giftNoticeLabel(gift.sender_name, gift.gift),
      created_at: gift.created_at,
    })),
  ].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, 8);

  return { reactions, cheers };
};

export const useCreateStream = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      title: string;
      description?: string;
      stream_type: 'webrtc' | 'youtube' | 'twitch' | 'soundcloud';
      external_url?: string;
      thumbnail_url?: string;
    }) => {
      if (!user) throw new Error('Not authenticated');
      assertCleanText(data.title);
      assertCleanText(data.description);

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
  const { user } = useAuth();

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

      if (isLive && user) {
        const { data: profile } = await supabase
          .from('profiles_public')
          .select('display_name')
          .eq('user_id', user.id)
          .maybeSingle();
        const { data: fans } = await supabase
          .from('favorite_friends')
          .select('user_id')
          .eq('friend_user_id', user.id);
        const name = profile?.display_name || 'Someone';
        await Promise.all(
          (fans || []).map((fan) =>
            notifyLiveStream(fan.user_id, name, streamId).catch(() => undefined),
          ),
        );
      }
    },
    onSuccess: (_, { isLive }) => {
      queryClient.invalidateQueries({ queryKey: ['live-streams'] });
      toast({ title: isLive ? 'You are now live!' : 'Stream ended' });
    },
  });
};

export const useSendReaction = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

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
    onSuccess: (_, { streamId }) => {
      queryClient.invalidateQueries({ queryKey: ["stream-reactions", streamId] });
    },
  });
};

export const useTipStream = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const idempotencyKey = useRef<string | null>(null);

  return useMutation({
    mutationFn: async ({
      streamId,
      amount,
      message,
      idempotencyKey: providedKey,
    }: {
      streamId: string;
      amount: number;
      message?: string;
      idempotencyKey?: string;
    }) => {
      if (!idempotencyKey.current) {
        idempotencyKey.current = providedKey ?? crypto.randomUUID();
      }
      const { data, error } = await supabase.functions.invoke('tip-stream', {
        body: {
          stream_id: streamId,
          amount,
          message,
          idempotency_key: providedKey ?? idempotencyKey.current,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (_, { streamId, amount }) => {
      idempotencyKey.current = null;
      queryClient.invalidateQueries({ queryKey: ["stream-tips", streamId] });
      toast({ title: `Tipped ${amount} LC!` });
    },
    onError: (error) => {
      toast({ title: 'Failed to tip', description: error.message, variant: 'destructive' });
    },
  });
};

export const useEndStream = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (stream: { id: string; stream_type: string }) => {
      await callRpc('end_live_stream', { p_stream_id: stream.id });

      const channel = supabase.channel(`stream-end-${stream.id}`);
      await Promise.race([
        new Promise<void>((resolve) => {
          channel.subscribe((status) => {
            if (status === 'SUBSCRIBED') resolve();
          });
        }),
        new Promise<void>((resolve) => window.setTimeout(resolve, 1500)),
      ]);
      await channel.send({ type: 'broadcast', event: 'end', payload: {} }).catch(() => undefined);
      supabase.removeChannel(channel);
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

export function useStreamPresence(streamId: string | undefined, enabled: boolean) {
  useEffect(() => {
    if (!streamId || !enabled) return;
    let stopped = false;
    const beat = () => {
      if (stopped) return;
      callRpc('touch_stream_presence', { p_stream_id: streamId }).catch(() => undefined);
    };
    beat();
    const timer = window.setInterval(beat, 20000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [streamId, enabled]);
}

export const useJoinStream = () => {
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (streamId: string) => {
      if (!user) return;

      await callRpc('touch_stream_presence', { p_stream_id: streamId });
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
        .select('host_id, replay_url')
        .eq('id', streamId)
        .single();

      if (fetchError) throw fetchError;
      if (stream.host_id !== user.id) throw new Error('You can only delete your own streams');

      try {
        await callRpc('delete_own_live_stream', { p_stream_id: streamId });
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        const missing = /delete_own_live_stream|schema cache|does not exist|PGRST202/i.test(message);
        if (!missing) throw error;
        const { error: deleteError } = await supabase
          .from('live_streams')
          .delete()
          .eq('id', streamId)
          .eq('host_id', user.id);
        if (deleteError) throw deleteError;
      }

      if (stream.replay_url) {
        const path = mediaObjectPath(stream.replay_url);
        if (!path) throw new Error('Could not remove the replay file');
        const { error: storageError } = await supabase.storage.from('media').remove([path]);
        if (storageError) throw storageError;
      }
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
