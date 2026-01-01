import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { Json } from "@/integrations/supabase/types";

// Inline type to avoid circular imports
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

function getAnchorPointFromElement(
  element: HTMLElement,
  anchor: string,
  canvasOffset: { x: number; y: number }
): Point {
  const rect = element.getBoundingClientRect();
  
  const adjustedRect = {
    left: rect.left - canvasOffset.x,
    right: rect.right - canvasOffset.x,
    top: rect.top - canvasOffset.y,
    bottom: rect.bottom - canvasOffset.y,
    width: rect.width,
    height: rect.height,
  };

  switch (anchor) {
    case 'left':
      return { x: adjustedRect.left, y: adjustedRect.top + adjustedRect.height / 2 };
    case 'right':
      return { x: adjustedRect.right, y: adjustedRect.top + adjustedRect.height / 2 };
    case 'top':
      return { x: adjustedRect.left + adjustedRect.width / 2, y: adjustedRect.top };
    case 'bottom':
      return { x: adjustedRect.left + adjustedRect.width / 2, y: adjustedRect.bottom };
    default:
      return { x: adjustedRect.right, y: adjustedRect.top + adjustedRect.height / 2 };
  }
}

function generateBezierPath(start: Point, end: Point, startAnchor: string, endAnchor: string): string {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const curvature = Math.min(distance * 0.5, 120);

  let cp1x = start.x;
  let cp1y = start.y;
  let cp2x = end.x;
  let cp2y = end.y;

  switch (startAnchor) {
    case 'right': cp1x = start.x + curvature; break;
    case 'left': cp1x = start.x - curvature; break;
    case 'bottom': cp1y = start.y + curvature; break;
    case 'top': cp1y = start.y - curvature; break;
  }

  switch (endAnchor) {
    case 'right': cp2x = end.x + curvature; break;
    case 'left': cp2x = end.x - curvature; break;
    case 'bottom': cp2y = end.y + curvature; break;
    case 'top': cp2y = end.y - curvature; break;
  }

  return `M ${start.x} ${start.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${end.x} ${end.y}`;
}

// Premium arrow head design - sleek chevron style
function getArrowHead(end: Point, endAnchor: string, size: number = 10): string {
  const angle = Math.PI / 6;
  let baseAngle: number;
  
  switch (endAnchor) {
    case 'left': baseAngle = 0; break;
    case 'right': baseAngle = Math.PI; break;
    case 'top': baseAngle = Math.PI / 2; break;
    case 'bottom': baseAngle = -Math.PI / 2; break;
    default: baseAngle = 0;
  }
  
  const tipX = end.x;
  const tipY = end.y;
  const x1 = end.x + size * Math.cos(baseAngle - angle);
  const y1 = end.y + size * Math.sin(baseAngle - angle);
  const x2 = end.x + size * Math.cos(baseAngle + angle);
  const y2 = end.y + size * Math.sin(baseAngle + angle);
  const insetX = end.x + (size * 0.35) * Math.cos(baseAngle);
  const insetY = end.y + (size * 0.35) * Math.sin(baseAngle);
  
  return `M ${tipX} ${tipY} L ${x1} ${y1} L ${insetX} ${insetY} L ${x2} ${y2} Z`;
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
  const pathRef = useRef<SVGPathElement>(null);
  const hitAreaRef = useRef<SVGPathElement>(null);
  const arrowRef = useRef<SVGPathElement>(null);
  const startDotRef = useRef<SVGCircleElement>(null);
  const endDotRef = useRef<SVGCircleElement>(null);
  const deleteButtonRef = useRef<SVGGElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  const updatePath = useCallback(() => {
    if (!connector.startItemId || !connector.endItemId) return;

    const startEl = document.querySelector(`[data-item-id="${connector.startItemId}"]`) as HTMLElement;
    const endEl = document.querySelector(`[data-item-id="${connector.endItemId}"]`) as HTMLElement;

    if (!startEl || !endEl) {
      setIsVisible(false);
      return;
    }

    setIsVisible(true);

    const startPoint = getAnchorPointFromElement(startEl, connector.startAnchor, canvasOffset);
    const endPoint = getAnchorPointFromElement(endEl, connector.endAnchor, canvasOffset);
    const path = generateBezierPath(startPoint, endPoint, connector.startAnchor, connector.endAnchor);
    const arrowPath = getArrowHead(endPoint, connector.endAnchor, 14);

    if (pathRef.current) {
      pathRef.current.setAttribute('d', path);
    }
    if (hitAreaRef.current) {
      hitAreaRef.current.setAttribute('d', path);
    }
    if (arrowRef.current) {
      arrowRef.current.setAttribute('d', arrowPath);
    }
    if (startDotRef.current && isSelected) {
      startDotRef.current.setAttribute('cx', String(startPoint.x));
      startDotRef.current.setAttribute('cy', String(startPoint.y));
    }
    if (endDotRef.current && isSelected) {
      endDotRef.current.setAttribute('cx', String(endPoint.x));
      endDotRef.current.setAttribute('cy', String(endPoint.y));
    }
    if (deleteButtonRef.current && isSelected) {
      const midX = (startPoint.x + endPoint.x) / 2;
      const midY = (startPoint.y + endPoint.y) / 2;
      deleteButtonRef.current.setAttribute('transform', `translate(${midX}, ${midY})`);
    }
  }, [connector, canvasOffset, isSelected]);

  useEffect(() => {
    updatePath();

    const handleDrag = () => {
      requestAnimationFrame(updatePath);
    };

    const handlePan = () => {
      requestAnimationFrame(updatePath);
    };

    window.addEventListener('board-item-drag', handleDrag);
    window.addEventListener('board-canvas-pan', handlePan);
    window.addEventListener('resize', handleDrag);

    // Update more frequently during interactions
    const interval = setInterval(updatePath, 100);

    return () => {
      window.removeEventListener('board-item-drag', handleDrag);
      window.removeEventListener('board-canvas-pan', handlePan);
      window.removeEventListener('resize', handleDrag);
      clearInterval(interval);
    };
  }, [updatePath]);

  useEffect(() => {
    updatePath();
  }, [canvasOffset, updatePath]);

  if (!isVisible) return null;

  const strokeColor = isSelected ? '#818cf8' : (connector.strokeColor || '#94a3b8');
  const glowColor = isSelected ? 'rgba(129, 140, 248, 0.6)' : 'rgba(148, 163, 184, 0.3)';
  const lineWidth = connector.strokeWidth || 2;

  return (
    <g>
      {/* Glow effect behind the line */}
      <path
        fill="none"
        stroke={glowColor}
        strokeWidth={lineWidth + 6}
        strokeLinecap="round"
        className="pointer-events-none"
        style={{ filter: 'blur(4px)' }}
        ref={(el) => {
          if (el && pathRef.current) {
            const d = pathRef.current.getAttribute('d');
            if (d) el.setAttribute('d', d);
          }
        }}
      />
      
      {/* Hit area for clicking */}
      <path
        ref={hitAreaRef}
        fill="none"
        stroke="transparent"
        strokeWidth={28}
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
      
      {/* Main line - gradient effect simulated with layered strokes */}
      <path
        fill="none"
        stroke="rgba(0,0,0,0.2)"
        strokeWidth={lineWidth + 1}
        strokeDasharray={connector.strokeStyle === 'dashed' ? '8 5' : undefined}
        className="pointer-events-none"
        strokeLinecap="round"
        ref={(el) => {
          if (el && pathRef.current) {
            const d = pathRef.current.getAttribute('d');
            if (d) el.setAttribute('d', d);
          }
        }}
      />
      <path
        ref={pathRef}
        fill="none"
        stroke={strokeColor}
        strokeWidth={lineWidth}
        strokeDasharray={connector.strokeStyle === 'dashed' ? '8 5' : undefined}
        className="pointer-events-none transition-all duration-200"
        strokeLinecap="round"
      />
      
      {/* Arrow head - filled with premium look */}
      <path
        ref={arrowRef}
        fill={strokeColor}
        stroke="none"
        className="pointer-events-none transition-all duration-200"
        style={{ filter: isSelected ? 'drop-shadow(0 0 3px rgba(129, 140, 248, 0.5))' : 'none' }}
      />
      
      {isSelected && (
        <>
          {/* Selected state anchor dots with glow */}
          <circle
            ref={startDotRef}
            r={7}
            fill="#818cf8"
            stroke="#ffffff"
            strokeWidth={2.5}
            className="pointer-events-none"
            style={{ filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))' }}
          />
          <circle
            ref={endDotRef}
            r={7}
            fill="#818cf8"
            stroke="#ffffff"
            strokeWidth={2.5}
            className="pointer-events-none"
            style={{ filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))' }}
          />
          
          {/* Delete button with better styling */}
          <g
            ref={deleteButtonRef}
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
            <circle r={14} fill="#ef4444" style={{ filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))' }} />
            <circle r={12} fill="#dc2626" />
            <text
              textAnchor="middle"
              dominantBaseline="central"
              fill="white"
              fontSize={16}
              fontWeight="bold"
              className="pointer-events-none select-none"
            >
              ×
            </text>
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
  const connectors: Connector[] = items
    .filter(item => item.type === 'connector')
    .map(item => ({
      id: item.id,
      startItemId: item.start_item_id || null,
      endItemId: item.end_item_id || null,
      startAnchor: item.start_anchor || 'right',
      endAnchor: item.end_anchor || 'left',
      strokeWidth: item.stroke_width || 2,
      strokeStyle: item.stroke_style || 'solid',
      strokeColor: item.stroke_color || '#94a3b8',
    }));

  const handleBackgroundClick = useCallback(() => {
    onSelectConnector(null);
  }, [onSelectConnector]);

  const svgRef = useRef<SVGSVGElement>(null);
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });

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
    const handleResize = () => {
      updateCanvasOffset();
    };

    const handlePan = () => {
      updateCanvasOffset();
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('board-canvas-pan', handlePan);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('board-canvas-pan', handlePan);
    };
  }, [updateCanvasOffset]);

  if (connectors.length === 0) {
    return null;
  }

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 pointer-events-none overflow-visible"
      style={{ zIndex: 5 }}
    >
      <defs>
        {/* SVG filters for premium effects */}
        <filter id="connector-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g 
        className="pointer-events-auto"
        onClick={handleBackgroundClick}
      >
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
