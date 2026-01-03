import { useState, useEffect, DragEvent } from "react";
import { motion } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Users, Plus, Search, ArrowLeft, UserPlus, GripVertical, Pencil, Check, X, Sun } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import PageLayout from "@/components/layout/PageLayout";
import { usePipeline } from "@/hooks/usePipeline";
import { usePipelines, Pipeline as PipelineType } from "@/hooks/usePipelines";
import { PipelineItemDrawer } from "@/components/pipeline/PipelineItemDrawer";
import { AddContactDialog, ContactFormData } from "@/components/pipeline/AddContactDialog";
import { PipelineSelector } from "@/components/pipeline/PipelineSelector";
import { PipelineItem } from "@/actions/pipelineActions";
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
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
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
        priority: data.priority
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
    const targetItems = getItemsByStage(toStageId);
    const newSortOrder = targetItems.length > 0 
      ? Math.max(...targetItems.map(i => i.sort_order)) + 1 
      : 0;
    
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

  // Drag and drop handlers
  const handleDragStart = (e: DragEvent<HTMLDivElement>, itemId: string) => {
    setDraggedItemId(itemId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', itemId);
  };

  const handleDragEnd = () => {
    setDraggedItemId(null);
    setDragOverStageId(null);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>, stageId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStageId(stageId);
  };

  const handleDragLeave = () => {
    setDragOverStageId(null);
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>, toStageId: string) => {
    e.preventDefault();
    const itemId = e.dataTransfer.getData('text/plain');
    
    if (itemId && draggedItemId) {
      const item = items.find(i => i.id === itemId);
      if (item && item.stage_id !== toStageId) {
        await handleMoveItem(itemId, toStageId);
        toast.success("Contact moved");
      }
    }
    
    setDraggedItemId(null);
    setDragOverStageId(null);
  };

  const totalContacts = items.length;

  return (
    <PageLayout>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border/50">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => navigate('/')}
                className="shrink-0"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                <PipelineSelector 
                  currentPipeline={currentPipeline} 
                  onPipelineChange={setCurrentPipeline} 
                />
                <span className="text-sm text-muted-foreground">({totalContacts})</span>
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
            <div className="flex items-center gap-2">
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
              {/* Desktop: Full width columns */}
              <div className="hidden md:grid gap-4" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(280px, 1fr))` }}>
                {stages.map((stage) => {
                  const stageItems = filterItems(getItemsByStage(stage.id));
                  return (
                    <PipelineColumn
                      key={stage.id}
                      stageId={stage.id}
                      name={stage.name}
                      color={stage.color}
                      items={stageItems}
                      onItemClick={setSelectedItem}
                      onAddClick={() => openAddDialog(stage.id)}
                      isDragOver={dragOverStageId === stage.id}
                      onDragOver={(e) => handleDragOver(e, stage.id)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, stage.id)}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      draggedItemId={draggedItemId}
                      isEditingName={editingStageId === stage.id}
                      editingName={editingStageName}
                      onStartEditName={() => handleStartEditStageName(stage.id, stage.name)}
                      onEditingNameChange={setEditingStageName}
                      onSaveEditName={handleSaveStageName}
                      onCancelEditName={handleCancelEditStageName}
                    />
                  );
                })}
              </div>

              {/* Mobile: Horizontal scroll */}
              <div className="md:hidden">
                <ScrollArea className="w-full whitespace-nowrap">
                  <div className="flex gap-4 pb-4">
                    {stages.map((stage) => {
                      const stageItems = filterItems(getItemsByStage(stage.id));
                      return (
                        <div key={stage.id} className="w-[300px] flex-shrink-0">
                        <PipelineColumn
                          stageId={stage.id}
                          name={stage.name}
                          color={stage.color}
                          items={stageItems}
                          onItemClick={setSelectedItem}
                          onAddClick={() => openAddDialog(stage.id)}
                          isDragOver={dragOverStageId === stage.id}
                          onDragOver={(e) => handleDragOver(e, stage.id)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, stage.id)}
                          onDragStart={handleDragStart}
                          onDragEnd={handleDragEnd}
                          draggedItemId={draggedItemId}
                          isEditingName={editingStageId === stage.id}
                          editingName={editingStageName}
                          onStartEditName={() => handleStartEditStageName(stage.id, stage.name)}
                          onEditingNameChange={setEditingStageName}
                          onSaveEditName={handleSaveStageName}
                          onCancelEditName={handleCancelEditStageName}
                        />
                      </div>
                      );
                    })}
                  </div>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </div>
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
  isDragOver: boolean;
  onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
  onDrop: (e: DragEvent<HTMLDivElement>) => void;
  onDragStart: (e: DragEvent<HTMLDivElement>, itemId: string) => void;
  onDragEnd: () => void;
  draggedItemId: string | null;
  isEditingName: boolean;
  editingName: string;
  onStartEditName: () => void;
  onEditingNameChange: (name: string) => void;
  onSaveEditName: () => void;
  onCancelEditName: () => void;
}

function PipelineColumn({ 
  stageId, 
  name, 
  color, 
  items, 
  onItemClick, 
  onAddClick,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragStart,
  onDragEnd,
  draggedItemId,
  isEditingName,
  editingName,
  onStartEditName,
  onEditingNameChange,
  onSaveEditName,
  onCancelEditName
}: PipelineColumnProps) {
  return (
    <Card 
      className={`bg-muted/20 border-border/40 overflow-hidden flex flex-col h-[calc(100vh-200px)] transition-all duration-200 ${
        isDragOver ? 'ring-2 ring-primary bg-primary/5' : ''
      }`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
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
                className="h-7 text-sm px-2"
                autoFocus
              />
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onSaveEditName}>
                <Check className="w-3 h-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onCancelEditName}>
                <X className="w-3 h-3" />
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
          className="h-7 w-7 hover:bg-primary/10 hover:text-primary shrink-0"
          onClick={onAddClick}
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* Items - scrollable */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {items.length === 0 ? (
            <PipelineEmptyState onAddClick={onAddClick} isDragOver={isDragOver} />
          ) : (
            items.map((item) => (
              <PipelineContactCard
                key={item.id}
                item={item}
                onClick={() => onItemClick(item)}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                isDragging={draggedItemId === item.id}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </Card>
  );
}

// Empty state
function PipelineEmptyState({ onAddClick, isDragOver }: { onAddClick: () => void; isDragOver?: boolean }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`flex flex-col items-center justify-center py-8 px-4 text-center rounded-lg border-2 border-dashed transition-colors ${
        isDragOver ? 'border-primary bg-primary/5' : 'border-transparent'
      }`}
    >
      <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
        <UserPlus className="w-6 h-6 text-muted-foreground/60" />
      </div>
      <p className="text-sm text-muted-foreground mb-3">
        {isDragOver ? 'Drop here to move' : 'No contacts yet'}
      </p>
      {!isDragOver && (
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

interface PipelineContactCardProps {
  item: PipelineItem;
  onClick: () => void;
  onDragStart: (e: DragEvent<HTMLDivElement>, itemId: string) => void;
  onDragEnd: () => void;
  isDragging: boolean;
}

function PipelineContactCard({ item, onClick, onDragStart, onDragEnd, isDragging }: PipelineContactCardProps) {
  // Generate initials from name
  const initials = item.name
    .split(' ')
    .map(word => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  // Generate a consistent color based on the name
  const colors = [
    'bg-primary',
    'bg-blue-500',
    'bg-green-500',
    'bg-amber-500',
    'bg-purple-500',
    'bg-rose-500',
    'bg-cyan-500',
  ];
  const colorIndex = item.name.charCodeAt(0) % colors.length;
  const avatarColor = colors[colorIndex];

  // Build subtitle from available info
  const subtitleParts = [];
  if (item.role) subtitleParts.push(item.role);
  if (item.company) subtitleParts.push(item.company);
  if (!item.role && !item.company && item.email) subtitleParts.push(item.email);
  const subtitle = subtitleParts.join(' • ');

  // Priority indicator color
  const priorityColors = {
    high: 'bg-red-500',
    medium: 'bg-amber-500',
    low: 'bg-green-500'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: isDragging ? 0.5 : 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      draggable
      onDragStart={(e) => onDragStart(e as unknown as DragEvent<HTMLDivElement>, item.id)}
      onDragEnd={onDragEnd}
      className={`cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-50' : ''}`}
    >
      <Card
        className="p-3 bg-background/80 hover:bg-accent/30 transition-all duration-200 border-border/50 hover:border-primary/30"
        onClick={onClick}
      >
        <div className="flex items-center gap-3">
          {/* Drag Handle */}
          <div className="text-muted-foreground/40 hover:text-muted-foreground shrink-0">
            <GripVertical className="w-4 h-4" />
          </div>
          
          {/* Avatar */}
          <div className="relative shrink-0">
            <Avatar className="w-10 h-10">
              <AvatarImage src={item.avatar_url || undefined} />
              <AvatarFallback className={`${avatarColor} text-white text-sm font-semibold`}>
                {initials}
              </AvatarFallback>
            </Avatar>
            {item.priority && (
              <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${priorityColors[item.priority]} border-2 border-background`} />
            )}
            {item.linked_user_id && (
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-background flex items-center justify-center">
                <Check className="w-2 h-2 text-white" />
              </div>
            )}
          </div>
          
          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-foreground truncate">{item.name}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

export default PipelinePage;
