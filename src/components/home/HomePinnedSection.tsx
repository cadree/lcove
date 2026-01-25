import { motion } from "framer-motion";
import { Pin } from "lucide-react";
import { HomeItemTile } from "./HomeItemTile";
import type { HomeItem } from "@/config/homeItems";

interface HomePinnedSectionProps {
  items: (HomeItem & { score: number; isPinned: boolean })[];
  onItemClick: (itemId: string) => void;
  isEditing?: boolean;
  onTogglePin?: (itemId: string) => void;
}

export function HomePinnedSection({
  items,
  onItemClick,
  isEditing,
  onTogglePin,
}: HomePinnedSectionProps) {
  if (items.length === 0) return null;

  return (
    <section className="px-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center gap-2 mb-3"
      >
        <Pin className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-medium text-foreground">Pinned</h2>
      </motion.div>

      <div className="grid grid-cols-4 gap-2">
        {items.map((item, index) => (
          <HomeItemTile
            key={item.id}
            item={item}
            onClick={() => onItemClick(item.id)}
            isPinned={item.isPinned}
            isEditing={isEditing}
            onTogglePin={() => onTogglePin?.(item.id)}
            size="sm"
            index={index}
          />
        ))}
      </div>
    </section>
  );
}
