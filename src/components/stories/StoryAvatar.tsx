import { forwardRef } from "react";
import { motion } from "framer-motion";
import { Star } from "lucide-react";

interface StoryAvatarProps {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  isLive?: boolean;
  hasUnviewed?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onClick: () => void;
  index: number;
}

const StoryAvatar = forwardRef<HTMLDivElement, StoryAvatarProps>(function StoryAvatar({
  displayName,
  avatarUrl,
  isLive = false,
  hasUnviewed = true,
  isFavorite = false,
  onToggleFavorite,
  onClick,
  index,
}, ref) {
  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite?.();
  };

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="relative w-[76px] shrink-0"
    >
      <button
        type="button"
        onClick={onClick}
        aria-label={`View ${displayName}'s story`}
        className="group w-full text-left"
      >
        <div className="relative h-[92px] w-[76px]">
          <div
            className="absolute inset-0 rounded-[26px] p-[2.5px]"
            style={{
              background: hasUnviewed
                ? "linear-gradient(160deg, #ffc6de, #ff9fc8 45%, #c4142d)"
                : "linear-gradient(160deg, hsl(var(--border)), hsl(var(--muted-foreground)))",
            }}
          >
            <div className="h-full w-full rounded-[24px] bg-card p-[2px]">
              <div className="h-full w-full overflow-hidden rounded-[22px] bg-muted">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-lg font-medium text-muted-foreground">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </div>
          </div>

          {isLive && (
            <span className="absolute -bottom-1 left-1/2 z-10 -translate-x-1/2 rounded bg-destructive px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-destructive-foreground">
              LIVE
            </span>
          )}
        </div>

        <span className="mt-1.5 block w-[76px] truncate text-center font-body text-[11px] font-semibold text-foreground">
          {displayName.split(" ")[0]}
        </span>
      </button>

      {onToggleFavorite && (
        <button
          type="button"
          onClick={handleFavoriteClick}
          aria-label={isFavorite ? `Remove ${displayName} from favorites` : `Favorite ${displayName}`}
          aria-pressed={isFavorite}
          className={`absolute -right-0.5 -top-0.5 z-10 flex h-5 w-5 items-center justify-center rounded-full transition-colors ${
            isFavorite
              ? "bg-primary text-primary-foreground"
              : "border border-border/50 bg-card/80 text-muted-foreground hover:text-foreground"
          }`}
        >
          <Star className={`h-2.5 w-2.5 ${isFavorite ? "fill-current" : ""}`} />
        </button>
      )}
    </motion.div>
  );
});

export default StoryAvatar;
