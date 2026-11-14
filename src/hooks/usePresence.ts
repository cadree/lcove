import { useState, useEffect, useCallback, createContext, useContext, ReactNode, createElement } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { collectPresenceUserIds, shouldPublishPresence } from '@/lib/activeNow';
import { shotSessionEnabled } from '@/lib/shotSession';

const PRESENCE_TOPIC = 'realtime:online-users';

interface PresenceContextValue {
  onlineUsers: Set<string>;
  isOnline: (userId: string) => boolean;
  onlineCount: number;
}

let presenceQueue: Promise<void> = Promise.resolve();
let activePresence: RealtimeChannel | null = null;

function enqueuePresence(task: () => Promise<void>): Promise<void> {
  const run = presenceQueue.then(task, task);
  presenceQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function leaveOnlineUsers(): Promise<void> {
  const current = activePresence;
  activePresence = null;
  const stale = supabase.getChannels().filter((channel) => channel.topic === PRESENCE_TOPIC);
  const channels = [...new Set(current ? [current, ...stale] : stale)];
  await Promise.all(channels.map((channel) => supabase.removeChannel(channel)));
}

/** Send a presence leave while the socket can still write. */
function dropPresenceNow(): void {
  const channel = activePresence;
  if (!channel) return;
  void channel.untrack().catch(() => undefined);
}

function usePresenceInternal() {
  const { user } = useAuth();
  const userId = user?.id;
  const nativePlatform = Capacitor.isNativePlatform();
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [documentVisible, setDocumentVisible] = useState(() =>
    typeof document === 'undefined' ? true : document.visibilityState === 'visible',
  );
  const [nativeActive, setNativeActive] = useState<boolean | null>(null);

  useEffect(() => {
    const onVisibility = () => {
      const visible = document.visibilityState === 'visible';
      setDocumentVisible(visible);
      // The native shell reports foreground through appStateChange. A hidden
      // document while that flag is still true would untrack a person who is
      // in the app, and the effect would not join again.
      if (!visible && !nativePlatform) dropPresenceNow();
    };
    const onPageHide = () => {
      if (nativePlatform) return;
      dropPresenceNow();
      void enqueuePresence(leaveOnlineUsers);
    };
    const onPageShow = () => {
      if (!nativePlatform) setDocumentVisible(true);
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', onPageShow);

    let cancelled = false;
    let removeNative: (() => void) | undefined;
    if (nativePlatform) {
      void CapApp.getState()
        .then((state) => {
          if (!cancelled) setNativeActive(state.isActive);
        })
        .catch(() => {
          if (!cancelled) setNativeActive(document.visibilityState === 'visible');
        });
      void CapApp.addListener('appStateChange', ({ isActive }) => {
        setNativeActive(isActive);
        if (isActive) {
          setDocumentVisible(true);
          return;
        }
        dropPresenceNow();
        void enqueuePresence(leaveOnlineUsers);
      }).then((handle) => {
        if (cancelled) void handle.remove();
        else removeNative = () => { void handle.remove(); };
      });
    }

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onPageShow);
      removeNative?.();
    };
  }, [nativePlatform]);

  const publish = shouldPublishPresence({
    userId,
    shotSession: shotSessionEnabled(),
    nativePlatform,
    nativeActive,
    documentVisible,
  });

  useEffect(() => {
    if (!userId) setOnlineUsers(new Set());
  }, [userId]);

  useEffect(() => {
    let cancelled = false;

    void enqueuePresence(async () => {
      await leaveOnlineUsers();
      if (cancelled || !publish || !userId) return;

      const channel = supabase.channel('online-users', {
        config: {
          presence: {
            key: userId,
          },
        },
      });
      activePresence = channel;

      channel.on('presence', { event: 'sync' }, () => {
        if (cancelled || activePresence !== channel) return;
        setOnlineUsers(new Set(collectPresenceUserIds(channel.presenceState())));
      });

      channel.subscribe(async (status) => {
        if (cancelled || activePresence !== channel || status !== 'SUBSCRIBED') return;
        try {
          await channel.track({
            user_id: userId,
            online_at: new Date().toISOString(),
          });
        } catch {
          // The channel left before the track was acknowledged.
        }
      });
    });

    return () => {
      cancelled = true;
      dropPresenceNow();
      void enqueuePresence(leaveOnlineUsers);
    };
  }, [userId, publish]);

  const isOnline = useCallback((userIdToCheck: string) => {
    return onlineUsers.has(userIdToCheck);
  }, [onlineUsers]);

  return {
    onlineUsers,
    isOnline,
    onlineCount: onlineUsers.size,
  };
}

const PresenceContext = createContext<PresenceContextValue | null>(null);

export function PresenceProvider({ children }: { children: ReactNode }) {
  const presence = usePresenceInternal();

  return createElement(PresenceContext.Provider, { value: presence }, children);
}

export function usePresence() {
  const context = useContext(PresenceContext);
  if (!context) {
    return {
      onlineUsers: new Set<string>(),
      isOnline: () => false,
      onlineCount: 0,
    };
  }
  return context;
}
