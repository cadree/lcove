import { useMemo } from "react";
import { BoardItem } from "./useBoardItems";

export interface Connector {
  id: string;
  startItemId: string | null;
  endItemId: string | null;
  startAnchor: 'left' | 'right' | 'top' | 'bottom';
  endAnchor: 'left' | 'right' | 'top' | 'bottom';
  strokeWidth: number;
  strokeStyle: 'solid' | 'dashed';
  strokeColor: string;
}

export interface ItemPosition {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export function useBoardConnectors(items: BoardItem[]) {
  const connectors = useMemo(() => {
    return items
      .filter(item => item.type === 'connector' || item.type === 'line')
      .filter(item => {
        // Only treat as connector if it has start/end item references
        return item.start_item_id || item.end_item_id;
      })
      .map(item => {
        return {
          id: item.id,
          startItemId: item.start_item_id || null,
          endItemId: item.end_item_id || null,
          startAnchor: (item.start_anchor || 'right') as Connector['startAnchor'],
          endAnchor: (item.end_anchor || 'left') as Connector['endAnchor'],
          strokeWidth: item.stroke_width ?? 2,
          strokeStyle: (item.stroke_style || 'solid') as Connector['strokeStyle'],
          strokeColor: item.stroke_color || '#ffffff',
        };
      });
  }, [items]);

  const itemPositions = useMemo(() => {
    const positions: Map<string, ItemPosition> = new Map();
    items.forEach(item => {
      if (item.type !== 'connector' && item.type !== 'line') {
        positions.set(item.id, {
          id: item.id,
          x: item.x,
          y: item.y,
          w: item.w,
          h: item.h,
        });
      }
    });
    return positions;
  }, [items]);

  return { connectors, itemPositions };
}

export function getAnchorPoint(
  position: ItemPosition,
  anchor: Connector['startAnchor'] | Connector['endAnchor']
): { x: number; y: number } {
  const { x, y, w, h } = position;
  
  switch (anchor) {
    case 'left':
      return { x: x, y: y + h / 2 };
    case 'right':
      return { x: x + w, y: y + h / 2 };
    case 'top':
      return { x: x + w / 2, y: y };
    case 'bottom':
      return { x: x + w / 2, y: y + h };
    default:
      return { x: x + w, y: y + h / 2 };
  }
}

export function generateBezierPath(
  start: { x: number; y: number },
  end: { x: number; y: number },
  startAnchor: Connector['startAnchor'],
  endAnchor: Connector['endAnchor']
): string {
  const dx = Math.abs(end.x - start.x);
  const dy = Math.abs(end.y - start.y);
  const curvature = Math.min(Math.max(dx, dy) * 0.5, 100);

  let cp1x = start.x;
  let cp1y = start.y;
  let cp2x = end.x;
  let cp2y = end.y;

  // Control points based on anchor direction
  switch (startAnchor) {
    case 'right':
      cp1x = start.x + curvature;
      break;
    case 'left':
      cp1x = start.x - curvature;
      break;
    case 'top':
      cp1y = start.y - curvature;
      break;
    case 'bottom':
      cp1y = start.y + curvature;
      break;
  }

  switch (endAnchor) {
    case 'right':
      cp2x = end.x + curvature;
      break;
    case 'left':
      cp2x = end.x - curvature;
      break;
    case 'top':
      cp2y = end.y - curvature;
      break;
    case 'bottom':
      cp2y = end.y + curvature;
      break;
  }

  return `M ${start.x} ${start.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${end.x} ${end.y}`;
}
