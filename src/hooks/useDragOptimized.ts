import { useRef, useCallback, useState } from "react";

interface Position {
  x: number;
  y: number;
}

interface UseDragOptimizedOptions {
  initialX: number;
  initialY: number;
  onDragEnd: (x: number, y: number) => void;
}

export function useDragOptimized({ initialX, initialY, onDragEnd }: UseDragOptimizedOptions) {
  const [isDragging, setIsDragging] = useState(false);
  const positionRef = useRef<Position>({ x: initialX, y: initialY });
  const elementRef = useRef<HTMLDivElement>(null);
  const startPosRef = useRef<Position>({ x: 0, y: 0 });
  const startMouseRef = useRef<Position>({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);

  // Update ref when props change (but don't trigger re-render)
  positionRef.current = { x: initialX, y: initialY };

  const updateVisualPosition = useCallback(() => {
    if (elementRef.current) {
      const { x, y } = positionRef.current;
      elementRef.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    }
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    
    e.stopPropagation();
    setIsDragging(true);
    
    startPosRef.current = { ...positionRef.current };
    startMouseRef.current = { x: e.clientX, y: e.clientY };

    if (elementRef.current) {
      elementRef.current.style.willChange = 'transform';
      elementRef.current.style.cursor = 'grabbing';
    }

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startMouseRef.current.x;
      const deltaY = moveEvent.clientY - startMouseRef.current.y;
      
      positionRef.current = {
        x: startPosRef.current.x + deltaX,
        y: startPosRef.current.y + deltaY,
      };

      // Use RAF for smooth visual updates
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = requestAnimationFrame(updateVisualPosition);

      // Dispatch custom event for connector updates
      window.dispatchEvent(new CustomEvent('board-item-drag', {
        detail: { moving: true }
      }));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      
      if (elementRef.current) {
        elementRef.current.style.willChange = '';
        elementRef.current.style.cursor = '';
      }

      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      // Only write to DB once on drag end
      onDragEnd(positionRef.current.x, positionRef.current.y);

      // Notify connectors to do final update
      window.dispatchEvent(new CustomEvent('board-item-drag', {
        detail: { moving: false }
      }));

      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [onDragEnd, updateVisualPosition]);

  return {
    elementRef,
    isDragging,
    handleMouseDown,
    currentPosition: positionRef.current,
  };
}
