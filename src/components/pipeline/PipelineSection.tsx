import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { usePipeline } from "@/hooks/usePipeline";
import { PipelineItemDrawer } from "./PipelineItemDrawer";
import { PipelineItem } from "@/actions/pipelineActions";

export function PipelineSection() {
  const { stages, isLoading, getItemsByStage, getEventsForItem } = usePipeline();
  const [selectedItem, setSelectedItem] = useState<PipelineItem | null>(null);

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
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
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
              name={stage.name}
              color={stage.color}
              items={items}
              onItemClick={setSelectedItem}
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
                    name={stage.name}
                    color={stage.color}
                    items={items}
                    onItemClick={setSelectedItem}
                  />
                </div>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* Item Detail Drawer */}
      <PipelineItemDrawer
        item={selectedItem}
        open={!!selectedItem}
        onOpenChange={(open) => !open && setSelectedItem(null)}
        getEventsForItem={getEventsForItem}
      />
    </motion.div>
  );
}

interface PipelineColumnProps {
  name: string;
  color: string | null;
  items: PipelineItem[];
  onItemClick: (item: PipelineItem) => void;
}

function PipelineColumn({ name, color, items, onItemClick }: PipelineColumnProps) {
  return (
    <Card className="bg-muted/30 border-border/50 overflow-hidden">
      {/* Column Header */}
      <div 
        className="px-3 py-2.5 border-b border-border/50 flex items-center justify-between"
        style={{ borderLeftColor: color || undefined, borderLeftWidth: color ? 3 : 0 }}
      >
        <span className="font-medium text-sm text-foreground truncate">{name}</span>
        <span className="text-xs text-muted-foreground bg-background/50 px-2 py-0.5 rounded-full">
          {items.length}
        </span>
      </div>

      {/* Items */}
      <div className="p-2 space-y-2 min-h-[120px] max-h-[300px] overflow-y-auto">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No items</p>
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

interface PipelineItemCardProps {
  item: PipelineItem;
  onClick: () => void;
}

function PipelineItemCard({ item, onClick }: PipelineItemCardProps) {
  return (
    <Card
      className="p-3 bg-background hover:bg-accent/50 cursor-pointer transition-colors border-border/50"
      onClick={onClick}
    >
      <p className="font-medium text-sm text-foreground truncate">{item.title}</p>
      {item.subtitle && (
        <p className="text-xs text-muted-foreground truncate mt-0.5">{item.subtitle}</p>
      )}
    </Card>
  );
}
