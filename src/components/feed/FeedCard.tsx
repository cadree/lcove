import { Heart, MessageCircle, Share2 } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

interface FeedCardProps {
  image: string;
  title: string;
  creator: string;
  creatorAvatar: string;
  category: string;
  likes: number;
  comments: number;
}

const FeedCard = ({
  image,
  title,
  creator,
  creatorAvatar,
  category,
  likes,
  comments,
}: FeedCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden bg-card card-elevated group"
    >
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
        style={{ backgroundImage: `url(${image})` }}
      />

      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />

      {/* Category Tag */}
      <div className="absolute top-4 left-4">
        <span className="glass-strong px-3 py-1.5 rounded-full text-xs font-medium text-foreground">
          {category}
        </span>
      </div>

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-5">
        {/* Creator */}
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-10 h-10 rounded-full bg-cover bg-center border-2 border-primary/30"
            style={{ backgroundImage: `url(${creatorAvatar})` }}
          />
          <span className="text-sm font-medium text-foreground">{creator}</span>
        </div>

        {/* Title */}
        <h3 className="font-display text-xl font-medium text-foreground mb-4 line-clamp-2">
          {title}
        </h3>

        {/* Actions */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary gap-2">
            <Heart className="w-4 h-4" />
            <span className="text-xs">{likes}</span>
          </Button>
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-2">
            <MessageCircle className="w-4 h-4" />
            <span className="text-xs">{comments}</span>
          </Button>
          <Button variant="ghost" size="iconSm" className="text-muted-foreground hover:text-foreground ml-auto">
            <Share2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default FeedCard;
