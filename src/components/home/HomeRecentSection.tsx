import { motion } from "framer-motion";
import { Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { HomeItem } from "@/config/homeItems";

interface HomeRecentSectionProps {
  items: (HomeItem & { score: number })[];
  onItemClick: (itemId: string) => void;
}

export function HomeRecentSection({ items, onItemClick }: HomeRecentSectionProps) {
  if (items.length === 0) return null;

  return (
    <section className="px-4">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-medium text-muted-foreground">Continue</h2>
      </div>

      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4">
        {items.map((item, index) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Link
                to={item.route}
                onClick={() => onItemClick(item.id)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2.5 rounded-xl",
                  "bg-card/60 backdrop-blur-sm border border-border/40",
                  "hover:bg-card hover:border-border/60 transition-all",
                  "whitespace-nowrap min-w-fit"
                )}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <span className="text-sm font-medium text-foreground">{item.label}</span>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
