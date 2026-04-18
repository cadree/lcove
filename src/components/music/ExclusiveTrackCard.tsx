import { motion } from "framer-motion";
import { Lock, Music, DollarSign, Trash2, Eye, EyeOff, Bookmark, BookmarkCheck, Download, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import type { ExclusiveTrack, ExclusiveAccessRule } from "@/hooks/useExclusiveMusic";
import {
  useMyPurchases,
  useMySaves,
  useMusicLibraryMutations,
  downloadTrack,
} from "@/hooks/useMusicLibrary";
import { PreviewPlayer } from "./PreviewPlayer";
import { toast } from "sonner";

interface ExclusiveTrackCardProps {
  track: ExclusiveTrack;
  hasAccess: boolean;
  isOwner: boolean;
  rules: ExclusiveAccessRule[];
  payoutEnabled?: boolean;
  onDelete?: () => void;
  onTogglePublish?: () => void;
  onPurchase?: (track: ExclusiveTrack, rule: ExclusiveAccessRule) => void;
}

export const ExclusiveTrackCard = ({
  track,
  hasAccess,
  isOwner,
  rules,
  payoutEnabled = true,
  onDelete,
  onTogglePublish,
  onPurchase,
}: ExclusiveTrackCardProps) => {
  const { user } = useAuth();
  const { data: purchases = [] } = useMyPurchases();
  const { data: saves = [] } = useMySaves();
  const { saveTrack, unsaveTrack, toggleAddToProfile } = useMusicLibraryMutations();

  const trackRules = rules.filter(
    (r) => r.track_id === track.id || r.track_id === null
  );
  const purchaseRule = trackRules.find((r) => r.rule_type === "purchase");
  const subscriptionRule = trackRules.find((r) => r.rule_type === "subscription");
  const price = purchaseRule?.amount_cents ?? track.price_cents ?? 0;

  const ownsTrack = purchases.some((p) => p.track_id === track.id);
  const fullAccess = hasAccess || ownsTrack || isOwner;
  const save = saves.find((s) => s.track_id === track.id);
  const isSaved = !!save;
  const isOnProfile = !!save?.added_to_profile;

  const previewUrl = track.preview_clip_url || track.audio_file_url || "";
  const fullUrl = track.audio_file_url || "";

  const statusBadge = (() => {
    if (isOwner) return { label: track.is_published ? "Published" : "Draft", variant: "outline" as const };
    if (fullAccess) return { label: "Unlocked", variant: "secondary" as const };
    if (price > 0) return { label: `$${(price / 100).toFixed(2)}`, variant: "default" as const };
    if (subscriptionRule) return { label: "Subscribers", variant: "outline" as const };
    return { label: "Exclusive", variant: "outline" as const };
  })();

  const handleDownload = () => {
    if (!fullUrl) return;
    downloadTrack(fullUrl, `${track.title}.mp3`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-xl overflow-hidden bg-card border border-border/40 flex flex-col",
        !track.is_published && isOwner && "opacity-70 border-dashed"
      )}
    >
      {/* Cover */}
      <div className="aspect-square relative bg-muted">
        {track.cover_image_url ? (
          <img src={track.cover_image_url} alt={track.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Music className="w-10 h-10 text-muted-foreground" />
          </div>
        )}
        <div className="absolute top-2 right-2">
          <Badge variant={statusBadge.variant} className="text-[10px] backdrop-blur-sm">
            {!fullAccess && <Lock className="w-2.5 h-2.5 mr-1" />}
            {statusBadge.label}
          </Badge>
        </div>
      </div>

      {/* Info */}
      <div className="p-3 space-y-2.5 flex-1 flex flex-col">
        <div>
          <p className="font-medium text-foreground text-sm truncate">{track.title}</p>
          {track.description && (
            <p className="text-xs text-muted-foreground line-clamp-1">{track.description}</p>
          )}
        </div>

        {/* Preview / Player */}
        {previewUrl && (
          <PreviewPlayer
            audioUrl={fullAccess ? fullUrl : previewUrl}
            startSeconds={track.preview_start_seconds || 0}
            durationSeconds={track.preview_duration_seconds || 15}
            locked={!fullAccess}
          />
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-1.5 mt-auto pt-1">
          {!fullAccess && !isOwner && purchaseRule && (
            <Button
              size="sm"
              variant="default"
              className="text-xs h-8 flex-1"
              disabled={!payoutEnabled}
              title={!payoutEnabled ? "Artist hasn't enabled payouts yet" : undefined}
              onClick={() => onPurchase?.(track, purchaseRule)}
            >
              <DollarSign className="w-3 h-3 mr-1" />
              Buy {price > 0 ? `$${(price / 100).toFixed(2)}` : ""}
            </Button>
          )}
          {!fullAccess && !isOwner && subscriptionRule && (
            <Button
              size="sm"
              variant={purchaseRule ? "outline" : "default"}
              className="text-xs h-8 flex-1"
              disabled={!payoutEnabled}
              title={!payoutEnabled ? "Artist hasn't enabled payouts yet" : undefined}
              onClick={() => onPurchase?.(track, subscriptionRule)}
            >
              Subscribe ${(subscriptionRule.amount_cents / 100).toFixed(2)}
              {subscriptionRule.interval === "yearly" ? "/yr" : "/mo"}
            </Button>
          )}

          {fullAccess && !isOwner && (
            <>
              <Button
                size="sm"
                variant={isSaved ? "secondary" : "outline"}
                className="text-xs h-8 flex-1"
                onClick={() => {
                  if (!user) return toast.error("Sign in to save tracks");
                  if (isSaved) unsaveTrack.mutate(track.id);
                  else saveTrack.mutate({ trackId: track.id });
                }}
              >
                {isSaved ? <BookmarkCheck className="w-3 h-3 mr-1" /> : <Bookmark className="w-3 h-3 mr-1" />}
                {isSaved ? "Saved" : "Save"}
              </Button>
              <Button
                size="sm"
                variant={isOnProfile ? "default" : "outline"}
                className="text-xs h-8"
                title={isOnProfile ? "Showing on your profile" : "Add to your profile"}
                onClick={() => {
                  if (!user) return toast.error("Sign in first");
                  toggleAddToProfile.mutate({ trackId: track.id, addToProfile: !isOnProfile });
                }}
              >
                <UserPlus className="w-3 h-3" />
              </Button>
              {track.allow_downloads && fullUrl && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-8"
                  onClick={handleDownload}
                  title="Download"
                >
                  <Download className="w-3 h-3" />
                </Button>
              )}
            </>
          )}

          {isOwner && (
            <div className="flex w-full gap-1.5">
              <Button
                variant={track.is_published ? "secondary" : "default"}
                size="sm"
                className="text-xs h-8 flex-1"
                onClick={onTogglePublish}
                title={
                  track.is_published
                    ? "Hide this track from your public profile"
                    : "Make this track visible on your public profile"
                }
              >
                {track.is_published ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5 mr-1" />
                    Unpublish
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5 mr-1" />
                    Publish
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive"
                onClick={onDelete}
                title="Delete track"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>

        {/* Extra unlock options for non-owners without access */}
        {!fullAccess && !isOwner && trackRules.filter((r) => r.rule_type !== "purchase" && r.rule_type !== "subscription").length > 0 && (
          <div className="flex flex-wrap gap-1">
            {trackRules
              .filter((r) => r.rule_type !== "purchase" && r.rule_type !== "subscription")
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
        )}
      </div>
    </motion.div>
  );
};
