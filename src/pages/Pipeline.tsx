import { useState, useEffect, useRef, type CSSProperties } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { Capacitor } from "@capacitor/core";
import { useIsMobile } from "@/hooks/use-mobile";
import { dropStage, endOfStage, MOUSE_DRAG_DISTANCE_PX, TOUCH_HOLD_MS, TOUCH_TOLERANCE_PX } from "@/lib/pipelineDrag";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Users, Plus, Search, UserPlus, GripVertical, Pencil, Check, X, Sun } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BackButton } from "@/components/navigation/BackButton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import PageLayout from "@/components/layout/PageLayout";
import { usePipeline } from "@/hooks/usePipeline";
import { usePipelines, Pipeline as PipelineType } from "@/hooks/usePipelines";
import { PipelineItemDrawer } from "@/components/pipeline/PipelineItemDrawer";
import { AddContactDialog, ContactFormData } from "@/components/pipeline/AddContactDialog";
import { PipelineSelector } from "@/components/pipeline/PipelineSelector";
import { PipelineItem, PipelineStage } from "@/actions/pipelineActions";
import { EnergyIndicator } from "@/components/energy";
import { toast } from "sonner";

const PipelinePage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { pipelines, isLoading: pipelinesLoading } = usePipelines();
  const [currentPipeline, setCurrentPipeline] = useState<PipelineType | null>(null);

  // Set initial pipeline
  useEffect(() => {
    if (pipelines.length > 0 && !currentPipeline) {
      setCurrentPipeline(pipelines[0]);
    }
  }, [pipelines, currentPipeline]);

  const { stages, items, isLoading, error, getItemsByStage, getEventsForItem, createItem, updateItem, moveItem, deleteItem, updateStageName, isCreating, isMoving } = usePipeline(currentPipeline?.id);
  const [selectedItem, setSelectedItem] = useState<PipelineItem | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addToStageId, setAddToStageId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [editingStageName, setEditingStageName] = useState("");

  // Handle openContact query param
  useEffect(() => {
    const openContactId = searchParams.get('openContact');
    if (openContactId && items.length > 0) {
      const item = items.find(i => i.id === openContactId);
      if (item) {
        setSelectedItem(item);
        // Clear the query param
        searchParams.delete('openContact');
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [searchParams, items, setSearchParams]);

  // Filter items by search
  const filterItems = (stageItems: PipelineItem[]) => {
    if (!searchQuery.trim()) return stageItems;
    const query = searchQuery.toLowerCase();
    return stageItems.filter(
      item => item.name.toLowerCase().includes(query) ||
              item.company?.toLowerCase().includes(query) ||
              item.email?.toLowerCase().includes(query)
    );
  };

  const handleCreateContact = async (data: ContactFormData) => {
    const stageId = addToStageId || stages[0]?.id;
    if (!stageId) return;

    try {
      await createItem({
        stageId,
        name: data.name,
        email: data.email,
        phone: data.phone,
        company: data.company,
        role: data.role,
        instagramUrl: data.instagramUrl,
        twitterUrl: data.twitterUrl,
        linkedinUrl: data.linkedinUrl,
        tiktokUrl: data.tiktokUrl,
        websiteUrl: data.websiteUrl,
        notes: data.notes,
        priority: data.priority,
        avatarUrl: data.avatarUrl,
        linkedUserId: data.linkedUserId
      });
      setShowAddDialog(false);
      setAddToStageId(null);
      toast.success("Contact added to pipeline");
    } catch (err) {
      toast.error("Failed to add contact");
    }
  };

  const openAddDialog = (stageId?: string) => {
    setAddToStageId(stageId || null);
    setShowAddDialog(true);
  };

  const handleUpdateItem = async (itemId: string, fields: Partial<PipelineItem>) => {
    try {
      await updateItem({ itemId, fields });
      if (selectedItem && selectedItem.id === itemId) {
        setSelectedItem({ ...selectedItem, ...fields });
      }
    } catch (err) {
      toast.error("Failed to update contact");
      throw err;
    }
  };

  const handleMoveItem = async (itemId: string, toStageId: string) => {
    const newSortOrder = endOfStage(items, toStageId);

    try {
      await moveItem({ itemId, toStageId, newSortOrder });
      if (selectedItem && selectedItem.id === itemId) {
        setSelectedItem({ ...selectedItem, stage_id: toStageId, sort_order: newSortOrder });
      }
    } catch (err) {
      toast.error("Failed to move contact");
      throw err;
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      await deleteItem(itemId);
      setSelectedItem(null);
    } catch (err) {
      toast.error("Failed to delete contact");
      throw err;
    }
  };

  // Stage name editing handlers
  const handleStartEditStageName = (stageId: string, currentName: string) => {
    setEditingStageId(stageId);
    setEditingStageName(currentName);
  };

  const handleSaveStageName = async () => {
    if (!editingStageId || !editingStageName.trim()) {
      setEditingStageId(null);
      return;
    }

    try {
      await updateStageName({ stageId: editingStageId, name: editingStageName.trim() });
      toast.success("Stage renamed");
    } catch (err) {
      toast.error("Failed to rename stage");
    } finally {
      setEditingStageId(null);
      setEditingStageName("");
    }
  };

  const handleCancelEditStageName = () => {
    setEditingStageId(null);
    setEditingStageName("");
  };

  // Press-and-hold on phones, a short drag with a mouse, arrow keys from the keyboard.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: MOUSE_DRAG_DISTANCE_PX } }),
    useSensor(TouchSensor, { activationConstraint: { delay: TOUCH_HOLD_MS, tolerance: TOUCH_TOLERANCE_PX } }),
    // Space picks a card up so Enter can keep opening it.
    useSensor(KeyboardSensor, { keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter'] } }),
  );

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id));
    if (Capacitor.isNativePlatform()) void Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
    else navigator.vibrate?.(10);
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    const itemId = String(active.id);
    const toStageId = dropStage(itemId, over ? String(over.id) : null, items, stages.map((stage) => stage.id));
    if (!toStageId) return;
    const stageName = stages.find((stage) => stage.id === toStageId)?.name;
    void handleMoveItem(itemId, toStageId).then(
      () => toast.success(stageName ? `Moved to ${stageName}` : "Contact moved"),
      () => undefined,
    );
  };

  const activeItem = activeId ? items.find((item) => item.id === activeId) ?? null : null;

  const totalContacts = items.length;

  return (
    <PageLayout>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="safe-header sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border/50">
          <div className="flex flex-wrap items-center gap-2 px-4 py-3">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <BackButton className="shrink-0" />
              <div className="flex min-w-0 items-center gap-2">
                <Users className="w-5 h-5 shrink-0 text-primary" />
                <div className="min-w-0">
                  <PipelineSelector
                    currentPipeline={currentPipeline}
                    onPipelineChange={setCurrentPipeline}
                  />
                </div>
                <span className="shrink-0 text-sm text-muted-foreground">({totalContacts})</span>
              </div>
            </div>

            {/* Search */}
            <div className="hidden sm:flex items-center gap-2 flex-1 max-w-md mx-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search contacts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-muted/30 border-border/50"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex w-full shrink-0 items-center justify-end gap-2 sm:ml-auto sm:w-auto">
              <EnergyIndicator />
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => navigate('/today')}
              >
                <Sun className="w-4 h-4 text-amber-500" />
                <span className="hidden sm:inline">My Day</span>
              </Button>
              <Button
                variant="default"
                size="sm"
                className="gap-2"
                onClick={() => openAddDialog()}
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Add Contact</span>
              </Button>
            </div>
          </div>

          {/* Mobile search */}
          <div className="sm:hidden px-4 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search contacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-muted/30 border-border/50"
              />
            </div>
          </div>
        </div>

        {/* Pipeline Board */}
        <div className="p-4">
          {isLoading ? (
            <PipelineSkeleton />
          ) : error ? (
            <Card className="bg-muted/30 border-border/50 p-8 text-center">
              <p className="text-muted-foreground text-sm mb-3">Unable to load your pipeline</p>
              <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                Try Again
              </Button>
            </Card>
          ) : (
            <>
              <DndContext
                sensors={sensors}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={() => setActiveId(null)}
                autoScroll={{ threshold: { x: 0.18, y: 0.12 }, acceleration: 8 }}
              >
                <div
                  className={cn(
                    isMobile
                      ? "-mx-4 flex gap-3 overflow-x-auto overscroll-x-contain px-4 pb-4 scroll-px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                      : "grid gap-4",
                    // Snap fights auto-scroll, so it is off while a card is held.
                    isMobile && !activeId && "snap-x snap-mandatory",
                  )}
                  style={isMobile ? undefined : { gridTemplateColumns: `repeat(${stages.length}, minmax(260px, 1fr))` }}
                  data-pipeline-board=""
                >
                  {stages.map((stage) => (
                    <div key={stage.id} className={isMobile ? "w-[82vw] max-w-[320px] shrink-0 snap-start" : "min-w-0"}>
                      <PipelineColumn
                        stageId={stage.id}
                        name={stage.name}
                        color={stage.color}
                        items={filterItems(getItemsByStage(stage.id))}
                        onItemClick={setSelectedItem}
                        onAddClick={() => openAddDialog(stage.id)}
                        dragging={activeId !== null}
                        activeId={activeId}
                        isEditingName={editingStageId === stage.id}
                        editingName={editingStageName}
                        onStartEditName={() => handleStartEditStageName(stage.id, stage.name)}
                        onEditingNameChange={setEditingStageName}
                        onSaveEditName={handleSaveStageName}
                        onCancelEditName={handleCancelEditStageName}
                        stages={stages}
                        onMove={handleMoveItem}
                        mobile={isMobile}
                      />
                    </div>
                  ))}
                </div>
                <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.2, 0, 0, 1)" }}>
                  {activeItem ? <ContactCardFace item={activeItem} lifted /> : null}
                </DragOverlay>
              </DndContext>
              {isMobile && stages.length > 1 && (
                <p className="mt-1 text-center text-[11px] text-muted-foreground">Hold a contact to drag it to another column, or tap Move.</p>
              )}
            </>
          )}
        </div>

        {/* Add Contact Dialog */}
        <AddContactDialog
          open={showAddDialog}
          onOpenChange={setShowAddDialog}
          onSubmit={handleCreateContact}
          isLoading={isCreating}
        />

        {/* Item Detail Drawer */}
        <PipelineItemDrawer
          item={selectedItem}
          open={!!selectedItem}
          onOpenChange={(open) => !open && setSelectedItem(null)}
          getEventsForItem={getEventsForItem}
          stages={stages}
          onUpdate={handleUpdateItem}
          onMove={handleMoveItem}
          onDelete={handleDeleteItem}
          isMoving={isMoving}
        />
      </div>
    </PageLayout>
  );
};

// Loading skeleton
function PipelineSkeleton() {
  return (
    <div className="hidden md:grid md:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <Card key={i} className="bg-muted/30 border-border/50 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="h-3 w-3 rounded-full" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-6 w-6 rounded" />
          </div>
          <div className="p-3 space-y-3">
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg opacity-60" />
          </div>
        </Card>
      ))}
    </div>
  );
}

interface PipelineColumnProps {
  stageId: string;
  name: string;
  color: string | null;
  items: PipelineItem[];
  onItemClick: (item: PipelineItem) => void;
  onAddClick: () => void;
  dragging: boolean;
  activeId: string | null;
  isEditingName: boolean;
  editingName: string;
  onStartEditName: () => void;
  onEditingNameChange: (name: string) => void;
  onSaveEditName: () => void;
  onCancelEditName: () => void;
  stages: PipelineStage[];
  onMove: (itemId: string, toStageId: string) => Promise<void>;
  mobile: boolean;
}

function PipelineColumn({
  stageId,
  name,
  color,
  items,
  onItemClick,
  onAddClick,
  dragging,
  activeId,
  isEditingName,
  editingName,
  onStartEditName,
  onEditingNameChange,
  onSaveEditName,
  onCancelEditName,
  stages,
  onMove,
  mobile,
}: PipelineColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stageId });
  const isDragOver = isOver && !items.some((item) => item.id === activeId);
  return (
    <Card
      ref={setNodeRef}
      data-stage-column={name}
      className={cn(
        "flex flex-col overflow-hidden border-border/40 bg-muted/20 transition-[box-shadow,background-color] duration-200",
        mobile ? "h-[calc(100dvh-16.5rem-env(safe-area-inset-bottom,0px))] min-h-[22rem]" : "h-[calc(100vh-200px)]",
        isDragOver && "bg-primary/5 ring-2 ring-primary",
        dragging && !isDragOver && "ring-1 ring-border/60",
      )}
    >
      {/* Column Header */}
      <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: color || 'hsl(var(--primary))' }}
          />
          {isEditingName ? (
            <div className="flex items-center gap-1 flex-1">
              <Input
                value={editingName}
                onChange={(e) => onEditingNameChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSaveEditName();
                  if (e.key === 'Escape') onCancelEditName();
                }}
                className="h-9 text-sm px-2"
                aria-label="Stage name"
                autoFocus
              />
              <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Save stage name" onClick={onSaveEditName}>
                <Check className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Cancel" onClick={onCancelEditName}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <button
              onClick={onStartEditName}
              className="font-medium text-sm text-foreground hover:text-primary transition-colors flex items-center gap-1 group truncate"
            >
              <span className="truncate">{name}</span>
              <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </button>
          )}
          <span className="text-xs text-muted-foreground shrink-0">
            {items.length}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 hover:bg-primary/10 hover:text-primary shrink-0"
          aria-label={`Add contact to ${name}`}
          onClick={onAddClick}
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* Items - scrollable */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {items.length === 0 ? (
            <PipelineEmptyState onAddClick={onAddClick} isDragOver={isDragOver} dragging={dragging} />
          ) : (
            items.map((item) => (
              <PipelineContactCard
                key={item.id}
                item={item}
                onClick={() => onItemClick(item)}
                stages={stages}
                onMove={onMove}
              />
            ))
          )}
          {items.length > 0 && isDragOver && (
            <div className="rounded-lg border-2 border-dashed border-primary/60 bg-primary/5 py-4 text-center text-xs text-primary">Drop here</div>
          )}
        </div>
      </ScrollArea>
    </Card>
  );
}

// Empty state
function PipelineEmptyState({ onAddClick, isDragOver, dragging }: { onAddClick: () => void; isDragOver?: boolean; dragging?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-8 px-4 text-center transition-colors",
        isDragOver ? "border-primary bg-primary/5" : dragging ? "border-border/70" : "border-transparent",
      )}
    >
      <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
        <UserPlus className="w-6 h-6 text-muted-foreground/60" />
      </div>
      <p className="text-sm text-muted-foreground mb-3">
        {isDragOver ? 'Drop here to move' : dragging ? 'Drop a contact here' : 'No contacts yet'}
      </p>
      {!dragging && (
        <Button
          variant="outline"
          size="sm"
          className="text-sm gap-2"
          onClick={onAddClick}
        >
          <Plus className="w-4 h-4" />
          Add first contact
        </Button>
      )}
    </motion.div>
  );
}

const AVATAR_COLORS = ['bg-primary', 'bg-blue-500', 'bg-green-500', 'bg-amber-500', 'bg-purple-500', 'bg-rose-500', 'bg-cyan-500'];
const PRIORITY_COLORS = { high: 'bg-red-500', medium: 'bg-amber-500', low: 'bg-green-500' };

/** The visible card, shared by the column and the lifted copy under the finger. */
function ContactCardFace({ item, lifted = false, move }: { item: PipelineItem; lifted?: boolean; move?: React.ReactNode }) {
  const initials = item.name.split(' ').map((word) => word[0]).slice(0, 2).join('').toUpperCase();
  const avatarColor = AVATAR_COLORS[item.name.charCodeAt(0) % AVATAR_COLORS.length];
  const subtitleParts = [];
  if (item.role) subtitleParts.push(item.role);
  if (item.company) subtitleParts.push(item.company);
  if (!item.role && !item.company && item.email) subtitleParts.push(item.email);
  const subtitle = subtitleParts.join(' • ');
  return (
    <Card
      className={cn(
        "p-3 border-border/50 bg-background/80 transition-all duration-200",
        lifted ? "rotate-[1.5deg] scale-[1.03] border-primary/50 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.6)]" : "hover:bg-accent/30 hover:border-primary/30",
      )}
    >
      <div className="flex items-center gap-3">
        <div className="text-muted-foreground/40 shrink-0" aria-hidden>
          <GripVertical className="w-4 h-4" />
        </div>
        <div className="relative shrink-0">
          <Avatar className="w-10 h-10">
            <AvatarImage src={item.avatar_url || undefined} />
            <AvatarFallback className={`${avatarColor} text-white text-sm font-semibold`}>
              {initials}
            </AvatarFallback>
          </Avatar>
          {item.priority && (
            <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${PRIORITY_COLORS[item.priority]} border-2 border-background`} />
          )}
          {item.linked_user_id && (
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-background flex items-center justify-center">
              <Check className="w-2 h-2 text-white" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-foreground truncate">{item.name}</p>
          {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
        </div>
        {move}
      </div>
    </Card>
  );
}

interface PipelineContactCardProps {
  item: PipelineItem;
  onClick: () => void;
  stages: PipelineStage[];
  onMove: (itemId: string, toStageId: string) => Promise<void>;
}

const stopDrag = {
  onPointerDown: (event: React.SyntheticEvent) => event.stopPropagation(),
  onMouseDown: (event: React.SyntheticEvent) => event.stopPropagation(),
  onTouchStart: (event: React.SyntheticEvent) => event.stopPropagation(),
  onKeyDown: (event: React.KeyboardEvent) => event.stopPropagation(),
};

function PipelineContactCard({ item, onClick, stages, onMove }: PipelineContactCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: item.id });
  // A finished drag also ends with a click; that click must not open the contact.
  const wasDragging = useRef(false);
  useEffect(() => {
    if (isDragging) wasDragging.current = true;
  }, [isDragging]);
  const style: CSSProperties = {
    // Long-press must not open the iOS callout or select text.
    WebkitTouchCallout: "none",
    WebkitUserSelect: "none",
    userSelect: "none",
    touchAction: "manipulation",
  };

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-roledescription="Draggable contact"
      aria-label={`${item.name}. Hold and drag to move, or use the Move button.`}
      data-contact-card={item.name}
      style={style}
      className={cn("cursor-grab rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary active:cursor-grabbing", isDragging && "opacity-30")}
      onClick={() => {
        if (wasDragging.current) {
          wasDragging.current = false;
          return;
        }
        onClick();
      }}
      onKeyDown={(event) => {
        listeners?.onKeyDown?.(event);
        if (event.key === 'Enter' && !event.defaultPrevented) onClick();
      }}
    >
      <ContactCardFace
        item={item}
        move={(
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-11 shrink-0 px-3"
                aria-label={`Move ${item.name}`}
                {...stopDrag}
                onClick={(event) => event.stopPropagation()}
              >
                Move
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[10rem]">
              {stages.map((stage) => (
                <DropdownMenuItem
                  key={stage.id}
                  disabled={stage.id === item.stage_id}
                  onSelect={() => {
                    if (stage.id === item.stage_id) return;
                    void onMove(item.id, stage.id).then(() => {
                      toast.success(`Moved to ${stage.name}`);
                    }, () => undefined);
                  }}
                >
                  {stage.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />
    </div>
  );
}

export default PipelinePage;
