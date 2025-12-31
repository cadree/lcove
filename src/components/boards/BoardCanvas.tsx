import { useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { BoardItem as BoardItemType } from "@/hooks/useBoardItems";
import { BoardItem } from "./BoardItem";
import { Json } from "@/integrations/supabase/types";

interface BoardCanvasProps {
  items: BoardItemType[];
  selectedItemId: string | null;
  onSelectItem: (id: string | null) => void;
  onUpdateItem: (id: string, updates: Partial<BoardItemType>) => void;
  onDeleteItem: (id: string) => void;
}

export function BoardCanvas({
  items,
  selectedItemId,
  onSelectItem,
  onUpdateItem,
  onDeleteItem,
}: BoardCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current) {
      onSelectItem(null);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current && e.button === 1) {
      setIsPanning(true);
      setStartPan({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    }
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setOffset({
        x: e.clientX - startPan.x,
        y: e.clientY - startPan.y,
      });
    }
  }, [isPanning, startPan]);

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleItemDragEnd = (id: string, x: number, y: number) => {
    onUpdateItem(id, { x, y });
  };

  const handleItemResize = (id: string, w: number, h: number) => {
    onUpdateItem(id, { w, h });
  };

  const handleContentChange = (id: string, content: Json) => {
    onUpdateItem(id, { content });
  };

  return (
    <div
      ref={canvasRef}
      className="absolute inset-0 overflow-hidden cursor-default"
      onClick={handleCanvasClick}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{
        backgroundImage: `
          radial-gradient(circle at 1px 1px, hsl(var(--border)) 1px, transparent 0)
        `,
        backgroundSize: '24px 24px',
        backgroundPosition: `${offset.x}px ${offset.y}px`,
      }}
    >
      <motion.div
        className="absolute inset-0"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px)`,
        }}
      >
        {items.map((item) => (
          <BoardItem
            key={item.id}
            item={item}
            isSelected={selectedItemId === item.id}
            onSelect={() => onSelectItem(item.id)}
            onDragEnd={(x, y) => handleItemDragEnd(item.id, x, y)}
            onResize={(w, h) => handleItemResize(item.id, w, h)}
            onContentChange={(content) => handleContentChange(item.id, content)}
            onDelete={() => onDeleteItem(item.id)}
          />
        ))}
      </motion.div>
    </div>
  );
}
