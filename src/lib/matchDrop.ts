export interface MatchRect {
  id: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface MatchPoint {
  x: number;
  y: number;
}

/** Visible part of a card inside the horizontal scroller. */
export function visibleMatchRect(card: MatchRect, port?: MatchRect | null): MatchRect | null {
  const left = port ? Math.max(card.left, port.left) : card.left;
  const right = port ? Math.min(card.right, port.right) : card.right;
  const top = port ? Math.max(card.top, port.top) : card.top;
  const bottom = port ? Math.min(card.bottom, port.bottom) : card.bottom;
  if (right - left < 1 || bottom - top < 1) return null;
  return { id: card.id, left, top, right, bottom };
}

/**
 * Card under the pointer, using the part that is still inside the scroller.
 * The source card is ignored so a captured drag can land on a neighbor that
 * is only partly on screen.
 */
export function matchDropTarget(
  pointer: MatchPoint,
  cards: MatchRect[],
  sourceId: string,
  port?: MatchRect | null,
): string | null {
  for (const card of cards) {
    if (!card.id || card.id === sourceId) continue;
    const visible = visibleMatchRect(card, port);
    if (!visible) continue;
    if (
      pointer.x >= visible.left &&
      pointer.x <= visible.right &&
      pointer.y >= visible.top &&
      pointer.y <= visible.bottom
    ) {
      return card.id;
    }
  }
  return null;
}
