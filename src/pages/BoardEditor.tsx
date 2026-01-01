import { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowLeft, Check, X, Home } from "lucide-react";
import { BoardCanvas } from "@/components/boards/BoardCanvas";
import { BoardSidebar } from "@/components/boards/BoardSidebar";
import { useBoard, useBoards } from "@/hooks/useBoards";
import { useBoardItems, BoardItemType } from "@/hooks/useBoardItems";
import { useAuth } from "@/contexts/AuthContext";
import { Json } from "@/integrations/supabase/types";
import { toast } from "sonner";

const BoardEditor = () => {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: board, isLoading: boardLoading } = useBoard(boardId);
  const { updateBoard } = useBoards();
  const { items, isLoading: itemsLoading, createItem, updateItem, deleteItem } = useBoardItems(boardId);
  
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedConnectorId, setSelectedConnectorId] = useState<string | null>(null);
  
  // Connect mode state
  const [isConnectMode, setIsConnectMode] = useState(false);
  const [connectStartItemId, setConnectStartItemId] = useState<string | null>(null);

  const handleAddItem = async (type: BoardItemType, customContent?: Json, customX?: number, customY?: number) => {
    if (!boardId) return;
    
    // If clicking Line tool, enter connect mode instead of creating an item
    if (type === 'line' || type === 'connector') {
      setIsConnectMode(true);
      setConnectStartItemId(null);
      toast.info("Connect mode: Click a card to start, then click another card to connect");
      return;
    }
    
    // Calculate center position based on viewport
    const centerX = customX ?? 100 + Math.random() * 400;
    const centerY = customY ?? 100 + Math.random() * 300;
    
    const defaultContent = customContent ?? (
      type === 'note' 
        ? { text: '' }
        : type === 'todo' 
          ? { items: [{ text: '', done: false }] }
          : type === 'link'
            ? { url: '', title: '' }
            : {}
    );

    const dimensions: Record<string, { w: number; h: number }> = {
      note: { w: 200, h: 180 },
      todo: { w: 240, h: 200 },
      link: { w: 200, h: 100 },
      image: { w: 240, h: 200 },
      column: { w: 280, h: 400 },
      board_ref: { w: 160, h: 140 },
    };

    const size = dimensions[type] || { w: 200, h: 160 };

    await createItem.mutateAsync({
      board_id: boardId,
      type,
      title: null,
      content: defaultContent,
      x: centerX,
      y: centerY,
      w: size.w,
      h: size.h,
      rotation: 0,
      z_index: items.length,
      parent_item_id: null,
      created_by: user?.id || null,
    });
  };

  const handleCreateItem = (type: BoardItemType, content: Json, x: number, y: number) => {
    handleAddItem(type, content, x, y);
  };

  // Handle item click in connect mode
  const handleItemClickForConnect = useCallback(async (itemId: string) => {
    if (!isConnectMode || !boardId) return false;

    // Don't allow connecting to connectors
    const clickedItem = items.find(i => i.id === itemId);
    if (clickedItem?.type === 'connector' || clickedItem?.type === 'line') {
      return false;
    }

    if (!connectStartItemId) {
      // First click - set start item
      setConnectStartItemId(itemId);
      toast.info("Now click another card to complete the connection");
      return true;
    } else if (connectStartItemId !== itemId) {
      // Second click - create connector
      try {
        await createItem.mutateAsync({
          board_id: boardId,
          type: 'connector',
          title: null,
          content: {},
          x: 0,
          y: 0,
          w: 0,
          h: 0,
          rotation: 0,
          z_index: items.length,
          parent_item_id: null,
          created_by: user?.id || null,
          start_item_id: connectStartItemId,
          end_item_id: itemId,
          start_anchor: 'right',
          end_anchor: 'left',
          stroke_width: 2,
          stroke_style: 'solid',
          stroke_color: '#ffffff',
        });
        toast.success("Connection created!");
      } catch (error) {
        console.error('Failed to create connector:', error);
        toast.error("Failed to create connection");
      }
      
      // Exit connect mode
      setIsConnectMode(false);
      setConnectStartItemId(null);
      return true;
    }
    return false;
  }, [isConnectMode, connectStartItemId, boardId, items, createItem, user?.id]);

  const handleCancelConnectMode = useCallback(() => {
    setIsConnectMode(false);
    setConnectStartItemId(null);
  }, []);

  const handleDeleteConnector = useCallback((id: string) => {
    deleteItem.mutate(id);
    setSelectedConnectorId(null);
  }, [deleteItem]);

  const handleTitleSave = () => {
    if (!boardId || !editedTitle.trim()) {
      setIsEditingTitle(false);
      return;
    }
    updateBoard.mutate({ id: boardId, title: editedTitle.trim() });
    setIsEditingTitle(false);
  };

  const handleTitleEdit = () => {
    setEditedTitle(board?.title || "");
    setIsEditingTitle(true);
  };

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <h2 className="font-display text-2xl text-foreground">Sign in to view this board</h2>
        <Button onClick={() => navigate("/auth")}>Sign In</Button>
      </div>
    );
  }

  if (boardLoading || itemsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#2a2a2a]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!board) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <h2 className="font-display text-2xl text-foreground">Board not found</h2>
        <Button onClick={() => navigate("/boards")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Boards
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#3a3a3a] flex">
      {/* Left Sidebar - Milanote style */}
      <BoardSidebar 
        onAddItem={handleAddItem} 
        isConnectMode={isConnectMode}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="h-12 bg-[#2a2a2a] border-b border-white/10 flex items-center justify-between px-4 z-50"
        >
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate("/boards")}
              className="text-white/70 hover:text-white hover:bg-white/10"
            >
              <Home className="w-4 h-4 mr-2" />
              Home
            </Button>
            <span className="text-white/30">/</span>
            
            {isEditingTitle ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  className="h-7 w-48 bg-white/10 border-white/20 text-white"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleTitleSave();
                    if (e.key === 'Escape') setIsEditingTitle(false);
                  }}
                />
                <Button size="icon" variant="ghost" className="h-7 w-7 text-white/70 hover:text-white" onClick={handleTitleSave}>
                  <Check className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-white/70 hover:text-white" onClick={() => setIsEditingTitle(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <button 
                className="text-white font-medium hover:text-primary transition-colors"
                onClick={handleTitleEdit}
              >
                {board.title}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isConnectMode && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelConnectMode}
                className="text-white border-white/20 hover:bg-white/10"
              >
                <X className="w-3 h-3 mr-1" />
                Cancel Connect
              </Button>
            )}
            <span className="text-white/50 text-sm">0 Unsorted</span>
          </div>
        </motion.header>

        {/* Canvas */}
        <div className="flex-1 relative overflow-hidden">
          <BoardCanvas
            items={items}
            selectedItemId={selectedItemId}
            selectedConnectorId={selectedConnectorId}
            isConnectMode={isConnectMode}
            connectStartItemId={connectStartItemId}
            onSelectItem={(id) => {
              // Clear connector selection when selecting an item
              setSelectedConnectorId(null);
              setSelectedItemId(id);
            }}
            onSelectConnector={setSelectedConnectorId}
            onUpdateItem={(id, updates) => updateItem.mutate({ id, ...updates })}
            onDeleteItem={(id) => deleteItem.mutate(id)}
            onDeleteConnector={handleDeleteConnector}
            onCreateItem={handleCreateItem}
            onItemClickForConnect={handleItemClickForConnect}
          />
        </div>
      </div>
    </div>
  );
};

export default BoardEditor;
