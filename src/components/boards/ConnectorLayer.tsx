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
  const curvature = Math.min(distance * 0.4, 100);

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

    if (pathRef.current) {
      pathRef.current.setAttribute('d', path);
    }
    if (hitAreaRef.current) {
      hitAreaRef.current.setAttribute('d', path);
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

    window.addEventListener('board-item-drag', handleDrag);
    window.addEventListener('resize', handleDrag);

    return () => {
      window.removeEventListener('board-item-drag', handleDrag);
      window.removeEventListener('resize', handleDrag);
    };
  }, [updatePath]);

  useEffect(() => {
    updatePath();
  }, [canvasOffset, updatePath]);

  if (!isVisible) return null;

  return (
    <g>
      <path
        ref={hitAreaRef}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        className="cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      />
      <path
        ref={pathRef}
        fill="none"
        stroke={isSelected ? '#3b82f6' : connector.strokeColor}
        strokeWidth={connector.strokeWidth}
        strokeDasharray={connector.strokeStyle === 'dashed' ? '8 4' : undefined}
        className="pointer-events-none"
        strokeLinecap="round"
      />
      {isSelected && (
        <>
          <circle
            ref={startDotRef}
            r={6}
            fill="#3b82f6"
            className="pointer-events-none"
          />
          <circle
            ref={endDotRef}
            r={6}
            fill="#3b82f6"
            className="pointer-events-none"
          />
          <g
            ref={deleteButtonRef}
            className="cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <circle r={12} fill="#ef4444" />
            <text
              textAnchor="middle"
              dominantBaseline="central"
              fill="white"
              fontSize={14}
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
      strokeColor: item.stroke_color || '#ffffff',
    }));

  const handleBackgroundClick = useCallback(() => {
    onSelectConnector(null);
  }, [onSelectConnector]);

  const svgRef = useRef<SVGSVGElement>(null);
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      setCanvasOffset({ x: rect.left + offset.x, y: rect.top + offset.y });
    }
  }, [offset]);

  useEffect(() => {
    const handleResize = () => {
      if (svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect();
        setCanvasOffset({ x: rect.left + offset.x, y: rect.top + offset.y });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [offset]);

  if (connectors.length === 0) {
    return null;
  }

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 pointer-events-none overflow-visible"
      style={{ zIndex: 5 }}
    >
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
