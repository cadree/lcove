import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowLeft, Check, X } from "lucide-react";
import { BoardCanvas } from "@/components/boards/BoardCanvas";
import { BoardToolbar } from "@/components/boards/BoardToolbar";
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
    const centerX = 100 + Math.random() * 200;
    const centerY = 100 + Math.random() * 200;
    
    const defaultContent = type === 'note' 
      ? { text: 'New note' }
      : type === 'todo' 
        ? { items: [{ text: '', done: false }] }
        : type === 'link'
          ? { url: '', title: '' }
          : {};

    await createItem.mutateAsync({
      board_id: boardId,
      type,
      title: null,
      content: defaultContent,
      x: centerX,
      y: centerY,
      w: type === 'note' ? 240 : type === 'todo' ? 280 : 200,
      h: type === 'note' ? 160 : type === 'todo' ? 200 : 120,
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
      <div className="min-h-screen flex items-center justify-center bg-background">
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
    <div className="min-h-screen bg-muted/30 flex flex-col">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="h-14 border-b border-border bg-background/80 backdrop-blur-sm flex items-center justify-between px-4 z-50"
      >
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/boards")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          
          {isEditingTitle ? (
            <div className="flex items-center gap-2">
              <Input
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                className="h-8 w-48"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleTitleSave();
                  if (e.key === 'Escape') setIsEditingTitle(false);
                }}
              />
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleTitleSave}>
                <Check className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setIsEditingTitle(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <h1 
              className="font-display text-lg font-medium cursor-pointer hover:text-primary transition-colors"
              onClick={handleTitleEdit}
            >
              {board.title}
            </h1>
          )}
        </div>

        <BoardToolbar onAddItem={handleAddItem} />
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
  );
};

export default BoardEditor;
