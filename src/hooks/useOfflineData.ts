/**
 * Offline Data Hook
 * Provides offline-first data fetching with automatic caching
 */

import { useQuery, useMutation, useQueryClient, QueryKey } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  cacheData,
  getCachedData,
  getCachedItem,
  addToSyncQueue,
  deleteCachedItem,
} from '@/services/offlineStorage';
import { useNetworkStatus } from './useNetworkStatus';

type SupportedTable = 
  | 'profiles'
  | 'messages'
  | 'conversations'
  | 'posts'
  | 'notifications'
  | 'projects'
  | 'pipeline_items'
  | 'calendar_tasks';

interface UseOfflineQueryOptions<T> {
  table: SupportedTable;
  queryKey: QueryKey;
  queryFn: () => Promise<T[]>;
  enabled?: boolean;
  staleTime?: number;
}

/**
 * Offline-first query hook
 */
export function useOfflineQuery<T extends { id: string }>({
  table,
  queryKey,
  queryFn,
  enabled = true,
  staleTime = 5 * 60 * 1000,
}: UseOfflineQueryOptions<T>) {
  const { isOnline } = useNetworkStatus();

  return useQuery({
    queryKey,
    queryFn: async () => {
      if (isOnline) {
        try {
          const data = await queryFn();
          if (data?.length > 0) {
            await cacheData(table, data as Array<{ id: string; [key: string]: unknown }>);
          }
          return data;
        } catch {
          return (await getCachedData(table)) as T[];
        }
      }
      return (await getCachedData(table)) as T[];
    },
    enabled,
    staleTime,
    networkMode: 'offlineFirst',
  });
}

/**
 * Offline-first single item query
 */
export function useOfflineItem<T extends { id: string }>({
  table,
  id,
  queryKey,
  queryFn,
  enabled = true,
}: {
  table: SupportedTable;
  id: string;
  queryKey: QueryKey;
  queryFn: () => Promise<T | null>;
  enabled?: boolean;
}) {
  const { isOnline } = useNetworkStatus();

  return useQuery({
    queryKey,
    queryFn: async () => {
      if (isOnline) {
        try {
          const data = await queryFn();
          if (data) {
            await cacheData(table, [data as { id: string; [key: string]: unknown }]);
          }
          return data;
        } catch {
          return (await getCachedItem(table, id)) as T | null;
        }
      }
      return (await getCachedItem(table, id)) as T | null;
    },
    enabled: enabled && !!id,
    networkMode: 'offlineFirst',
  });
}

interface UseOfflineMutationOptions {
  table: SupportedTable;
  invalidateKeys?: QueryKey[];
}

/**
 * Offline-first insert mutation
 */
export function useOfflineInsert({
  table,
  invalidateKeys = [],
}: UseOfflineMutationOptions) {
  const { isOnline } = useNetworkStatus();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const itemWithId = { ...data, id: (data.id as string) || crypto.randomUUID() };

      if (isOnline) {
        const { data: result, error } = await (supabase.from(table) as any)
          .insert(itemWithId)
          .select()
          .single();
        if (error) throw error;
        await cacheData(table, [result]);
        return result;
      }
      await addToSyncQueue(table, 'insert', itemWithId);
      await cacheData(table, [itemWithId]);
      return itemWithId;
    },
    onSuccess: () => invalidateKeys.forEach(k => queryClient.invalidateQueries({ queryKey: k })),
  });
}

/**
 * Offline-first update mutation
 */
export function useOfflineUpdate({
  table,
  invalidateKeys = [],
}: UseOfflineMutationOptions) {
  const { isOnline } = useNetworkStatus();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Record<string, unknown> & { id: string }) => {
      if (isOnline) {
        const { id, ...updateData } = data;
        const { data: result, error } = await (supabase.from(table) as any)
          .update(updateData)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        await cacheData(table, [result]);
        return result;
      }
      await addToSyncQueue(table, 'update', data);
      const existing = await getCachedItem(table, data.id);
      const updated = { ...existing, ...data };
      await cacheData(table, [updated as { id: string; [key: string]: unknown }]);
      return updated;
    },
    onSuccess: () => invalidateKeys.forEach(k => queryClient.invalidateQueries({ queryKey: k })),
  });
}

/**
 * Offline-first delete mutation
 */
export function useOfflineDelete({
  table,
  invalidateKeys = [],
}: UseOfflineMutationOptions) {
  const { isOnline } = useNetworkStatus();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (isOnline) {
        const { error } = await (supabase.from(table) as any).delete().eq('id', id);
        if (error) throw error;
      } else {
        await addToSyncQueue(table, 'delete', { id });
      }
      await deleteCachedItem(table, id);
      return id;
    },
    onSuccess: () => invalidateKeys.forEach(k => queryClient.invalidateQueries({ queryKey: k })),
  });
}
