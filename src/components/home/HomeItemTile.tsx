import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Pin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HomeItem } from "@/config/homeItems";

interface HomeItemTileProps {
  item: HomeItem;
  onClick?: () => void;
  isPinned?: boolean;
  isEditing?: boolean;
  onTogglePin?: () => void;
  size?: "sm" | "md" | "lg";
  index?: number;
}

export function HomeItemTile({
  item,
  onClick,
  isPinned,
  isEditing,
  onTogglePin,
  size = "md",
  index = 0,
}: HomeItemTileProps) {
  const Icon = item.icon;

  const sizeClasses = {
    sm: "p-3 gap-2",
    md: "p-4 gap-3",
    lg: "p-5 gap-4",
  };

  const iconSizes = {
    sm: "h-5 w-5",
    md: "h-6 w-6",
    lg: "h-7 w-7",
  };

  const containerSizes = {
    sm: "h-10 w-10",
    md: "h-12 w-12",
    lg: "h-14 w-14",
  };

  const content = (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      whileTap={{ scale: 0.97 }}
      className={cn(
        "relative flex flex-col items-center rounded-2xl bg-card/60 backdrop-blur-sm border border-border/40 transition-all duration-200",
        "hover:bg-card hover:border-border/60 hover:shadow-lg",
        "active:scale-[0.98]",
        sizeClasses[size]
      )}
    >
      {/* Pin indicator */}
      {isPinned && !isEditing && (
        <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
          <Pin className="h-2.5 w-2.5 text-primary-foreground" />
        </div>
      )}

      {/* Edit mode pin toggle */}
      {isEditing && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onTogglePin?.();
          }}
          className={cn(
            "absolute -top-1.5 -right-1.5 h-6 w-6 rounded-full flex items-center justify-center transition-colors",
            isPinned ? "bg-primary" : "bg-muted border border-border"
          )}
          aria-label={isPinned ? "Unpin item" : "Pin item"}
        >
          <Pin className={cn("h-3 w-3", isPinned ? "text-primary-foreground" : "text-muted-foreground")} />
        </button>
      )}

      {/* Icon */}
      <div
        className={cn(
          "flex items-center justify-center rounded-xl bg-primary/10",
          containerSizes[size]
        )}
      >
        <Icon className={cn("text-primary", iconSizes[size])} />
      </div>

      {/* Label */}
      <span className="text-sm font-medium text-foreground text-center line-clamp-1">
        {item.label}
      </span>

      {/* Description for larger sizes */}
      {size === "lg" && item.description && (
        <span className="text-xs text-muted-foreground text-center line-clamp-1">
          {item.description}
        </span>
      )}
    </motion.div>
  );

  if (isEditing) {
    return <div className="cursor-pointer">{content}</div>;
  }

  return (
    <Link to={item.route} onClick={onClick} className="block">
      {content}
    </Link>
  );
}
