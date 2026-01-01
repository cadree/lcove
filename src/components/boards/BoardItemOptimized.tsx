import { memo, useRef, useEffect, useCallback } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BoardItem as BoardItemType } from "@/hooks/useBoardItems";
import { BoardItemNote } from "./BoardItemNote";
import { BoardItemTodo } from "./BoardItemTodo";
import { BoardItemLink } from "./BoardItemLink";
import { BoardItemImage } from "./BoardItemImage";
import { BoardItemLine } from "./BoardItemLine";
import { cn } from "@/lib/utils";
import { Json } from "@/integrations/supabase/types";
import { useDragOptimized } from "@/hooks/useDragOptimized";

interface BoardItemProps {
  item: BoardItemType;
  isSelected: boolean;
  isConnectMode?: boolean;
  isConnectStart?: boolean;
  onSelect: () => void;
  onDragEnd: (x: number, y: number) => void;
  onResize: (w: number, h: number) => void;
  onContentChange: (content: Json) => void;
  onDelete: () => void;
}

const BoardItemOptimized = memo(function BoardItemOptimized({
  item,
  isSelected,
  isConnectMode,
  isConnectStart,
  onSelect,
  onDragEnd,
  onResize,
  onContentChange,
  onDelete,
}: BoardItemProps) {
  const { elementRef, isDragging, handleMouseDown } = useDragOptimized({
    initialX: item.x,
    initialY: item.y,
    onDragEnd,
  });

  // Sync position when item.x/y changes from DB
  useEffect(() => {
    if (elementRef.current && !isDragging) {
      elementRef.current.style.transform = `translate3d(${item.x}px, ${item.y}px, 0)`;
    }
  }, [item.x, item.y, isDragging]);

  const getItemStyles = useCallback(() => {
    switch (item.type) {
      case 'note':
        return "bg-[#fef3c7]"; // Yellow sticky note
      case 'todo':
        return "bg-white";
      case 'link':
        return "bg-white";
      case 'image':
        return "bg-[#1a1a1a] overflow-hidden";
      case 'line':
        return "bg-transparent";
      case 'column':
        return "bg-white/5 border border-dashed border-white/20";
      case 'board_ref':
        return "bg-[#f5f4f3]";
      default:
        return "bg-white";
    }
  }, [item.type]);

  const renderContent = useCallback(() => {
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
      case 'line':
        return (
          <BoardItemLine
            content={item.content}
            onChange={onContentChange}
          />
        );
      case 'board_ref':
        return (
          <div className="p-4 flex flex-col items-center justify-center h-full">
            <div className="w-16 h-16 bg-[#e7e5e4] rounded-lg flex items-center justify-center mb-2">
              <div className="grid grid-cols-2 gap-1">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="w-4 h-4 bg-[#a8a29e] rounded-sm" />
                ))}
              </div>
            </div>
            <span className="text-sm font-medium text-[#44403c]">New Board</span>
            <span className="text-xs text-[#78716c]">0 cards</span>
          </div>
        );
      case 'column':
        return (
          <div className="p-4 h-full">
            <input 
              type="text" 
              placeholder="Column title..."
              className="bg-transparent border-none text-white text-sm font-medium w-full outline-none placeholder:text-white/40"
            />
          </div>
        );
      default:
        return (
          <div className="p-3 text-sm text-gray-500">
            Unknown item type
          </div>
        );
    }
  }, [item.type, item.content, isSelected, onContentChange]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isDragging) onSelect();
  }, [isDragging, onSelect]);

  const handleDeleteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  }, [onDelete]);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
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
  }, [item.w, item.h, onResize]);

  return (
    <div
      ref={elementRef}
      data-item-id={item.id}
      onMouseDown={isConnectMode ? undefined : handleMouseDown}
      onClick={handleClick}
      className={cn(
        "absolute rounded-lg",
        // Remove shadow during drag for performance
        isDragging ? "" : "shadow-lg",
        isConnectMode ? "cursor-crosshair" : "cursor-grab",
        getItemStyles(),
        isSelected && "ring-2 ring-primary",
        isConnectStart && "ring-2 ring-green-500 ring-offset-2 ring-offset-[#3a3a3a]",
        isConnectMode && !isConnectStart && "hover:ring-2 hover:ring-blue-400",
        isDragging && "opacity-90 z-[9999]"
      )}
      style={{
        width: item.w,
        minHeight: item.h,
        zIndex: isDragging ? 9999 : isSelected ? 1000 : item.z_index,
        transform: `translate3d(${item.x}px, ${item.y}px, 0)`,
        // GPU acceleration hints
        backfaceVisibility: 'hidden',
      }}
    >
      {/* Delete button - visible when selected */}
      {isSelected && (
        <Button
          variant="destructive"
          size="icon"
          className="absolute -top-2 -right-2 h-6 w-6 rounded-full z-10"
          onClick={handleDeleteClick}
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
          onMouseDown={handleResizeMouseDown}
        >
          <div className="absolute bottom-1 right-1 w-2 h-2 border-r-2 border-b-2 border-primary rounded-br" />
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for better memoization
  return (
    prevProps.item.id === nextProps.item.id &&
    prevProps.item.x === nextProps.item.x &&
    prevProps.item.y === nextProps.item.y &&
    prevProps.item.w === nextProps.item.w &&
    prevProps.item.h === nextProps.item.h &&
    prevProps.item.rotation === nextProps.item.rotation &&
    prevProps.item.content === nextProps.item.content &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isConnectMode === nextProps.isConnectMode &&
    prevProps.isConnectStart === nextProps.isConnectStart
  );
});

export { BoardItemOptimized };
