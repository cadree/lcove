/**
 * Network Status Hook
 * Detects online/offline state and provides network utilities
 */

import { useState, useEffect, useCallback } from 'react';
import { Network, ConnectionStatus } from '@capacitor/network';
import { Capacitor } from '@capacitor/core';
import { processSyncQueue, hasPendingOps, onSyncStatusChange } from '@/services/syncQueue';

interface NetworkState {
  isOnline: boolean;
  connectionType: string;
  pendingSyncCount: number;
  isSyncing: boolean;
}

export function useNetworkStatus() {
  const [state, setState] = useState<NetworkState>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    connectionType: 'unknown',
    pendingSyncCount: 0,
    isSyncing: false,
  });

  // Update network status
  const updateNetworkStatus = useCallback(async (status: ConnectionStatus) => {
    setState(prev => ({
      ...prev,
      isOnline: status.connected,
      connectionType: status.connectionType,
    }));

    // If back online, trigger sync
    if (status.connected) {
      const hasOps = await hasPendingOps();
      if (hasOps) {
        await processSyncQueue();
      }
    }
  }, []);

  // Check pending sync ops count
  const checkPendingOps = useCallback(async () => {
    const hasOps = await hasPendingOps();
    setState(prev => ({
      ...prev,
      pendingSyncCount: hasOps ? prev.pendingSyncCount : 0,
    }));
  }, []);

  useEffect(() => {
    let unsubscribeCapacitor: (() => void) | undefined;
    let unsubscribeSyncStatus: (() => void) | undefined;

    const setupListeners = async () => {
      // Use Capacitor Network plugin if available (native)
      if (Capacitor.isNativePlatform()) {
        // Get initial status
        const status = await Network.getStatus();
        updateNetworkStatus(status);

        // Listen for changes
        const listener = await Network.addListener('networkStatusChange', updateNetworkStatus);
        unsubscribeCapacitor = () => listener.remove();
      } else {
        // Fallback to browser APIs for web
        const handleOnline = () => {
          setState(prev => ({ ...prev, isOnline: true }));
          processSyncQueue();
        };
        
        const handleOffline = () => {
          setState(prev => ({ ...prev, isOnline: false }));
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        unsubscribeCapacitor = () => {
          window.removeEventListener('online', handleOnline);
          window.removeEventListener('offline', handleOffline);
        };
      }

      // Subscribe to sync status changes
      unsubscribeSyncStatus = onSyncStatusChange((status, count) => {
        setState(prev => ({
          ...prev,
          isSyncing: status === 'syncing',
          pendingSyncCount: count,
        }));
      });

      // Initial pending ops check
      checkPendingOps();
    };

    setupListeners();

    return () => {
      unsubscribeCapacitor?.();
      unsubscribeSyncStatus?.();
    };
  }, [updateNetworkStatus, checkPendingOps]);

  // Manual refresh function
  const refresh = useCallback(async () => {
    if (Capacitor.isNativePlatform()) {
      const status = await Network.getStatus();
      updateNetworkStatus(status);
    } else {
      setState(prev => ({ ...prev, isOnline: navigator.onLine }));
    }
  }, [updateNetworkStatus]);

  // Force sync function
  const forceSync = useCallback(async () => {
    if (state.isOnline) {
      const result = await processSyncQueue();
      return result;
    }
    return { processed: 0, failed: 0 };
  }, [state.isOnline]);

  return {
    ...state,
    refresh,
    forceSync,
  };
}

export default useNetworkStatus;
