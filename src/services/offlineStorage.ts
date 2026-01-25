/**
 * Offline Storage Service
 * Provides IndexedDB-based caching for offline-first functionality
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';

// Define the database schema
interface EtherDBSchema extends DBSchema {
  profiles: {
    key: string;
    value: {
      id: string;
      data: Record<string, unknown>;
      updated_at: number;
    };
    indexes: { 'by-updated': number };
  };
  messages: {
    key: string;
    value: {
      id: string;
      conversation_id: string;
      data: Record<string, unknown>;
      updated_at: number;
    };
    indexes: { 'by-conversation': string; 'by-updated': number };
  };
  conversations: {
    key: string;
    value: {
      id: string;
      data: Record<string, unknown>;
      updated_at: number;
    };
    indexes: { 'by-updated': number };
  };
  posts: {
    key: string;
    value: {
      id: string;
      data: Record<string, unknown>;
      updated_at: number;
    };
    indexes: { 'by-updated': number };
  };
  notifications: {
    key: string;
    value: {
      id: string;
      data: Record<string, unknown>;
      updated_at: number;
    };
    indexes: { 'by-updated': number };
  };
  projects: {
    key: string;
    value: {
      id: string;
      data: Record<string, unknown>;
      updated_at: number;
    };
    indexes: { 'by-updated': number };
  };
  pipeline_items: {
    key: string;
    value: {
      id: string;
      pipeline_id: string;
      data: Record<string, unknown>;
      updated_at: number;
    };
    indexes: { 'by-pipeline': string; 'by-updated': number };
  };
  calendar_tasks: {
    key: string;
    value: {
      id: string;
      data: Record<string, unknown>;
      updated_at: number;
    };
    indexes: { 'by-updated': number };
  };
  sync_queue: {
    key: number;
    value: {
      id?: number;
      table: string;
      operation: 'insert' | 'update' | 'delete';
      data: Record<string, unknown>;
      created_at: number;
      retries: number;
    };
  };
  cache_meta: {
    key: string;
    value: {
      table: string;
      last_sync: number;
      etag?: string;
    };
  };
}

type CacheableTable = 
  | 'profiles'
  | 'messages'
  | 'conversations'
  | 'posts'
  | 'notifications'
  | 'projects'
  | 'pipeline_items'
  | 'calendar_tasks';

const DB_NAME = 'ether-offline-db';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<EtherDBSchema> | null = null;

/**
 * Initialize and get the database instance
 */
export async function getDB(): Promise<IDBPDatabase<EtherDBSchema>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<EtherDBSchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Profiles store
      if (!db.objectStoreNames.contains('profiles')) {
        const profileStore = db.createObjectStore('profiles', { keyPath: 'id' });
        profileStore.createIndex('by-updated', 'updated_at');
      }

      // Messages store
      if (!db.objectStoreNames.contains('messages')) {
        const messageStore = db.createObjectStore('messages', { keyPath: 'id' });
        messageStore.createIndex('by-conversation', 'conversation_id');
        messageStore.createIndex('by-updated', 'updated_at');
      }

      // Conversations store
      if (!db.objectStoreNames.contains('conversations')) {
        const convStore = db.createObjectStore('conversations', { keyPath: 'id' });
        convStore.createIndex('by-updated', 'updated_at');
      }

      // Posts store
      if (!db.objectStoreNames.contains('posts')) {
        const postStore = db.createObjectStore('posts', { keyPath: 'id' });
        postStore.createIndex('by-updated', 'updated_at');
      }

      // Notifications store
      if (!db.objectStoreNames.contains('notifications')) {
        const notifStore = db.createObjectStore('notifications', { keyPath: 'id' });
        notifStore.createIndex('by-updated', 'updated_at');
      }

      // Projects store
      if (!db.objectStoreNames.contains('projects')) {
        const projectStore = db.createObjectStore('projects', { keyPath: 'id' });
        projectStore.createIndex('by-updated', 'updated_at');
      }

      // Pipeline items store
      if (!db.objectStoreNames.contains('pipeline_items')) {
        const pipelineStore = db.createObjectStore('pipeline_items', { keyPath: 'id' });
        pipelineStore.createIndex('by-pipeline', 'pipeline_id');
        pipelineStore.createIndex('by-updated', 'updated_at');
      }

      // Calendar tasks store
      if (!db.objectStoreNames.contains('calendar_tasks')) {
        const calendarStore = db.createObjectStore('calendar_tasks', { keyPath: 'id' });
        calendarStore.createIndex('by-updated', 'updated_at');
      }

      // Sync queue store
      if (!db.objectStoreNames.contains('sync_queue')) {
        db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
      }

      // Cache metadata store
      if (!db.objectStoreNames.contains('cache_meta')) {
        db.createObjectStore('cache_meta', { keyPath: 'table' });
      }
    },
  });

  return dbInstance;
}

/**
 * Cache data for a specific table
 */
export async function cacheData(
  table: CacheableTable,
  items: Array<{ id: string; [key: string]: unknown }>
): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(table, 'readwrite');
  const store = tx.objectStore(table);

  const now = Date.now();
  
  for (const item of items) {
    const baseItem = {
      id: item.id,
      data: item as Record<string, unknown>,
      updated_at: now,
    };

    if (table === 'messages' && 'conversation_id' in item) {
      await store.put({
        ...baseItem,
        conversation_id: item.conversation_id as string,
      } as EtherDBSchema['messages']['value']);
    } else if (table === 'pipeline_items' && 'pipeline_id' in item) {
      await store.put({
        ...baseItem,
        pipeline_id: item.pipeline_id as string,
      } as EtherDBSchema['pipeline_items']['value']);
    } else {
      await store.put(baseItem as EtherDBSchema[typeof table]['value']);
    }
  }

  await tx.done;

  // Update cache metadata
  await updateCacheMeta(table, now);
}

/**
 * Get cached data for a specific table
 */
export async function getCachedData(
  table: CacheableTable,
  limit?: number
): Promise<Record<string, unknown>[]> {
  const db = await getDB();
  const tx = db.transaction(table, 'readonly');
  const store = tx.objectStore(table);
  const index = store.index('by-updated');

  const items = await index.getAll(undefined, limit);
  return items.map(item => item.data).reverse();
}

/**
 * Get a single cached item by ID
 */
export async function getCachedItem(
  table: CacheableTable,
  id: string
): Promise<Record<string, unknown> | null> {
  const db = await getDB();
  const item = await db.get(table, id);
  return item?.data || null;
}

/**
 * Delete cached item
 */
export async function deleteCachedItem(
  table: CacheableTable,
  id: string
): Promise<void> {
  const db = await getDB();
  await db.delete(table, id);
}

/**
 * Clear all cached data for a table
 */
export async function clearCache(table: CacheableTable): Promise<void> {
  const db = await getDB();
  await db.clear(table);
}

/**
 * Update cache metadata
 */
async function updateCacheMeta(table: string, lastSync: number): Promise<void> {
  const db = await getDB();
  await db.put('cache_meta', { table, last_sync: lastSync });
}

/**
 * Get cache metadata
 */
export async function getCacheMeta(table: string): Promise<{ last_sync: number } | null> {
  const db = await getDB();
  const meta = await db.get('cache_meta', table);
  return meta || null;
}

/**
 * Add an operation to the sync queue
 */
export async function addToSyncQueue(
  table: string,
  operation: 'insert' | 'update' | 'delete',
  data: Record<string, unknown>
): Promise<void> {
  const db = await getDB();
  await db.add('sync_queue', {
    table,
    operation,
    data,
    created_at: Date.now(),
    retries: 0,
  });
}

/**
 * Get all pending sync operations
 */
export async function getPendingSyncOps(): Promise<EtherDBSchema['sync_queue']['value'][]> {
  const db = await getDB();
  return db.getAll('sync_queue');
}

/**
 * Remove a sync operation after successful sync
 */
export async function removeSyncOp(id: number): Promise<void> {
  const db = await getDB();
  await db.delete('sync_queue', id);
}

/**
 * Increment retry count for a sync operation
 */
export async function incrementSyncRetry(id: number): Promise<void> {
  const db = await getDB();
  const op = await db.get('sync_queue', id);
  if (op) {
    op.retries += 1;
    await db.put('sync_queue', op);
  }
}

/**
 * Get count of pending sync operations
 */
export async function getPendingSyncCount(): Promise<number> {
  const db = await getDB();
  return db.count('sync_queue');
}

/**
 * Clear all data (for logout)
 */
export async function clearAllData(): Promise<void> {
  const db = await getDB();
  const cacheableStores: CacheableTable[] = [
    'profiles',
    'messages',
    'conversations',
    'posts',
    'notifications',
    'projects',
    'pipeline_items',
    'calendar_tasks',
  ];

  for (const store of cacheableStores) {
    await db.clear(store);
  }
  
  await db.clear('sync_queue');
  await db.clear('cache_meta');
}

/**
 * Get messages for a specific conversation
 */
export async function getConversationMessages(conversationId: string): Promise<Record<string, unknown>[]> {
  const db = await getDB();
  const tx = db.transaction('messages', 'readonly');
  const index = tx.objectStore('messages').index('by-conversation');
  const items = await index.getAll(conversationId);
  return items.map(item => item.data);
}

/**
 * Get pipeline items for a specific pipeline
 */
export async function getPipelineItems(pipelineId: string): Promise<Record<string, unknown>[]> {
  const db = await getDB();
  const tx = db.transaction('pipeline_items', 'readonly');
  const index = tx.objectStore('pipeline_items').index('by-pipeline');
  const items = await index.getAll(pipelineId);
  return items.map(item => item.data);
}
