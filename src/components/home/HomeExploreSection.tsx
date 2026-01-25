import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { categoryLabels, categoryOrder, type HomeItemCategory, type HomeItem } from "@/config/homeItems";

interface HomeExploreSectionProps {
  items: (HomeItem & { score: number; isPinned: boolean })[];
  onItemClick: (itemId: string) => void;
  isEditing?: boolean;
  onTogglePin?: (itemId: string) => void;
}

export function HomeExploreSection({
  items,
  onItemClick,
  isEditing,
  onTogglePin,
}: HomeExploreSectionProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<HomeItemCategory>>(
    new Set(["core", "discover"])
  );

  const toggleCategory = (category: HomeItemCategory) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // Group items by category, excluding pinned items
  const groupedItems = categoryOrder.reduce((acc, category) => {
    acc[category] = items.filter((item) => item.category === category && !item.isPinned);
    return acc;
  }, {} as Record<HomeItemCategory, typeof items>);

  return (
    <section className="px-4 space-y-2">
      <h2 className="text-sm font-medium text-muted-foreground mb-3">Explore</h2>

      {categoryOrder.map((category) => {
        const categoryItems = groupedItems[category];
        if (categoryItems.length === 0) return null;

        const isExpanded = expandedCategories.has(category);

        return (
          <div
            key={category}
            className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm overflow-hidden"
          >
            {/* Category header */}
            <button
              onClick={() => toggleCategory(category)}
              className="flex w-full items-center justify-between px-4 py-3 hover:bg-accent/30 transition-colors"
              aria-expanded={isExpanded}
            >
              <span className="text-sm font-medium text-foreground">
                {categoryLabels[category]}
              </span>
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </motion.div>
            </button>

            {/* Category items */}
            <AnimatePresence initial={false}>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-2 pb-2 space-y-1">
                    {categoryItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.id}
                          to={item.route}
                          onClick={() => onItemClick(item.id)}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                            "hover:bg-accent/50"
                          )}
                        >
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                            <Icon className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">{item.label}</p>
                            {item.description && (
                              <p className="text-xs text-muted-foreground truncate">
                                {item.description}
                              </p>
                            )}
                          </div>
                          {isEditing && (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onTogglePin?.(item.id);
                              }}
                              className={cn(
                                "h-6 w-6 rounded-full flex items-center justify-center transition-colors",
                                item.isPinned ? "bg-primary" : "bg-muted border border-border"
                              )}
                              aria-label={item.isPinned ? "Unpin" : "Pin"}
                            >
                              <span className="text-[10px] font-bold text-foreground">
                                {item.isPinned ? "−" : "+"}
                              </span>
                            </button>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </section>
  );
}
