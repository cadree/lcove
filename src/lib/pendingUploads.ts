/**
 * Placeholders for posts and stories that are still uploading. Kept outside
 * the query cache so a realtime refetch cannot drop them mid-upload.
 */
export type PendingKind = "post" | "story" | "portfolio";

export interface PendingItem {
  id: string;
  jobId: string;
  kind: PendingKind;
  userId: string;
  content: string | null;
  mediaUrl: string | null;
  mediaType: "photo" | "video" | "text";
  createdAt: string;
  failed: boolean;
}

let items: PendingItem[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export const pendingUploads = {
  add(item: PendingItem) {
    items = [item, ...items];
    emit();
  },
  update(id: string, next: Partial<PendingItem>) {
    items = items.map((item) => (item.id === id ? { ...item, ...next } : item));
    emit();
  },
  remove(id: string) {
    items = items.filter((item) => item.id !== id);
    emit();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
  getSnapshot(): PendingItem[] {
    return items;
  },
};

/** Pending placeholders first, minus any whose real row has already arrived. */
export function withPending<T extends { id: string; user_id: string; media_url: string | null; created_at: string }>(
  rows: T[],
  pending: readonly PendingItem[],
  kind: PendingKind,
  toRow: (item: PendingItem) => T,
): T[] {
  const mine = pending.filter((item) => item.kind === kind);
  if (!mine.length) return rows;
  return [...mine.map(toRow), ...rows];
}
