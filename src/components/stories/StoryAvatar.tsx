import { motion } from 'framer-motion';
import { Star } from 'lucide-react';

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

const StoryAvatar = ({
  userId,
  displayName,
  avatarUrl,
  isLive = false,
  hasUnviewed = true,
  isFavorite = false,
  onToggleFavorite,
  onClick,
  index,
}: StoryAvatarProps) => {
  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite?.();
  };

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="relative shrink-0 group"
    >
      <div className="w-16 h-16 rounded-full relative">
        {/* Animated gradient ring */}
        <div 
          className={`absolute inset-0 rounded-full p-[2px] ${
            hasUnviewed
              ? 'bg-gradient-to-br from-primary via-primary/80 to-primary/60 animate-pulse'
              : 'bg-gradient-to-br from-muted-foreground/40 to-muted-foreground/20'
          }`}
          style={{
            background: hasUnviewed 
              ? 'conic-gradient(from 0deg, hsl(340 82% 65%), hsl(350 75% 55%), hsl(340 82% 65%))'
              : undefined
          }}
        >
          {/* Glass inner ring */}
          <div className="w-full h-full rounded-full bg-card p-[2px]">
            {/* Avatar container */}
            <div className="w-full h-full rounded-full overflow-hidden bg-muted">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground font-medium text-lg">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Favorite indicator */}
        {onToggleFavorite && (
          <motion.button
            onClick={handleFavoriteClick}
            whileHover={{ scale: 1.2 }}
            whileTap={{ scale: 0.9 }}
            className={`absolute -top-0.5 -right-0.5 z-10 w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
              isFavorite 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-card/80 text-muted-foreground hover:text-foreground border border-border/50'
            }`}
          >
            <Star className={`w-2.5 h-2.5 ${isFavorite ? 'fill-current' : ''}`} />
          </motion.button>
        )}

        {/* LIVE Badge */}
        {isLive && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -bottom-1 left-1/2 -translate-x-1/2 z-10"
          >
            <span className="px-1.5 py-0.5 bg-destructive text-destructive-foreground text-[8px] font-bold rounded uppercase tracking-wider">
              LIVE
            </span>
          </motion.div>
        )}
      </div>

      {/* Username */}
      <span className="text-[10px] text-muted-foreground mt-1.5 block text-center truncate w-16 group-hover:text-foreground transition-colors">
        {displayName.split(' ')[0]}
      </span>
    </motion.button>
  );
};

export default StoryAvatar;
