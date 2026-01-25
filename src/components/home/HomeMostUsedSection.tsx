import { motion } from "framer-motion";
import { Zap } from "lucide-react";
import { HomeItemTile } from "./HomeItemTile";
import type { HomeItem } from "@/config/homeItems";

interface HomeMostUsedSectionProps {
  items: (HomeItem & { score: number; isPinned: boolean })[];
  onItemClick: (itemId: string) => void;
  isEditing?: boolean;
  onTogglePin?: (itemId: string) => void;
}

export function HomeMostUsedSection({
  items,
  onItemClick,
  isEditing,
  onTogglePin,
}: HomeMostUsedSectionProps) {
  if (items.length === 0) return null;

  return (
    <section className="px-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center gap-2 mb-3"
      >
        <Zap className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-medium text-foreground">For You</h2>
      </motion.div>

      <div className="grid grid-cols-2 gap-3">
        {items.map((item, index) => (
          <HomeItemTile
            key={item.id}
            item={item}
            onClick={() => onItemClick(item.id)}
            isPinned={item.isPinned}
            isEditing={isEditing}
            onTogglePin={() => onTogglePin?.(item.id)}
            size="lg"
            index={index}
          />
        ))}
      </div>
    </section>
  );
}
