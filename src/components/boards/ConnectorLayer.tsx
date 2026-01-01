import { memo, useCallback, useEffect, useRef, useState } from "react";

interface BoardItemData {
  id: string;
  type: string;
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

// Get the best anchor point - Milanote style (closest edge)
function getSmartAnchorPoint(
  startRect: DOMRect, 
  endRect: DOMRect,
  canvasOffset: { x: number; y: number }
): { startPoint: Point; endPoint: Point } {
  const startCenter = {
    x: startRect.left + startRect.width / 2 - canvasOffset.x,
    y: startRect.top + startRect.height / 2 - canvasOffset.y
  };
  const endCenter = {
    x: endRect.left + endRect.width / 2 - canvasOffset.x,
    y: endRect.top + endRect.height / 2 - canvasOffset.y
  };

  // Calculate angle between centers
  const dx = endCenter.x - startCenter.x;
  const dy = endCenter.y - startCenter.y;

  // Determine best exit/entry points based on relative position
  let startPoint: Point;
  let endPoint: Point;

  // Adjust start rect for canvas offset
  const sRect = {
    left: startRect.left - canvasOffset.x,
    right: startRect.right - canvasOffset.x,
    top: startRect.top - canvasOffset.y,
    bottom: startRect.bottom - canvasOffset.y,
    width: startRect.width,
    height: startRect.height
  };

  const eRect = {
    left: endRect.left - canvasOffset.x,
    right: endRect.right - canvasOffset.x,
    top: endRect.top - canvasOffset.y,
    bottom: endRect.bottom - canvasOffset.y,
    width: endRect.width,
    height: endRect.height
  };

  // More horizontal than vertical
  if (Math.abs(dx) > Math.abs(dy)) {
    if (dx > 0) {
      // End is to the right
      startPoint = { x: sRect.right, y: sRect.top + sRect.height / 2 };
      endPoint = { x: eRect.left, y: eRect.top + eRect.height / 2 };
    } else {
      // End is to the left
      startPoint = { x: sRect.left, y: sRect.top + sRect.height / 2 };
      endPoint = { x: eRect.right, y: eRect.top + eRect.height / 2 };
    }
  } else {
    // More vertical than horizontal
    if (dy > 0) {
      // End is below
      startPoint = { x: sRect.left + sRect.width / 2, y: sRect.bottom };
      endPoint = { x: eRect.left + eRect.width / 2, y: eRect.top };
    } else {
      // End is above
      startPoint = { x: sRect.left + sRect.width / 2, y: sRect.top };
      endPoint = { x: eRect.left + eRect.width / 2, y: eRect.bottom };
    }
  }

  return { startPoint, endPoint };
}

// Generate smooth bezier curve - Milanote style
function generateSmoothPath(start: Point, end: Point): string {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // Control point offset - creates nice smooth curves
  const curveStrength = Math.min(distance * 0.3, 60);
  
  // Determine curve direction based on start/end orientation
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
function getArrowPath(end: Point, start: Point, size: number = 8): string {
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const arrowAngle = Math.PI / 6; // 30 degrees
  
  const x1 = end.x - size * Math.cos(angle - arrowAngle);
  const y1 = end.y - size * Math.sin(angle - arrowAngle);
  const x2 = end.x - size * Math.cos(angle + arrowAngle);
  const y2 = end.y - size * Math.sin(angle + arrowAngle);
  
  return `M ${end.x} ${end.y} L ${x1} ${y1} L ${x2} ${y2} Z`;
}

const ConnectorPath = memo(function ConnectorPath({
  connector,
  canvasOffset,
  isSelected,
  onSelect,
  onDelete,
}: {
  connector: Connector;
  canvasOffset: { x: number; y: number };
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const [pathData, setPathData] = useState<{ path: string; arrow: string; midPoint: Point } | null>(null);

  const updatePath = useCallback(() => {
    if (!connector.startItemId || !connector.endItemId) return;

    const startEl = document.querySelector(`[data-item-id="${connector.startItemId}"]`) as HTMLElement;
    const endEl = document.querySelector(`[data-item-id="${connector.endItemId}"]`) as HTMLElement;

    if (!startEl || !endEl) {
      setPathData(null);
      return;
    }

    const startRect = startEl.getBoundingClientRect();
    const endRect = endEl.getBoundingClientRect();
    
    const { startPoint, endPoint } = getSmartAnchorPoint(startRect, endRect, canvasOffset);
    const path = generateSmoothPath(startPoint, endPoint);
    
    // Calculate control point for arrow direction
    const dx = endPoint.x - startPoint.x;
    const isHorizontal = Math.abs(dx) > Math.abs(endPoint.y - startPoint.y);
    const controlPoint = isHorizontal 
      ? { x: endPoint.x - Math.min(Math.abs(dx) * 0.3, 60), y: endPoint.y }
      : { x: endPoint.x, y: endPoint.y - Math.sign(endPoint.y - startPoint.y) * Math.min(Math.abs(endPoint.y - startPoint.y) * 0.3, 60) };
    
    const arrow = getArrowPath(endPoint, controlPoint, 10);
    
    const midPoint = {
      x: (startPoint.x + endPoint.x) / 2,
      y: (startPoint.y + endPoint.y) / 2
    };

    setPathData({ path, arrow, midPoint });
  }, [connector, canvasOffset]);

  useEffect(() => {
    updatePath();
    
    const handleUpdate = () => requestAnimationFrame(updatePath);
    
    window.addEventListener('board-item-drag', handleUpdate);
    window.addEventListener('board-canvas-pan', handleUpdate);
    window.addEventListener('resize', handleUpdate);
    
    const interval = setInterval(updatePath, 32); // ~30fps for smooth updates
    
    return () => {
      window.removeEventListener('board-item-drag', handleUpdate);
      window.removeEventListener('board-canvas-pan', handleUpdate);
      window.removeEventListener('resize', handleUpdate);
      clearInterval(interval);
    };
  }, [updatePath]);

  if (!pathData) return null;

  // Milanote uses a subtle gray/teal color for lines
  const lineColor = isSelected ? 'hsl(340, 82%, 65%)' : 'hsl(200, 15%, 50%)';
  const lineWidth = connector.strokeWidth || 1.5;

  return (
    <g className="connector-group">
      {/* Hit area - invisible wider stroke for easier clicking */}
      <path
        d={pathData.path}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        className="cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        onTouchEnd={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      />
      
      {/* Main line - Milanote style: thin, clean, slightly transparent */}
      <path
        d={pathData.path}
        fill="none"
        stroke={lineColor}
        strokeWidth={lineWidth}
        strokeLinecap="round"
        className="pointer-events-none transition-colors duration-150"
        style={{ opacity: isSelected ? 1 : 0.7 }}
      />
      
      {/* Arrowhead - filled, elegant */}
      <path
        d={pathData.arrow}
        fill={lineColor}
        stroke="none"
        className="pointer-events-none transition-colors duration-150"
        style={{ opacity: isSelected ? 1 : 0.7 }}
      />
      
      {/* Selection UI - only show when selected */}
      {isSelected && (
        <>
          {/* Center control dot */}
          <circle
            cx={pathData.midPoint.x}
            cy={pathData.midPoint.y}
            r={5}
            fill="white"
            stroke="hsl(340, 82%, 65%)"
            strokeWidth={2}
            className="cursor-move"
            style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))' }}
          />
          
          {/* Delete button */}
          <g
            transform={`translate(${pathData.midPoint.x + 16}, ${pathData.midPoint.y - 16})`}
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
            <circle r={12} fill="hsl(0, 72%, 51%)" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }} />
            <path
              d="M -4 -4 L 4 4 M 4 -4 L -4 4"
              stroke="white"
              strokeWidth={2}
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
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });

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
      strokeColor: item.stroke_color || 'hsl(200, 15%, 50%)',
    }));

  const updateCanvasOffset = useCallback(() => {
    if (svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      setCanvasOffset({ x: rect.left + offset.x, y: rect.top + offset.y });
    }
  }, [offset]);

  useEffect(() => {
    updateCanvasOffset();
  }, [offset, updateCanvasOffset]);

  useEffect(() => {
    const handleUpdate = () => updateCanvasOffset();
    
    window.addEventListener('resize', handleUpdate);
    window.addEventListener('board-canvas-pan', handleUpdate);
    
    const interval = setInterval(updateCanvasOffset, 32);
    
    return () => {
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('board-canvas-pan', handleUpdate);
      clearInterval(interval);
    };
  }, [updateCanvasOffset]);

  const handleBackgroundClick = useCallback(() => {
    onSelectConnector(null);
  }, [onSelectConnector]);

  if (connectors.length === 0) return null;

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 pointer-events-none overflow-visible"
      style={{ zIndex: 10 }}
    >
      <g className="pointer-events-auto" onClick={handleBackgroundClick}>
        {connectors.map((connector) => (
          <ConnectorPath
            key={connector.id}
            connector={connector}
            canvasOffset={canvasOffset}
            isSelected={selectedConnectorId === connector.id}
            onSelect={() => onSelectConnector(connector.id)}
            onDelete={() => onDeleteConnector(connector.id)}
          />
        ))}
      </g>
    </svg>
  );
}
