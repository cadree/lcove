import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BoardItem as BoardItemType } from "@/hooks/useBoardItems";
import { BoardItemNote } from "./BoardItemNote";
import { BoardItemTodo } from "./BoardItemTodo";
import { BoardItemLink } from "./BoardItemLink";
import { BoardItemImage } from "./BoardItemImage";
import { cn } from "@/lib/utils";
import { Json } from "@/integrations/supabase/types";

interface BoardItemProps {
  item: BoardItemType;
  isSelected: boolean;
  onSelect: () => void;
  onDragEnd: (x: number, y: number) => void;
  onResize: (w: number, h: number) => void;
  onContentChange: (content: Json) => void;
  onDelete: () => void;
}

export function BoardItem({
  item,
  isSelected,
  onSelect,
  onDragEnd,
  onResize,
  onContentChange,
  onDelete,
}: BoardItemProps) {
  const [isDragging, setIsDragging] = useState(false);
  const itemRef = useRef<HTMLDivElement>(null);

  const renderContent = () => {
    switch (item.type) {
      case 'note':
        return (
          <BoardItemNote
            content={item.content}
            onChange={onContentChange}
            isSelected={isSelected}
          />
        );
      case 'todo':
        return (
          <BoardItemTodo
            content={item.content}
            onChange={onContentChange}
          />
        );
      case 'link':
        return (
          <BoardItemLink
            content={item.content}
            onChange={onContentChange}
          />
        );
      case 'image':
        return (
          <BoardItemImage
            content={item.content}
            onChange={onContentChange}
          />
        );
      default:
        return (
          <div className="p-3 text-sm text-muted-foreground">
            Unknown item type
          </div>
        );
    }
  };

  return (
    <motion.div
      ref={itemRef}
      drag
      dragMomentum={false}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={(_, info) => {
        setIsDragging(false);
        onDragEnd(item.x + info.offset.x, item.y + info.offset.y);
      }}
      initial={{ x: item.x, y: item.y }}
      animate={{ x: item.x, y: item.y }}
      onClick={(e) => {
        e.stopPropagation();
        if (!isDragging) onSelect();
      }}
      className={cn(
        "absolute cursor-move",
        "bg-card border border-border rounded-lg shadow-md",
        "transition-shadow duration-200",
        isSelected && "ring-2 ring-primary shadow-lg",
        isDragging && "opacity-90 shadow-xl"
      )}
      style={{
        width: item.w,
        minHeight: item.h,
        zIndex: isSelected ? 1000 : item.z_index,
      }}
    >
      {/* Delete button - visible when selected */}
      {isSelected && (
        <Button
          variant="destructive"
          size="icon"
          className="absolute -top-2 -right-2 h-6 w-6 rounded-full z-10"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      )}

      {/* Item content */}
      {renderContent()}

      {/* Resize handle */}
      {isSelected && (
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
          onMouseDown={(e) => {
            e.stopPropagation();
            const startX = e.clientX;
            const startY = e.clientY;
            const startW = item.w;
            const startH = item.h;

            const handleMove = (moveEvent: MouseEvent) => {
              const newW = Math.max(100, startW + moveEvent.clientX - startX);
              const newH = Math.max(60, startH + moveEvent.clientY - startY);
              onResize(newW, newH);
            };

            const handleUp = () => {
              document.removeEventListener('mousemove', handleMove);
              document.removeEventListener('mouseup', handleUp);
            };

            document.addEventListener('mousemove', handleMove);
            document.addEventListener('mouseup', handleUp);
          }}
        >
          <div className="absolute bottom-1 right-1 w-2 h-2 border-r-2 border-b-2 border-primary rounded-br" />
        </div>
      )}
    </motion.div>
  );
}
