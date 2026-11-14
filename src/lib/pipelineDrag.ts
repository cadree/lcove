/** Press-and-hold before a touch drag starts. Shorter steals vertical scrolls. */
export const TOUCH_HOLD_MS = 220;
/** Finger travel allowed during the hold before it counts as a scroll instead. */
export const TOUCH_TOLERANCE_PX = 8;
/** Mouse travel before a press becomes a drag, so a click still opens the contact. */
export const MOUSE_DRAG_DISTANCE_PX = 6;

interface Placed {
  id: string;
  stage_id: string;
  sort_order: number;
}

/**
 * Column a drop lands in. `overId` is a column id, or a card id when the
 * finger is over another contact. Returns null when nothing would change.
 */
export function dropStage(
  itemId: string,
  overId: string | null | undefined,
  items: readonly Placed[],
  stageIds: readonly string[],
): string | null {
  if (!overId) return null;
  const item = items.find((entry) => entry.id === itemId);
  if (!item) return null;
  const stage = stageIds.includes(overId) ? overId : items.find((entry) => entry.id === overId)?.stage_id;
  if (!stage || stage === item.stage_id) return null;
  return stage;
}

/** Bottom of the target column. */
export function endOfStage(items: readonly Placed[], stageId: string): number {
  const orders = items.filter((entry) => entry.stage_id === stageId).map((entry) => entry.sort_order);
  return orders.length ? Math.max(...orders) + 1 : 0;
}

export function moveLocally<T extends Placed>(items: readonly T[], itemId: string, stageId: string, sortOrder: number): T[] {
  return items.map((entry) => (entry.id === itemId ? { ...entry, stage_id: stageId, sort_order: sortOrder } : entry));
}
