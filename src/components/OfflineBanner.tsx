/**
 * Offline Banner Component
 * Shows when the app is offline or has pending sync operations
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, CloudOff, RefreshCw, Check } from 'lucide-react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { cn } from '@/lib/utils';

interface OfflineBannerProps {
  className?: string;
}

export function OfflineBanner({ className }: OfflineBannerProps) {
  const { isOnline, pendingSyncCount, isSyncing, forceSync } = useNetworkStatus();

  const showBanner = !isOnline || pendingSyncCount > 0;

  const handleRetry = async () => {
    if (isOnline && pendingSyncCount > 0) {
      await forceSync();
    }
  };

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={cn(
            'overflow-hidden',
            className
          )}
        >
          <div
            className={cn(
              'flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium',
              !isOnline
                ? 'bg-destructive/10 text-destructive'
                : 'bg-warning/10 text-warning-foreground'
            )}
          >
            {!isOnline ? (
              <>
                <WifiOff className="h-4 w-4" />
                <span>You're offline. Changes will sync when you reconnect.</span>
              </>
            ) : isSyncing ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Syncing {pendingSyncCount} pending changes...</span>
              </>
            ) : pendingSyncCount > 0 ? (
              <>
                <CloudOff className="h-4 w-4" />
                <span>{pendingSyncCount} changes pending sync</span>
                <button
                  onClick={handleRetry}
                  className="ml-2 flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
                >
                  <RefreshCw className="h-3 w-3" />
                  Sync now
                </button>
              </>
            ) : null}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Compact offline indicator for headers/nav
 */
export function OfflineIndicator({ className }: { className?: string }) {
  const { isOnline, pendingSyncCount, isSyncing } = useNetworkStatus();

  if (isOnline && pendingSyncCount === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      exit={{ scale: 0 }}
      className={cn(
        'flex items-center justify-center rounded-full p-1',
        !isOnline ? 'bg-destructive/20' : 'bg-warning/20',
        className
      )}
    >
      {!isOnline ? (
        <WifiOff className="h-3.5 w-3.5 text-destructive" />
      ) : isSyncing ? (
        <RefreshCw className="h-3.5 w-3.5 text-warning animate-spin" />
      ) : (
        <CloudOff className="h-3.5 w-3.5 text-warning" />
      )}
    </motion.div>
  );
}

export default OfflineBanner;
