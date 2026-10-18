import { useState, useEffect, useCallback, createContext, useContext, ReactNode, createElement } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

function presenceUserId(presence: unknown): string | undefined {
  if (typeof presence !== "object" || presence === null || !("user_id" in presence)) return undefined;
  return typeof presence.user_id === "string" ? presence.user_id : undefined;
}

interface PresenceContextValue {
  onlineUsers: Set<string>;
  isOnline: (userId: string) => boolean;
  onlineCount: number;
}

function usePresenceInternal() {
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;

    const presenceChannel = supabase.channel('online-users', {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const online = new Set<string>();
        
        Object.values(state).forEach(presences => {
          presences.forEach(presence => {
            const userId = presenceUserId(presence);
            if (userId) online.add(userId);
          });
        });
        
        setOnlineUsers(online);
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        setOnlineUsers(prev => {
          const updated = new Set(prev);
          newPresences.forEach(p => {
            const userId = presenceUserId(p);
            if (userId) updated.add(userId);
          });
          return updated;
        });
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        setOnlineUsers(prev => {
          const updated = new Set(prev);
          leftPresences.forEach(p => {
            const userId = presenceUserId(p);
            if (userId) updated.delete(userId);
          });
          return updated;
        });
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            user_id: user.id,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      presenceChannel.unsubscribe();
    };
  }, [user]);

  const isOnline = useCallback((userId: string) => {
    return onlineUsers.has(userId);
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
