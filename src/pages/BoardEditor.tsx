import { useState } from "react";
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

  const handleAddItem = async (type: BoardItemType) => {
    if (!boardId) return;
    
    // Calculate center position based on viewport
    const centerX = 100 + Math.random() * 400;
    const centerY = 100 + Math.random() * 300;
    
    const defaultContent = type === 'note' 
      ? { text: '' }
      : type === 'todo' 
        ? { items: [{ text: '', done: false }] }
        : type === 'link'
          ? { url: '', title: '' }
          : {};

    const dimensions = {
      note: { w: 200, h: 180 },
      todo: { w: 240, h: 200 },
      link: { w: 200, h: 100 },
      image: { w: 240, h: 200 },
      line: { w: 100, h: 2 },
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
      <BoardSidebar onAddItem={handleAddItem} />

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

          <div className="flex items-center gap-2 text-white/50 text-sm">
            <span>0 Unsorted</span>
          </div>
        </motion.header>

        {/* Canvas */}
        <div className="flex-1 relative overflow-hidden">
          <BoardCanvas
            items={items}
            selectedItemId={selectedItemId}
            onSelectItem={setSelectedItemId}
            onUpdateItem={(id, updates) => updateItem.mutate({ id, ...updates })}
            onDeleteItem={(id) => deleteItem.mutate(id)}
          />
        </div>
      </div>
    </div>
  );
};

export default BoardEditor;
