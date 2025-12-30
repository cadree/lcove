import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Users, Plus, Search, ArrowLeft, UserPlus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import PageLayout from "@/components/layout/PageLayout";
import { usePipeline } from "@/hooks/usePipeline";
import { PipelineItemDrawer } from "@/components/pipeline/PipelineItemDrawer";
import { CreatePipelineItemDialog } from "@/components/pipeline/CreatePipelineItemDialog";
import { PipelineItem } from "@/actions/pipelineActions";
import { toast } from "sonner";

const Pipeline = () => {
  const navigate = useNavigate();
  const { stages, items, isLoading, error, getItemsByStage, getEventsForItem, createItem, updateItem, moveItem, deleteItem, isCreating, isMoving } = usePipeline();
  const [selectedItem, setSelectedItem] = useState<PipelineItem | null>(null);
  const [createDialogStageId, setCreateDialogStageId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Filter items by search
  const filterItems = (stageItems: PipelineItem[]) => {
    if (!searchQuery.trim()) return stageItems;
    const query = searchQuery.toLowerCase();
    return stageItems.filter(
      item => item.title.toLowerCase().includes(query) || 
              item.subtitle?.toLowerCase().includes(query)
    );
  };

  const handleCreateItem = async (title: string, subtitle?: string) => {
    if (!createDialogStageId) return;
    try {
      await createItem({ stageId: createDialogStageId, title, subtitle });
      setCreateDialogStageId(null);
      toast.success("Contact added to pipeline");
    } catch (err) {
      toast.error("Failed to add contact");
    }
  };

  const handleUpdateItem = async (itemId: string, fields: { title?: string; subtitle?: string; notes?: string }) => {
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

  const totalContacts = items.length;

  return (
    <PageLayout hideNav>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border/50">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => navigate(-1)}
                className="shrink-0"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                <h1 className="font-display text-xl font-semibold text-foreground">Pipeline</h1>
                <span className="text-sm text-muted-foreground">({totalContacts})</span>
              </div>
            </div>
            
            {/* Search */}
            <div className="hidden sm:flex items-center gap-2 flex-1 max-w-md mx-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search contacts, timeline, appointments..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-muted/30 border-border/50"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button
                variant="default"
                size="sm"
                className="gap-2"
                onClick={() => {
                  if (stages.length > 0) {
                    setCreateDialogStageId(stages[0].id);
                  }
                }}
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
                      onAddClick={() => setCreateDialogStageId(stage.id)}
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
                            onAddClick={() => setCreateDialogStageId(stage.id)}
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
}

function PipelineColumn({ stageId, name, color, items, onItemClick, onAddClick }: PipelineColumnProps) {
  return (
    <Card className="bg-muted/20 border-border/40 overflow-hidden flex flex-col h-[calc(100vh-200px)]">
      {/* Column Header */}
      <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div 
            className="w-3 h-3 rounded-full" 
            style={{ backgroundColor: color || 'hsl(var(--primary))' }} 
          />
          <span className="font-medium text-sm text-foreground">{name}</span>
          <span className="text-xs text-muted-foreground">
            {items.length}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 hover:bg-primary/10 hover:text-primary"
          onClick={onAddClick}
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* Items - scrollable */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {items.length === 0 ? (
            <PipelineEmptyState onAddClick={onAddClick} />
          ) : (
            items.map((item) => (
              <PipelineContactCard
                key={item.id}
                item={item}
                onClick={() => onItemClick(item)}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </Card>
  );
}

// Empty state
function PipelineEmptyState({ onAddClick }: { onAddClick: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center py-8 px-4 text-center"
    >
      <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
        <UserPlus className="w-6 h-6 text-muted-foreground/60" />
      </div>
      <p className="text-sm text-muted-foreground mb-3">No contacts yet</p>
      <Button
        variant="outline"
        size="sm"
        className="text-sm gap-2"
        onClick={onAddClick}
      >
        <Plus className="w-4 h-4" />
        Add first contact
      </Button>
    </motion.div>
  );
}

interface PipelineContactCardProps {
  item: PipelineItem;
  onClick: () => void;
}

function PipelineContactCard({ item, onClick }: PipelineContactCardProps) {
  // Generate initials from title
  const initials = item.title
    .split(' ')
    .map(word => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  // Generate a consistent color based on the title
  const colors = [
    'bg-primary',
    'bg-blue-500',
    'bg-green-500',
    'bg-amber-500',
    'bg-purple-500',
    'bg-rose-500',
    'bg-cyan-500',
  ];
  const colorIndex = item.title.charCodeAt(0) % colors.length;
  const avatarColor = colors[colorIndex];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <Card
        className="p-3 bg-background/80 hover:bg-accent/30 cursor-pointer transition-all duration-200 border-border/50 hover:border-primary/30"
        onClick={onClick}
      >
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className={`w-10 h-10 rounded-lg ${avatarColor} flex items-center justify-center shrink-0`}>
            <span className="text-sm font-semibold text-white">{initials}</span>
          </div>
          
          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-foreground truncate">{item.title}</p>
            {item.subtitle && (
              <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

export default Pipeline;
