import { memo, useCallback, useEffect, useRef, useState } from "react";

interface BoardItemData {
  id: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  start_item_id?: string | null;
  end_item_id?: string | null;
  start_anchor?: string | null;
  end_anchor?: string | null;
  stroke_width?: number;
  stroke_style?: string;
  stroke_color?: string;
}

interface Connector {
  id: string;
  startItemId: string | null;
  endItemId: string | null;
  startAnchor: string;
  endAnchor: string;
  strokeWidth: number;
  strokeStyle: string;
  strokeColor: string;
}

interface ConnectorLayerProps {
  items: BoardItemData[];
  offset: { x: number; y: number };
  scale?: number;
  selectedConnectorId: string | null;
  onSelectConnector: (id: string | null) => void;
  onDeleteConnector: (id: string) => void;
}

interface Point {
  x: number;
  y: number;
}

// Get anchor point on the edge of a card based on relative position
function getSmartAnchorPoints(
  startItem: BoardItemData,
  endItem: BoardItemData
): { startPoint: Point; endPoint: Point } {
  const startCenter = {
    x: startItem.x + startItem.w / 2,
    y: startItem.y + startItem.h / 2
  };
  const endCenter = {
    x: endItem.x + endItem.w / 2,
    y: endItem.y + endItem.h / 2
  };

  const dx = endCenter.x - startCenter.x;
  const dy = endCenter.y - startCenter.y;

  let startPoint: Point;
  let endPoint: Point;

  // More horizontal than vertical
  if (Math.abs(dx) > Math.abs(dy)) {
    if (dx > 0) {
      // End is to the right
      startPoint = { x: startItem.x + startItem.w, y: startItem.y + startItem.h / 2 };
      endPoint = { x: endItem.x, y: endItem.y + endItem.h / 2 };
    } else {
      // End is to the left
      startPoint = { x: startItem.x, y: startItem.y + startItem.h / 2 };
      endPoint = { x: endItem.x + endItem.w, y: endItem.y + endItem.h / 2 };
    }
  } else {
    // More vertical than horizontal
    if (dy > 0) {
      // End is below
      startPoint = { x: startItem.x + startItem.w / 2, y: startItem.y + startItem.h };
      endPoint = { x: endItem.x + endItem.w / 2, y: endItem.y };
    } else {
      // End is above
      startPoint = { x: startItem.x + startItem.w / 2, y: startItem.y };
      endPoint = { x: endItem.x + endItem.w / 2, y: endItem.y + endItem.h };
    }
  }

  return { startPoint, endPoint };
}

// Generate smooth bezier curve - Milanote style
function generateSmoothPath(start: Point, end: Point): string {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  const curveStrength = Math.min(distance * 0.35, 80);
  const isHorizontal = Math.abs(dx) > Math.abs(dy);
  
  let cp1x, cp1y, cp2x, cp2y;
  
  if (isHorizontal) {
    cp1x = start.x + curveStrength;
    cp1y = start.y;
    cp2x = end.x - curveStrength;
    cp2y = end.y;
  } else {
    cp1x = start.x;
    cp1y = start.y + (dy > 0 ? curveStrength : -curveStrength);
    cp2x = end.x;
    cp2y = end.y + (dy > 0 ? -curveStrength : curveStrength);
  }

  return `M ${start.x} ${start.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${end.x} ${end.y}`;
}

// Milanote-style arrowhead - small and elegant
function getArrowPath(end: Point, controlPoint: Point, size: number = 8): string {
  const angle = Math.atan2(end.y - controlPoint.y, end.x - controlPoint.x);
  const arrowAngle = Math.PI / 7; // ~25 degrees for sleeker look
  
  const x1 = end.x - size * Math.cos(angle - arrowAngle);
  const y1 = end.y - size * Math.sin(angle - arrowAngle);
  const x2 = end.x - size * Math.cos(angle + arrowAngle);
  const y2 = end.y - size * Math.sin(angle + arrowAngle);
  
  return `M ${end.x} ${end.y} L ${x1} ${y1} L ${x2} ${y2} Z`;
}

// Get control point for arrow direction calculation
function getControlPoint(start: Point, end: Point): Point {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const curveStrength = Math.min(distance * 0.35, 80);
  const isHorizontal = Math.abs(dx) > Math.abs(dy);
  
  if (isHorizontal) {
    return { x: end.x - curveStrength, y: end.y };
  } else {
    return { x: end.x, y: end.y + (dy > 0 ? -curveStrength : curveStrength) };
  }
}

// Parse item positions directly from DOM for real-time updates
function getItemPosition(itemId: string, items: BoardItemData[]): BoardItemData | null {
  // First try to get from DOM for real-time position
  const element = document.querySelector(`[data-item-id="${itemId}"]`) as HTMLElement;
  const item = items.find(i => i.id === itemId);
  
  if (!item) return null;
  
  if (element) {
    const style = element.style.transform;
    const match = style.match(/translate3d\(([^,]+)px,\s*([^,]+)px/);
    if (match) {
      return {
        ...item,
        x: parseFloat(match[1]),
        y: parseFloat(match[2]),
        w: element.offsetWidth || item.w,
        h: element.offsetHeight || item.h,
      };
    }
  }
  
  return item;
}

const ConnectorPath = memo(function ConnectorPath({
  connector,
  items,
  offset,
  scale,
  isSelected,
  onSelect,
  onDelete,
}: {
  connector: Connector;
  items: BoardItemData[];
  offset: { x: number; y: number };
  scale: number;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const [pathData, setPathData] = useState<{
    path: string;
    arrow: string;
    transformedStart: Point;
    transformedEnd: Point;
    midPoint: Point;
  } | null>(null);

  const updatePath = useCallback(() => {
    const startItem = getItemPosition(connector.startItemId || '', items);
    const endItem = getItemPosition(connector.endItemId || '', items);

    if (!startItem || !endItem) {
      setPathData(null);
      return;
    }

    const { startPoint, endPoint } = getSmartAnchorPoints(startItem, endItem);
    
    // Transform points by canvas offset and scale
    const transformedStart = {
      x: startPoint.x * scale + offset.x,
      y: startPoint.y * scale + offset.y
    };
    const transformedEnd = {
      x: endPoint.x * scale + offset.x,
      y: endPoint.y * scale + offset.y
    };

    const path = generateSmoothPath(transformedStart, transformedEnd);
    const controlPoint = getControlPoint(transformedStart, transformedEnd);
    const arrow = getArrowPath(transformedEnd, controlPoint, 9 * scale);
    
    const midPoint = {
      x: (transformedStart.x + transformedEnd.x) / 2,
      y: (transformedStart.y + transformedEnd.y) / 2
    };

    setPathData({ path, arrow, transformedStart, transformedEnd, midPoint });
  }, [connector.startItemId, connector.endItemId, items, offset, scale]);

  // Update on mount and when dependencies change
  useEffect(() => {
    updatePath();
  }, [updatePath]);

  // Listen for drag events with RAF for smooth updates
  useEffect(() => {
    let rafId: number | null = null;
    
    const handleDragUpdate = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        updatePath();
      });
    };
    
    window.addEventListener('board-item-drag', handleDragUpdate);
    window.addEventListener('board-canvas-pan', handleDragUpdate);
    
    // Poll during drags for maximum smoothness
    let pollInterval: number | null = null;
    const startPolling = () => {
      if (pollInterval) return;
      pollInterval = window.setInterval(updatePath, 16); // ~60fps
    };
    const stopPolling = () => {
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    };
    
    const handleDragState = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.moving) {
        startPolling();
      } else {
        stopPolling();
        updatePath();
      }
    };
    
    window.addEventListener('board-item-drag', handleDragState);
    
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      stopPolling();
      window.removeEventListener('board-item-drag', handleDragUpdate);
      window.removeEventListener('board-canvas-pan', handleDragUpdate);
      window.removeEventListener('board-item-drag', handleDragState);
    };
  }, [updatePath]);

  if (!pathData) return null;

  const { path, arrow, transformedStart, transformedEnd, midPoint } = pathData;

  // Milanote color palette - subtle warm gray
  const defaultColor = "rgba(120, 113, 108, 0.8)"; // Warm gray
  const selectedColor = "hsl(340, 82%, 65%)"; // Pink accent
  const lineColor = isSelected ? selectedColor : defaultColor;
  const lineWidth = (connector.strokeWidth || 1.5) * scale;

  return (
    <g className="connector-group">
      {/* Hit area - invisible wider stroke for easier clicking */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={Math.max(24, 24 * scale)}
        className="cursor-pointer"
        style={{ pointerEvents: 'stroke' }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        onTouchEnd={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onSelect();
        }}
      />
      
      {/* Main line - clean Milanote style */}
      <path
        d={path}
        fill="none"
        stroke={lineColor}
        strokeWidth={lineWidth}
        strokeLinecap="round"
        className="pointer-events-none"
      />
      
      {/* Arrowhead - filled, elegant */}
      <path
        d={arrow}
        fill={lineColor}
        stroke="none"
        className="pointer-events-none"
      />
      
      {/* Selection UI - only show when selected */}
      {isSelected && (
        <>
          {/* Start anchor dot */}
          <circle
            cx={transformedStart.x}
            cy={transformedStart.y}
            r={5 * scale}
            fill="white"
            stroke={selectedColor}
            strokeWidth={2}
            className="pointer-events-none"
            style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.15))' }}
          />
          
          {/* End anchor dot */}
          <circle
            cx={transformedEnd.x}
            cy={transformedEnd.y}
            r={5 * scale}
            fill="white"
            stroke={selectedColor}
            strokeWidth={2}
            className="pointer-events-none"
            style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.15))' }}
          />
          
          {/* Center control dot */}
          <circle
            cx={midPoint.x}
            cy={midPoint.y}
            r={6 * scale}
            fill="white"
            stroke={selectedColor}
            strokeWidth={2}
            className="cursor-move"
            style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.2))' }}
          />
          
          {/* Delete button */}
          <g
            transform={`translate(${midPoint.x + 18 * scale}, ${midPoint.y - 18 * scale})`}
            className="cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            onTouchEnd={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onDelete();
            }}
          >
            <circle 
              r={12 * scale} 
              fill="hsl(0, 72%, 51%)" 
              style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))' }} 
            />
            <path
              d={`M ${-4 * scale} ${-4 * scale} L ${4 * scale} ${4 * scale} M ${4 * scale} ${-4 * scale} L ${-4 * scale} ${4 * scale}`}
              stroke="white"
              strokeWidth={2 * scale}
              strokeLinecap="round"
              className="pointer-events-none"
            />
          </g>
        </>
      )}
    </g>
  );
});

export function ConnectorLayer({
  items,
  offset,
  scale = 1,
  selectedConnectorId,
  onSelectConnector,
  onDeleteConnector,
}: ConnectorLayerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [, forceUpdate] = useState(0);

  const connectors: Connector[] = items
    .filter(item => item.type === 'connector')
    .map(item => ({
      id: item.id,
      startItemId: item.start_item_id || null,
      endItemId: item.end_item_id || null,
      startAnchor: item.start_anchor || 'right',
      endAnchor: item.end_anchor || 'left',
      strokeWidth: item.stroke_width || 1.5,
      strokeStyle: item.stroke_style || 'solid',
      strokeColor: item.stroke_color || 'default',
    }));

  // Force re-render on item changes
  useEffect(() => {
    forceUpdate(n => n + 1);
  }, [items, offset, scale]);

  // Listen for resize events
  useEffect(() => {
    const handleUpdate = () => forceUpdate(n => n + 1);
    window.addEventListener('resize', handleUpdate);
    return () => window.removeEventListener('resize', handleUpdate);
  }, []);

  const handleBackgroundClick = useCallback(() => {
    onSelectConnector(null);
  }, [onSelectConnector]);

  if (connectors.length === 0) return null;

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 overflow-visible"
      style={{ zIndex: 5, pointerEvents: 'none' }}
    >
      <g style={{ pointerEvents: 'auto' }} onClick={handleBackgroundClick}>
        {connectors.map((connector) => (
          <ConnectorPath
            key={connector.id}
            connector={connector}
            items={items}
            offset={offset}
            scale={scale}
            isSelected={selectedConnectorId === connector.id}
            onSelect={() => onSelectConnector(connector.id)}
            onDelete={() => onDeleteConnector(connector.id)}
          />
        ))}
      </g>
    </svg>
  );
}
