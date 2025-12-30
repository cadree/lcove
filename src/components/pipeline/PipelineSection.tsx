import { useState } from "react";
import { motion } from "framer-motion";
import { Users, Plus, UserPlus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { usePipeline } from "@/hooks/usePipeline";
import { PipelineItemDrawer } from "./PipelineItemDrawer";
import { CreatePipelineItemDialog } from "./CreatePipelineItemDialog";
import { PipelineItem } from "@/actions/pipelineActions";
import { toast } from "sonner";

export function PipelineSection() {
  const { stages, isLoading, error, getItemsByStage, getEventsForItem, createItem, updateItem, moveItem, deleteItem, isCreating, isMoving } = usePipeline();
  const [selectedItem, setSelectedItem] = useState<PipelineItem | null>(null);
  const [createDialogStageId, setCreateDialogStageId] = useState<string | null>(null);

  const handleCreateItem = async (name: string) => {
    if (!createDialogStageId) return;
    try {
      await createItem({ stageId: createDialogStageId, name });
      setCreateDialogStageId(null);
      toast.success("Contact added to pipeline");
    } catch (err) {
      toast.error("Failed to create contact");
    }
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

  // Loading state with skeletons
  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-5 py-4"
      >
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-primary" />
          <h2 className="font-display text-lg font-semibold text-foreground">My Pipeline</h2>
        </div>
        
        {/* Desktop skeleton */}
        <div className="hidden md:grid md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <PipelineColumnSkeleton key={i} />
          ))}
        </div>
        
        {/* Mobile skeleton */}
        <div className="md:hidden">
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-4 pb-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="w-[280px] flex-shrink-0">
                  <PipelineColumnSkeleton />
                </div>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      </motion.div>
    );
  }

  // Error state
  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-5 py-4"
      >
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-primary" />
          <h2 className="font-display text-lg font-semibold text-foreground">My Pipeline</h2>
        </div>
        <Card className="bg-muted/30 border-border/50 p-6 text-center">
          <p className="text-muted-foreground text-sm mb-3">Unable to load your pipeline</p>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="px-5 py-4"
    >
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-5 h-5 text-primary" />
        <h2 className="font-display text-lg font-semibold text-foreground">My Pipeline</h2>
      </div>

      {/* Desktop: Grid, Mobile: Horizontal scroll */}
      <div className="hidden md:grid md:grid-cols-4 gap-4">
        {stages.map((stage) => {
          const items = getItemsByStage(stage.id);
          return (
            <PipelineColumn
              key={stage.id}
              stageId={stage.id}
              name={stage.name}
              color={stage.color}
              items={items}
              onItemClick={setSelectedItem}
              onAddClick={() => setCreateDialogStageId(stage.id)}
            />
          );
        })}
      </div>

      {/* Mobile horizontal scroll */}
      <div className="md:hidden">
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-4 pb-4">
            {stages.map((stage) => {
              const items = getItemsByStage(stage.id);
              return (
                <div key={stage.id} className="w-[280px] flex-shrink-0">
                  <PipelineColumn
                    stageId={stage.id}
                    name={stage.name}
                    color={stage.color}
                    items={items}
                    onItemClick={setSelectedItem}
                    onAddClick={() => setCreateDialogStageId(stage.id)}
                  />
                </div>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* Create Item Dialog */}
      <CreatePipelineItemDialog
        open={!!createDialogStageId}
        onOpenChange={(open) => !open && setCreateDialogStageId(null)}
        onSubmit={handleCreateItem}
        isLoading={isCreating}
        stageName={stages.find(s => s.id === createDialogStageId)?.name || ''}
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
    </motion.div>
  );
}

// Loading skeleton for columns
function PipelineColumnSkeleton() {
  return (
    <Card className="bg-muted/30 border-border/50 overflow-hidden">
      <div className="px-3 py-2.5 border-b border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-5 w-6 rounded-full" />
        </div>
        <Skeleton className="h-6 w-6 rounded" />
      </div>
      <div className="p-2 space-y-2 min-h-[120px]">
        <Skeleton className="h-14 w-full rounded-lg" />
        <Skeleton className="h-14 w-full rounded-lg opacity-60" />
      </div>
    </Card>
  );
}

interface PipelineColumnProps {
  stageId: string;
  name: string;
  color: string | null;
  items: PipelineItem[];
  onItemClick: (item: PipelineItem) => void;
  onAddClick: () => void;
}

function PipelineColumn({ stageId, name, color, items, onItemClick, onAddClick }: PipelineColumnProps) {
  return (
    <Card className="bg-muted/30 border-border/50 overflow-hidden">
      {/* Column Header */}
      <div 
        className="px-3 py-2.5 border-b border-border/50 flex items-center justify-between"
        style={{ borderLeftColor: color || undefined, borderLeftWidth: color ? 3 : 0 }}
      >
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-foreground truncate">{name}</span>
          <span className="text-xs text-muted-foreground bg-background/50 px-2 py-0.5 rounded-full">
            {items.length}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 hover:bg-primary/10 hover:text-primary"
          onClick={onAddClick}
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* Items */}
      <div className="p-2 space-y-2 min-h-[120px] max-h-[300px] overflow-y-auto">
        {items.length === 0 ? (
          <PipelineEmptyState onAddClick={onAddClick} />
        ) : (
          items.map((item) => (
            <PipelineItemCard
              key={item.id}
              item={item}
              onClick={() => onItemClick(item)}
            />
          ))
        )}
      </div>
    </Card>
  );
}

// Empty state for columns
function PipelineEmptyState({ onAddClick }: { onAddClick: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-6 px-2 text-center">
      <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center mb-3">
        <UserPlus className="w-5 h-5 text-muted-foreground/60" />
      </div>
      <p className="text-xs text-muted-foreground mb-2">No contacts yet</p>
      <Button
        variant="ghost"
        size="sm"
        className="text-xs text-primary hover:text-primary hover:bg-primary/10 h-7"
        onClick={onAddClick}
      >
        <Plus className="w-3 h-3 mr-1" />
        Add first contact
      </Button>
    </div>
  );
}

interface PipelineItemCardProps {
  item: PipelineItem;
  onClick: () => void;
}

function PipelineItemCard({ item, onClick }: PipelineItemCardProps) {
  // Build subtitle from available info
  const subtitleParts = [];
  if (item.role) subtitleParts.push(item.role);
  if (item.company) subtitleParts.push(item.company);
  const subtitle = subtitleParts.join(' • ');

  return (
    <Card
      className="p-3 bg-background/80 hover:bg-accent/50 cursor-pointer transition-all duration-200 border-border/50 hover:border-primary/30 hover:shadow-sm"
      onClick={onClick}
    >
      <p className="font-medium text-sm text-foreground truncate">{item.name}</p>
      {subtitle && (
        <p className="text-xs text-muted-foreground truncate mt-0.5">{subtitle}</p>
      )}
    </Card>
  );
}
