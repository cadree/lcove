import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Play, Pause, Lock, Unlock, Music, DollarSign, Trash2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ExclusiveTrack, ExclusiveAccessRule } from "@/hooks/useExclusiveMusic";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ExclusiveTrackCardProps {
  track: ExclusiveTrack;
  hasAccess: boolean;
  isOwner: boolean;
  rules: ExclusiveAccessRule[];
  onDelete?: () => void;
  onTogglePublish?: () => void;
  onPurchase?: (track: ExclusiveTrack, rule: ExclusiveAccessRule) => void;
}

export const ExclusiveTrackCard = ({
  track,
  hasAccess,
  isOwner,
  rules,
  onDelete,
  onTogglePublish,
  onPurchase,
}: ExclusiveTrackCardProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playableUrl = hasAccess ? track.audio_file_url : track.preview_clip_url;

  const handlePlayPause = () => {
    if (!playableUrl) return;
    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
    } else {
      if (audioRef.current) audioRef.current.pause();
      audioRef.current = new Audio(playableUrl);
      audioRef.current.play();
      audioRef.current.onended = () => setIsPlaying(false);
      setIsPlaying(true);
    }
  };

  const trackRules = rules.filter(
    (r) => r.track_id === track.id || r.track_id === null
  );
  const purchaseRule = trackRules.find((r) => r.rule_type === "purchase");
  const price = purchaseRule?.amount_cents || track.price_cents || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "glass-strong rounded-xl overflow-hidden group",
        !track.is_published && isOwner && "opacity-70 border border-dashed border-border"
      )}
    >
      <div className="flex items-center gap-3 p-3">
        {/* Cover Art / Play Button */}
        <button
          onClick={handlePlayPause}
          disabled={!playableUrl}
          className="w-14 h-14 rounded-lg flex-shrink-0 relative overflow-hidden bg-muted"
        >
          {track.cover_image_url ? (
            <img
              src={track.cover_image_url}
              alt={track.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Music className="w-6 h-6 text-muted-foreground" />
            </div>
          )}
          {playableUrl && (
            <div className="absolute inset-0 bg-background/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              {isPlaying ? (
                <Pause className="w-5 h-5 text-foreground" />
              ) : (
                <Play className="w-5 h-5 text-foreground" />
              )}
            </div>
          )}
          {!hasAccess && (
            <div className="absolute bottom-1 right-1">
              <Lock className="w-3 h-3 text-amber-400" />
            </div>
          )}
        </button>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground truncate text-sm">{track.title}</p>
          {track.description && (
            <p className="text-xs text-muted-foreground truncate">{track.description}</p>
          )}
          <div className="flex items-center gap-2 mt-1">
            {!hasAccess && !isOwner && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {!hasAccess && price > 0
                  ? `$${(price / 100).toFixed(2)}`
                  : "Exclusive"}
              </Badge>
            )}
            {hasAccess && !isOwner && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                <Unlock className="w-2.5 h-2.5 mr-0.5" /> Unlocked
              </Badge>
            )}
            {!track.is_published && isOwner && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                Draft
              </Badge>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {!hasAccess && !isOwner && purchaseRule && (
            <Button
              size="sm"
              variant="default"
              className="text-xs h-8"
              onClick={() => onPurchase?.(track, purchaseRule)}
            >
              <DollarSign className="w-3 h-3 mr-1" />
              Buy
            </Button>
          )}
          {isOwner && (
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onTogglePublish}
                title={track.is_published ? "Unpublish" : "Publish"}
              >
                {track.is_published ? (
                  <EyeOff className="w-3.5 h-3.5" />
                ) : (
                  <Eye className="w-3.5 h-3.5" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Unlock options for non-owners without access */}
      {!hasAccess && !isOwner && trackRules.length > 0 && (
        <div className="px-3 pb-3 pt-0">
          <div className="flex flex-wrap gap-1.5">
            {trackRules
              .filter((r) => r.rule_type !== "purchase")
              .map((rule) => (
                <Badge
                  key={rule.id}
                  variant="outline"
                  className="text-[10px] cursor-pointer hover:bg-accent/20"
                  onClick={() => onPurchase?.(track, rule)}
                >
                  {rule.label || rule.rule_type}
                </Badge>
              ))}
          </div>
        </div>
      )}
    </motion.div>
  );
};
