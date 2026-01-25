/**
 * Sync Queue Service
 * Handles synchronization of offline mutations with the server
 */

import { supabase } from '@/integrations/supabase/client';
import {
  getPendingSyncOps,
  removeSyncOp,
  incrementSyncRetry,
  getPendingSyncCount,
} from './offlineStorage';

const MAX_RETRIES = 5;
const RETRY_DELAY_BASE = 1000; // 1 second base delay

type SyncStatus = 'idle' | 'syncing' | 'error';

let syncStatus: SyncStatus = 'idle';
let syncListeners: Set<(status: SyncStatus, pendingCount: number) => void> = new Set();

/**
 * Subscribe to sync status changes
 */
export function onSyncStatusChange(
  callback: (status: SyncStatus, pendingCount: number) => void
): () => void {
  syncListeners.add(callback);
  return () => syncListeners.delete(callback);
}

/**
 * Notify all listeners of status change
 */
async function notifyListeners(): Promise<void> {
  const count = await getPendingSyncCount();
  syncListeners.forEach(cb => cb(syncStatus, count));
}

/**
 * Process a single sync operation
 */
async function processSyncOp(op: {
  id?: number;
  table: string;
  operation: 'insert' | 'update' | 'delete';
  data: any;
  retries: number;
}): Promise<boolean> {
  if (!op.id) return false;

  try {
    const { table, operation, data } = op;

    switch (operation) {
      case 'insert': {
        const { error } = await supabase.from(table as any).insert(data);
        if (error) throw error;
        break;
      }
      case 'update': {
        const { id, ...updateData } = data;
        const { error } = await supabase
          .from(table as any)
          .update(updateData)
          .eq('id', id);
        if (error) throw error;
        break;
      }
      case 'delete': {
        const { error } = await supabase
          .from(table as any)
          .delete()
          .eq('id', data.id);
        if (error) throw error;
        break;
      }
    }

    // Success - remove from queue
    await removeSyncOp(op.id);
    return true;
  } catch (error) {
    console.error(`[SyncQueue] Failed to sync ${op.operation} on ${op.table}:`, error);
    
    if (op.retries >= MAX_RETRIES) {
      // Max retries reached - remove from queue but log the failure
      console.error(`[SyncQueue] Max retries reached for op ${op.id}, removing from queue`);
      await removeSyncOp(op.id);
      return false;
    }

    // Increment retry count
    await incrementSyncRetry(op.id);
    return false;
  }
}

/**
 * Process all pending sync operations
 */
export async function processSyncQueue(): Promise<{
  processed: number;
  failed: number;
}> {
  if (syncStatus === 'syncing') {
    return { processed: 0, failed: 0 };
  }

  syncStatus = 'syncing';
  await notifyListeners();

  const ops = await getPendingSyncOps();
  let processed = 0;
  let failed = 0;

  for (const op of ops) {
    // Add exponential backoff delay for retries
    if (op.retries > 0) {
      const delay = RETRY_DELAY_BASE * Math.pow(2, op.retries - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    const success = await processSyncOp(op);
    if (success) {
      processed++;
    } else {
      failed++;
    }
  }

  syncStatus = failed > 0 ? 'error' : 'idle';
  await notifyListeners();

  return { processed, failed };
}

/**
 * Get current sync status
 */
export function getSyncStatus(): SyncStatus {
  return syncStatus;
}

/**
 * Check if there are pending operations
 */
export async function hasPendingOps(): Promise<boolean> {
  const count = await getPendingSyncCount();
  return count > 0;
}

/**
 * Start background sync with interval
 */
let syncInterval: ReturnType<typeof setInterval> | null = null;

export function startBackgroundSync(intervalMs: number = 30000): void {
  if (syncInterval) return;

  syncInterval = setInterval(async () => {
    const isOnline = navigator.onLine;
    if (isOnline) {
      await processSyncQueue();
    }
  }, intervalMs);

  // Also sync immediately when coming back online
  window.addEventListener('online', handleOnline);
}

async function handleOnline(): Promise<void> {
  console.log('[SyncQueue] Back online, processing sync queue...');
  await processSyncQueue();
}

export function stopBackgroundSync(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
  window.removeEventListener('online', handleOnline);
}

/**
 * Force immediate sync
 */
export async function forceSync(): Promise<{ processed: number; failed: number }> {
  if (!navigator.onLine) {
    return { processed: 0, failed: 0 };
  }
  return processSyncQueue();
}
