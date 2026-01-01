import { useRef, useState, useCallback, memo } from "react";
import { BoardItem } from "./BoardItem";
import { ConnectorLayer } from "./ConnectorLayer";
import { Json } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type ItemType = 'note' | 'todo' | 'link' | 'image' | 'column' | 'board_ref' | 'line' | 'connector';

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

interface BoardCanvasProps {
  items: BoardItemData[];
  selectedItemId: string | null;
  selectedConnectorId: string | null;
  isConnectMode: boolean;
  connectStartItemId: string | null;
  onSelectItem: (id: string | null) => void;
  onSelectConnector: (id: string | null) => void;
  onUpdateItem: (id: string, updates: { x?: number; y?: number; w?: number; h?: number; content?: Json }) => void;
  onDeleteItem: (id: string) => void;
  onDeleteConnector: (id: string) => void;
  onCreateItem?: (type: ItemType, content: Json, x: number, y: number) => void;
  onItemClickForConnect?: (itemId: string) => Promise<boolean>;
}

export const BoardCanvas = memo(function BoardCanvas({
  items,
  selectedItemId,
  selectedConnectorId,
  isConnectMode,
  connectStartItemId,
  onSelectItem,
  onSelectConnector,
  onUpdateItem,
  onDeleteItem,
  onDeleteConnector,
  onCreateItem,
  onItemClickForConnect,
}: BoardCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const startPanRef = useRef({ x: 0, y: 0 });
  const [isDragOver, setIsDragOver] = useState(false);

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (e.target === canvasRef.current || (e.target as HTMLElement).classList.contains('canvas-inner')) {
      onSelectItem(null);
      onSelectConnector(null);
    }
  }, [onSelectItem, onSelectConnector]);

  const handleItemSelect = useCallback(async (itemId: string) => {
    if (isConnectMode && onItemClickForConnect) {
      const handled = await onItemClickForConnect(itemId);
      if (handled) return;
    }
    onSelectConnector(null);
    onSelectItem(itemId);
  }, [isConnectMode, onItemClickForConnect, onSelectItem, onSelectConnector]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target === canvasRef.current || (e.target as HTMLElement).classList.contains('canvas-inner')) && (e.button === 1 || e.button === 2)) {
      e.preventDefault();
      setIsPanning(true);
      startPanRef.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
    }
  }, [offset]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      const newOffset = {
        x: e.clientX - startPanRef.current.x,
        y: e.clientY - startPanRef.current.y,
      };
      setOffset(newOffset);
    }
  }, [isPanning]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Touch handlers for mobile canvas panning (two-finger pan)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Two-finger touch for panning
    if (e.touches.length === 2) {
      e.preventDefault();
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      setIsPanning(true);
      startPanRef.current = { x: midX - offset.x, y: midY - offset.y };
      touchStartRef.current = { x: midX, y: midY };
    }
  }, [offset]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (isPanning && e.touches.length === 2) {
      e.preventDefault();
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const newOffset = {
        x: midX - startPanRef.current.x,
        y: midY - startPanRef.current.y,
      };
      setOffset(newOffset);
    }
  }, [isPanning]);

  const handleTouchEnd = useCallback(() => {
    setIsPanning(false);
    touchStartRef.current = null;
  }, []);

  const handleItemDragEnd = useCallback((id: string, x: number, y: number) => {
    onUpdateItem(id, { x, y });
  }, [onUpdateItem]);

  const handleItemResize = useCallback((id: string, w: number, h: number) => {
    onUpdateItem(id, { w, h });
  }, [onUpdateItem]);

  const handleContentChange = useCallback((id: string, content: Json) => {
    onUpdateItem(id, { content });
  }, [onUpdateItem]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
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
  }, [offset, onCreateItem]);

  const nonConnectorItems = items.filter(item => item.type !== 'connector');

  return (
    <div
      ref={canvasRef}
      className={`absolute inset-0 overflow-hidden transition-colors touch-none ${
        isDragOver ? 'bg-primary/10 ring-2 ring-primary ring-inset' : ''
      } ${isConnectMode ? 'cursor-crosshair' : 'cursor-default'}`}
      onClick={handleCanvasClick}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onContextMenu={(e) => e.preventDefault()}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)`,
        backgroundSize: '20px 20px',
        backgroundPosition: `${offset.x}px ${offset.y}px`,
        backgroundColor: '#3a3a3a',
      }}
    >
      <ConnectorLayer
        items={items}
        offset={offset}
        selectedConnectorId={selectedConnectorId}
        onSelectConnector={onSelectConnector}
        onDeleteConnector={onDeleteConnector}
      />

      <div
        className="canvas-inner absolute inset-0"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px)`,
        }}
      >
        {nonConnectorItems.map((item) => (
          <BoardItem
            key={item.id}
            item={item}
            isSelected={selectedItemId === item.id}
            isConnectMode={isConnectMode}
            isConnectStart={connectStartItemId === item.id}
            onSelect={() => handleItemSelect(item.id)}
            onDragEnd={(x, y) => handleItemDragEnd(item.id, x, y)}
            onResize={(w, h) => handleItemResize(item.id, w, h)}
            onContentChange={(content) => handleContentChange(item.id, content)}
            onDelete={() => onDeleteItem(item.id)}
          />
        ))}
      </div>
    </div>
  );
});
