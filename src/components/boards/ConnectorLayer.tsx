import { memo, useCallback, useMemo } from "react";
import { BoardItem } from "@/hooks/useBoardItems";
import { 
  useBoardConnectors, 
  getAnchorPoint, 
  generateBezierPath,
  Connector,
  ItemPosition 
} from "@/hooks/useBoardConnectors";

interface ConnectorLayerProps {
  items: BoardItem[];
  offset: { x: number; y: number };
  selectedConnectorId: string | null;
  onSelectConnector: (id: string | null) => void;
  onDeleteConnector: (id: string) => void;
}

interface ConnectorPathProps {
  connector: Connector;
  itemPositions: Map<string, ItemPosition>;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

const ConnectorPath = memo(function ConnectorPath({
  connector,
  itemPositions,
  isSelected,
  onSelect,
  onDelete,
}: ConnectorPathProps) {
  const startPosition = connector.startItemId 
    ? itemPositions.get(connector.startItemId) 
    : null;
  const endPosition = connector.endItemId 
    ? itemPositions.get(connector.endItemId) 
    : null;

  if (!startPosition || !endPosition) {
    return null;
  }

  const startPoint = getAnchorPoint(startPosition, connector.startAnchor);
  const endPoint = getAnchorPoint(endPosition, connector.endAnchor);
  const path = generateBezierPath(startPoint, endPoint, connector.startAnchor, connector.endAnchor);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      onDelete();
    }
  };

  return (
    <g>
      {/* Invisible wider path for easier clicking */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        className="cursor-pointer"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      />
      {/* Visible connector path */}
      <path
        d={path}
        fill="none"
        stroke={isSelected ? '#3b82f6' : connector.strokeColor}
        strokeWidth={connector.strokeWidth}
        strokeDasharray={connector.strokeStyle === 'dashed' ? '8 4' : undefined}
        className="pointer-events-none transition-colors"
        strokeLinecap="round"
      />
      {/* Selection indicator dots */}
      {isSelected && (
        <>
          <circle
            cx={startPoint.x}
            cy={startPoint.y}
            r={6}
            fill="#3b82f6"
            className="pointer-events-none"
          />
          <circle
            cx={endPoint.x}
            cy={endPoint.y}
            r={6}
            fill="#3b82f6"
            className="pointer-events-none"
          />
          {/* Delete button at midpoint */}
          <g
            transform={`translate(${(startPoint.x + endPoint.x) / 2}, ${(startPoint.y + endPoint.y) / 2})`}
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

export const ConnectorLayer = memo(function ConnectorLayer({
  items,
  offset,
  selectedConnectorId,
  onSelectConnector,
  onDeleteConnector,
}: ConnectorLayerProps) {
  const { connectors, itemPositions } = useBoardConnectors(items);

  const handleBackgroundClick = useCallback(() => {
    onSelectConnector(null);
  }, [onSelectConnector]);

  if (connectors.length === 0) {
    return null;
  }

  return (
    <svg
      className="absolute inset-0 pointer-events-none overflow-visible"
      style={{ zIndex: 5 }}
    >
      <g 
        transform={`translate(${offset.x}, ${offset.y})`}
        className="pointer-events-auto"
        onClick={handleBackgroundClick}
      >
        {connectors.map((connector) => (
          <ConnectorPath
            key={connector.id}
            connector={connector}
            itemPositions={itemPositions}
            isSelected={selectedConnectorId === connector.id}
            onSelect={() => onSelectConnector(connector.id)}
            onDelete={() => onDeleteConnector(connector.id)}
          />
        ))}
      </g>
    </svg>
  );
});
