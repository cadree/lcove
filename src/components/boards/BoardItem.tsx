import { memo, useRef, useEffect, useCallback, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BoardItemNote } from "./BoardItemNote";
import { BoardItemTodo } from "./BoardItemTodo";
import { BoardItemLink } from "./BoardItemLink";
import { BoardItemImage } from "./BoardItemImage";
import { BoardItemLine } from "./BoardItemLine";
import { cn } from "@/lib/utils";
import { Json } from "@/integrations/supabase/types";

interface BoardItemData {
  id: string;
  board_id: string;
  type: string;
  title: string | null;
  content: Json;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  z_index: number;
  parent_item_id: string | null;
  is_trashed: boolean;
  created_by: string | null;
  start_item_id?: string | null;
  end_item_id?: string | null;
  start_anchor?: string | null;
  end_anchor?: string | null;
  stroke_width?: number;
  stroke_style?: string;
  stroke_color?: string;
}

interface BoardItemProps {
  item: BoardItemData;
  isSelected: boolean;
  isConnectMode?: boolean;
  isConnectStart?: boolean;
  onSelect: () => void;
  onDragEnd: (x: number, y: number) => void;
  onResize: (w: number, h: number) => void;
  onContentChange: (content: Json) => void;
  onDelete: () => void;
}

export const BoardItem = memo(function BoardItem({
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
  const elementRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const [isDraggingState, setIsDraggingState] = useState(false);
  const positionRef = useRef({ x: item.x, y: item.y });
  const startPosRef = useRef({ x: 0, y: 0 });
  const startMouseRef = useRef({ x: 0, y: 0 });
  const hasDraggedRef = useRef(false);

  // Sync position from props only when not dragging
  useEffect(() => {
    if (!isDraggingRef.current) {
      positionRef.current = { x: item.x, y: item.y };
    }
  }, [item.x, item.y]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Allow clicks on interactive elements inside the card
    const target = e.target as HTMLElement;
    const isInteractive = target.tagName === 'INPUT' || 
                          target.tagName === 'TEXTAREA' || 
                          target.tagName === 'BUTTON' ||
                          target.closest('button') ||
                          target.closest('input') ||
                          target.closest('textarea');
    
    if (e.button !== 0 || isConnectMode || isInteractive) return;
    
    e.stopPropagation();
    e.preventDefault();
    
    isDraggingRef.current = true;
    hasDraggedRef.current = false;
    setIsDraggingState(true);
    
    startPosRef.current = { x: positionRef.current.x, y: positionRef.current.y };
    startMouseRef.current = { x: e.clientX, y: e.clientY };
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      
      hasDraggedRef.current = true;
      
      const deltaX = moveEvent.clientX - startMouseRef.current.x;
      const deltaY = moveEvent.clientY - startMouseRef.current.y;
      
      const newX = startPosRef.current.x + deltaX;
      const newY = startPosRef.current.y + deltaY;
      
      positionRef.current = { x: newX, y: newY };

      if (elementRef.current) {
        elementRef.current.style.transform = `translate3d(${newX}px, ${newY}px, 0)`;
      }

      window.dispatchEvent(new CustomEvent('board-item-drag', { detail: { moving: true } }));
    };

    const handleMouseUp = () => {
      if (!isDraggingRef.current) return;
      
      isDraggingRef.current = false;
      setIsDraggingState(false);

      // Only save to DB if we actually moved
      if (hasDraggedRef.current) {
        const finalX = positionRef.current.x;
        const finalY = positionRef.current.y;
        
        // Ensure the visual position stays locked during DB update
        if (elementRef.current) {
          elementRef.current.style.transform = `translate3d(${finalX}px, ${finalY}px, 0)`;
        }
        
        onDragEnd(finalX, finalY);
      }

      window.dispatchEvent(new CustomEvent('board-item-drag', { detail: { moving: false } }));

      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [isConnectMode, onDragEnd]);

  const getItemStyles = useCallback(() => {
    switch (item.type) {
      case 'note':
        return "bg-[#fef3c7]";
      case 'todo':
        return "bg-white";
      case 'link':
        return "bg-white";
      case 'image':
        return "bg-transparent overflow-hidden";
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
            isSelected={isSelected}
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
    // Always call onSelect - in connect mode, the parent handles the logic
    if (!hasDraggedRef.current || isConnectMode) {
      onSelect();
    }
  }, [onSelect, isConnectMode]);

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
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      className={cn(
        "absolute rounded-lg",
        isDraggingState ? "" : "shadow-lg",
        isConnectMode ? "cursor-crosshair" : "cursor-grab",
        getItemStyles(),
        isSelected && "ring-2 ring-primary",
        isConnectStart && "ring-2 ring-green-500 ring-offset-2 ring-offset-[#3a3a3a]",
        isConnectMode && !isConnectStart && "hover:ring-2 hover:ring-blue-400",
        isDraggingState && "opacity-90 z-[9999]"
      )}
      style={{
        width: item.w,
        minHeight: item.h,
        zIndex: isDraggingState ? 9999 : isSelected ? 1000 : item.z_index,
        transform: `translate3d(${positionRef.current.x}px, ${positionRef.current.y}px, 0)`,
        backfaceVisibility: 'hidden',
      }}
    >
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

      {renderContent()}

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
