import { useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { BoardItem as BoardItemType, BoardItemType as ItemType } from "@/hooks/useBoardItems";
import { BoardItem } from "./BoardItem";
import { Json } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BoardCanvasProps {
  items: BoardItemType[];
  selectedItemId: string | null;
  onSelectItem: (id: string | null) => void;
  onUpdateItem: (id: string, updates: Partial<BoardItemType>) => void;
  onDeleteItem: (id: string) => void;
  onCreateItem?: (type: ItemType, content: Json, x: number, y: number) => void;
}

export function BoardCanvas({
  items,
  selectedItemId,
  onSelectItem,
  onUpdateItem,
  onDeleteItem,
  onCreateItem,
}: BoardCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });
  const [isDragOver, setIsDragOver] = useState(false);

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current || (e.target as HTMLElement).classList.contains('canvas-inner')) {
      onSelectItem(null);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Middle mouse button or right click for panning
    if ((e.target === canvasRef.current || (e.target as HTMLElement).classList.contains('canvas-inner')) && (e.button === 1 || e.button === 2)) {
      e.preventDefault();
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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    const mediaFiles = files.filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));

    if (mediaFiles.length === 0) {
      toast.error("Please drop image or video files");
      return;
    }

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || !onCreateItem) return;

    for (let i = 0; i < mediaFiles.length; i++) {
      const file = mediaFiles[i];
      const isVideo = file.type.startsWith('video/');
      
      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `board-media/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('board-uploads')
          .upload(filePath, file);

        if (uploadError) {
          if (uploadError.message.includes('Bucket not found')) {
            toast.error("Storage not configured. Please contact support.");
            return;
          }
          throw uploadError;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('board-uploads')
          .getPublicUrl(filePath);

        const dropX = e.clientX - rect.left - offset.x + (i * 20);
        const dropY = e.clientY - rect.top - offset.y + (i * 20);

        onCreateItem('image', {
          url: publicUrl,
          alt: file.name,
          mediaType: isVideo ? 'video' : 'image',
        }, dropX, dropY);

        toast.success(`${isVideo ? 'Video' : 'Image'} added to board`);
      } catch (error) {
        console.error('Upload error:', error);
        toast.error(`Failed to upload ${file.name}`);
      }
    }
  };

  return (
    <div
      ref={canvasRef}
      className={`absolute inset-0 overflow-hidden cursor-default bg-[#3a3a3a] transition-colors ${
        isDragOver ? 'bg-primary/10 ring-2 ring-primary ring-inset' : ''
      }`}
      onClick={handleCanvasClick}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onContextMenu={(e) => e.preventDefault()}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)`,
        backgroundSize: '20px 20px',
        backgroundPosition: `${offset.x}px ${offset.y}px`,
      }}
    >
      <motion.div
        className="canvas-inner absolute inset-0"
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
