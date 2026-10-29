import { useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Check, X } from "lucide-react";
import { BackButton } from "@/components/navigation/BackButton";
import { BoardCanvas } from "@/components/boards/BoardCanvas";
import { BoardSidebar } from "@/components/boards/BoardSidebar";
import { DrawingLayer } from "@/components/boards/DrawingLayer";
import { useBoard, useBoards } from "@/hooks/useBoards";
import { useBoardItems, BoardItemType } from "@/hooks/useBoardItems";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Json } from "@/integrations/supabase/types";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const BoardEditor = () => {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: board, isLoading: boardLoading } = useBoard(boardId);
  const { updateBoard } = useBoards();
  const { items, isLoading: itemsLoading, createItem, updateItem, deleteItem, batchUpdatePositions } = useBoardItems(boardId);
  
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedConnectorId, setSelectedConnectorId] = useState<string | null>(null);
  
  // Connect mode state
  const [isConnectMode, setIsConnectMode] = useState(false);
  const [connectStartItemId, setConnectStartItemId] = useState<string | null>(null);
  
  // Draw mode state
  const [isDrawMode, setIsDrawMode] = useState(false);
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const [canvasScale, setCanvasScale] = useState(1);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteQuery, setInviteQuery] = useState("");
  const [inviteMatches, setInviteMatches] = useState<{ user_id: string; display_name: string | null }[]>([]);
  const positionTimer = useRef<number>();
  const pendingPositions = useRef<Map<string, { x: number; y: number }>>(new Map());

  const unsortedCount = items.filter((item) =>
    !item.parent_item_id && !["column", "connector", "line", "sketch"].includes(item.type)
  ).length;

  const queuePosition = (id: string, x: number, y: number) => {
    pendingPositions.current.set(id, { x, y });
    window.clearTimeout(positionTimer.current);
    positionTimer.current = window.setTimeout(() => {
      const updates = [...pendingPositions.current.entries()].map(([itemId, pos]) => ({
        id: itemId,
        x: pos.x,
        y: pos.y,
      }));
      pendingPositions.current.clear();
      if (updates.length) batchUpdatePositions.mutate(updates);
    }, 400);
  };

  const handleStroke = async (stroke: { points: { x: number; y: number }[]; color: string; width: number }) => {
    if (!boardId || stroke.points.length < 2) return;
    const xs = stroke.points.map((point) => point.x);
    const ys = stroke.points.map((point) => point.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const w = Math.max(8, Math.max(...xs) - minX);
    const h = Math.max(8, Math.max(...ys) - minY);
    await createItem.mutateAsync({
      board_id: boardId,
      type: "sketch",
      title: null,
      content: {
        points: stroke.points.map((point) => ({ x: point.x - minX, y: point.y - minY })),
        color: stroke.color,
        width: stroke.width,
      },
      x: minX,
      y: minY,
      w,
      h,
      rotation: 0,
      z_index: items.length,
      parent_item_id: null,
      created_by: user?.id || null,
    });
  };

  const searchCollaborators = async (value: string) => {
    setInviteQuery(value);
    if (value.trim().length < 2) {
      setInviteMatches([]);
      return;
    }
    const { data } = await supabase
      .from("profiles_public")
      .select("user_id, display_name")
      .ilike("display_name", `%${value.trim()}%`)
      .limit(8);
    setInviteMatches(data || []);
  };

  const inviteCollaborator = async (userId: string) => {
    if (!boardId) return;
    const { error } = await supabase.from("board_members").insert({
      board_id: boardId,
      user_id: userId,
      role: "editor",
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Collaborator added");
      setInviteOpen(false);
      setInviteQuery("");
      setInviteMatches([]);
    }
  };

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
            : type === 'board_ref'
              ? { title: 'Untitled board', board_id: null }
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

  const handleToggleDrawMode = useCallback(() => {
    setIsDrawMode(prev => !prev);
    if (!isDrawMode) {
      toast.info("Draw mode enabled. Draw on the canvas!");
    }
  }, [isDrawMode]);

  const handleExportPDF = useCallback(async () => {
    if (!canvasContainerRef.current) {
      toast.error("Canvas not ready");
      return;
    }

    toast.info("Generating PDF...");

    try {
      const canvas = await html2canvas(canvasContainerRef.current, {
        backgroundColor: '#3a3a3a',
        scale: 2,
        useCORS: true,
        allowTaint: true,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height],
      });

      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`${board?.title || 'board'}.pdf`);

      toast.success("PDF exported successfully!");
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error("Failed to export PDF");
    }
  }, [board?.title]);

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
        <BackButton showLabel label="Back" fallback="/boards" />
        <h2 className="font-display text-2xl text-foreground">Sign in to view this board</h2>
        <Button onClick={() => navigate("/auth")}>Sign in</Button>
      </div>
    );
  }

  if (boardLoading || itemsLoading) {
    return (
      <div className="relative min-h-screen bg-[#2a2a2a]">
        <div className="absolute left-3 top-3 z-10">
          <BackButton label="Back" fallback="/boards" className="text-white hover:bg-white/10" />
        </div>
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <h2 className="font-display text-2xl text-foreground">Board not found</h2>
        <BackButton showLabel label="Back" fallback="/boards" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#3a3a3a] flex">
      {/* Left Sidebar - Milanote style */}
      <BoardSidebar 
        onAddItem={handleAddItem} 
        isConnectMode={isConnectMode}
        isDrawMode={isDrawMode}
        onToggleDrawMode={handleToggleDrawMode}
        onExportPDF={handleExportPDF}
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
            <BackButton
              showLabel
              label="Back"
              fallback="/boards"
              className="text-white/70 hover:text-white hover:bg-white/10"
            />
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
            {isDrawMode && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsDrawMode(false)}
                className="text-white border-white/20 hover:bg-white/10"
              >
                <X className="w-3 h-3 mr-1" />
                Exit Draw
              </Button>
            )}
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
            <Button
              variant="outline"
              size="sm"
              className="text-white border-white/20 hover:bg-white/10"
              onClick={() => setInviteOpen(true)}
            >
              Invite
            </Button>
            <span className="text-white/50 text-sm">{unsortedCount} Unsorted</span>
          </div>
        </motion.header>

        {/* Canvas */}
        <div ref={canvasContainerRef} className="flex-1 relative overflow-hidden">
          <BoardCanvas
            items={items}
            selectedItemId={selectedItemId}
            selectedConnectorId={selectedConnectorId}
            isConnectMode={isConnectMode}
            connectStartItemId={connectStartItemId}
            onSelectItem={(id) => {
              setSelectedConnectorId(null);
              setSelectedItemId(id);
            }}
            onSelectConnector={setSelectedConnectorId}
            onUpdateItem={(id, updates) => {
              if (
                updates.x !== undefined &&
                updates.y !== undefined &&
                updates.w === undefined &&
                updates.h === undefined &&
                updates.content === undefined
              ) {
                queuePosition(id, updates.x, updates.y);
                return;
              }
              updateItem.mutate({ id, ...updates });
            }}
            onViewChange={({ offset, scale }) => {
              setCanvasOffset(offset);
              setCanvasScale(scale);
            }}
            onDeleteItem={(id) => deleteItem.mutate(id)}
            onDeleteConnector={handleDeleteConnector}
            onCreateItem={handleCreateItem}
            onItemClickForConnect={handleItemClickForConnect}
          />
          
          {/* Drawing Layer Overlay */}
          <DrawingLayer
            isActive={isDrawMode}
            offset={canvasOffset}
            scale={canvasScale}
            onClose={() => setIsDrawMode(false)}
            onStroke={(stroke) => { void handleStroke(stroke); }}
          />
        </div>
      </div>
      {inviteOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          style={{
            paddingTop: "max(1rem, env(safe-area-inset-top, 0px))",
            paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))",
          }}
        >
          <div className="bg-background rounded-lg p-4 w-full max-w-sm space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-medium">Invite by display name</h2>
              <Button size="icon" variant="ghost" onClick={() => setInviteOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Profiles have no username. Search matches display name.</p>
            <Input
              value={inviteQuery}
              onChange={(event) => { void searchCollaborators(event.target.value); }}
              placeholder="Display name"
            />
            <div className="space-y-1">
              {inviteMatches.map((match) => (
                <Button
                  key={match.user_id}
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => { void inviteCollaborator(match.user_id); }}
                >
                  {match.display_name || match.user_id}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BoardEditor;
