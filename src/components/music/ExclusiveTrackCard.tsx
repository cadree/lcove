import { useState } from "react";
import { motion } from "framer-motion";
import { Lock, DollarSign, Trash2, Eye, EyeOff, Bookmark, BookmarkCheck, Download, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { usePrivateTrackUrl, type ExclusiveTrack, type ExclusiveAccessRule } from "@/hooks/useExclusiveMusic";
import { isFreeMusicTrack, type TrackSales } from "@/lib/lockedMusic";
import {
  useMyPurchases,
  useMySaves,
  useMusicLibraryMutations,
  downloadTrack,
} from "@/hooks/useMusicLibrary";
import { PreviewPlayer } from "./PreviewPlayer";
import { RecordSleeve } from "./RecordSleeve";
import { IosDigitalGoodsNotice } from "@/components/ios/IosDigitalGoodsNotice";
import { digitalPurchasesEnabled } from "@/lib/platform";
import { toast } from "sonner";
import { canDownloadMusic } from "../../../supabase/functions/_shared/music-download.mjs";

interface ExclusiveTrackCardProps {
  track: ExclusiveTrack;
  hasAccess: boolean;
  isOwner: boolean;
  rules: ExclusiveAccessRule[];
  payoutEnabled?: boolean;
  onDelete?: () => void;
  onTogglePublish?: () => void;
  /** rule is null for a plain purchase at the track's own price. */
  onPurchase?: (track: ExclusiveTrack, rule: ExclusiveAccessRule | null) => void;
  /** Owner only: paid sales and refunds for this track. */
  sales?: TrackSales;
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
  sales,
}: ExclusiveTrackCardProps) => {
  const { user } = useAuth();
  const [playing, setPlaying] = useState(false);
  const { data: purchases = [] } = useMyPurchases();
  const { data: saves = [] } = useMySaves();
  const { saveTrack, unsaveTrack, toggleAddToProfile } = useMusicLibraryMutations();

  const freeListening = isFreeMusicTrack(track);
  const trackRules = freeListening ? [] : rules.filter(
    (r) => r.is_active && (r.track_id === track.id || r.track_id === null)
  );
  const purchaseRule = trackRules.find((r) => r.rule_type === "purchase");
  const subscriptionRule = trackRules.find((r) => r.rule_type === "subscription");
  // Same order as the checkout function: a purchase rule's amount, else the track price.
  const ruleAmount = purchaseRule?.amount_cents ?? 0;
  const price = ruleAmount > 0 ? ruleAmount : track.price_cents ?? 0;

  const ownsTrack = purchases.some((p) => p.track_id === track.id);
  const fullAccess = freeListening || hasAccess || ownsTrack || isOwner;
  const canDownload = canDownloadMusic(track, purchases.find((p) => p.track_id === track.id), user?.id);
  const save = saves.find((s) => s.track_id === track.id);
  const isSaved = !!save;
  const isOnProfile = !!save?.added_to_profile;

  // New tracks: the full file is private and reached through a signed URL that
  // storage only issues to the artist, paid buyers and subscribers. Older tracks
  // still carry a public audio_file_url until the ops move runs.
  const privateUrl = usePrivateTrackUrl(track, fullAccess);
  const fullUrl = track.audio_file_path ? privateUrl.data || "" : track.audio_file_url || "";
  const clipUrl = track.preview_clip_url || "";
  const previewUrl = clipUrl || (track.audio_file_path ? "" : track.audio_file_url || "");
  // A stored clip already is the preview window; only a full legacy file needs the seek.
  const previewStart = clipUrl ? 0 : track.preview_start_seconds || 0;

  const isPaid = price > 0;
  const iosApp = !digitalPurchasesEnabled();
  const showPaidUnlock = !fullAccess && !isOwner && (isPaid || !!subscriptionRule);
  const statusBadge = (() => {
    if (isOwner) return { label: track.is_published ? "Published" : "Draft", variant: "outline" as const };
    if (freeListening) return { label: "Free listening", variant: "secondary" as const };
    if (fullAccess) return { label: "Unlocked", variant: "secondary" as const };
    if (isPaid) return { label: iosApp ? "Exclusive" : `$${(price / 100).toFixed(2)}`, variant: iosApp ? "outline" as const : "default" as const };
    if (subscriptionRule) return { label: "Subscribers", variant: "outline" as const };
    return { label: "Exclusive", variant: "outline" as const };
  })();

  const handleDownload = () => {
    if (canDownload) void downloadTrack(track.id);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "h-full min-w-0 flex flex-col",
        !track.is_published && isOwner && "opacity-70"
      )}
    >
      {/* Cover: a sealed sleeve until unlocked, then the record slides out */}
      <div className="relative">
        <RecordSleeve
          cover={track.cover_image_url}
          title={track.title}
          open={fullAccess}
          spinning={playing}
          sealLabel={statusBadge.label}
        />
        {isOwner && (
          <div className="absolute top-1 right-1">
            <Badge variant={statusBadge.variant} className="text-[10px] backdrop-blur-sm">
              {statusBadge.label}
            </Badge>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="pt-2.5 space-y-2.5 flex-1 flex flex-col">
        <div className="space-y-0.5">
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            {freeListening ? "Free listening" : fullAccess && !isOwner ? "Unlocked" : "Exclusive"}
          </p>
          <p className="font-display font-medium text-foreground text-sm truncate">{track.title}</p>
          {track.description && (
            <p className="text-xs text-muted-foreground line-clamp-1">{track.description}</p>
          )}
        </div>

        {/* Preview / Player */}
        {fullAccess && fullUrl ? (
          <PreviewPlayer audioUrl={fullUrl} locked={false} onPlayingChange={setPlaying} />
        ) : previewUrl ? (
          <PreviewPlayer
            audioUrl={previewUrl}
            startSeconds={previewStart}
            durationSeconds={track.preview_duration_seconds || 15}
            locked
            onPlayingChange={setPlaying}
          />
        ) : null}
        {fullAccess && track.audio_file_path && privateUrl.isLoading && (
          <p className="text-[11px] text-muted-foreground">Loading your track…</p>
        )}
        {fullAccess && track.audio_file_path && privateUrl.isError && (
          <p className="text-[11px] text-destructive">Couldn't load the track. Refresh to try again.</p>
        )}
        {!fullAccess && !previewUrl && (
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Lock className="w-3 h-3" /> No preview for this track
          </p>
        )}
        {isOwner && sales && (sales.sold > 0 || sales.refunded > 0) && (
          <p className="text-[11px] text-muted-foreground" data-testid="track-sales">
            {sales.sold} sold · ${(sales.grossCents / 100).toFixed(2)}
            {sales.refunded > 0 ? ` · ${sales.refunded} refunded` : ""}
          </p>
        )}
        {isOwner && !freeListening && (!sales || (sales.sold === 0 && sales.refunded === 0)) && track.is_published && (
          <p className="text-[11px] text-muted-foreground" data-testid="track-sales">No sales yet</p>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-1.5 mt-auto pt-1">
          {showPaidUnlock && iosApp && <IosDigitalGoodsNotice variant="short" className="w-full" />}
          {!iosApp && !fullAccess && !isOwner && isPaid && (
            <Button
              size="sm"
              variant="default"
              className="text-xs min-h-11 flex-1"
              disabled={!payoutEnabled}
              title={!payoutEnabled ? "Artist hasn't enabled payouts yet" : undefined}
              onClick={() => onPurchase?.(track, purchaseRule ?? null)}
            >
              <DollarSign className="w-3 h-3 mr-1" />
              Buy ${(price / 100).toFixed(2)}
            </Button>
          )}
          {!iosApp && !fullAccess && !isOwner && subscriptionRule && (
            <Button
              size="sm"
              variant={isPaid ? "outline" : "default"}
              className="text-xs min-h-11 flex-1"
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
                className="text-xs min-h-11 flex-1"
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
                className="text-xs min-h-11"
                title={isOnProfile ? "Showing on your profile" : "Add to your profile"}
                onClick={() => {
                  if (!user) return toast.error("Sign in first");
                  toggleAddToProfile.mutate({ trackId: track.id, addToProfile: !isOnProfile });
                }}
              >
                <UserPlus className="w-3 h-3" />
              </Button>
              {canDownload && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs min-h-11"
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
                size="icon"
                className="h-11 flex-1 min-w-11"
                onClick={onTogglePublish}
                aria-label={track.is_published ? "Hide from profile" : "Publish to profile"}
                title={
                  track.is_published
                    ? "Hide this track from your public profile"
                    : "Make this track visible on your public profile"
                }
              >
                {track.is_published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 shrink-0 text-destructive"
                aria-label="Delete track"
                onClick={onDelete}
                title="Delete track"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>

        {/* Extra unlock options for non-owners without access */}
        {!iosApp && !fullAccess && !isOwner && trackRules.filter((r) => !["purchase", "subscription"].includes(r.rule_type) && r.amount_cents > 0).length > 0 && (
          <div className="flex flex-wrap gap-1">
            {trackRules
              .filter((r) => !["purchase", "subscription"].includes(r.rule_type) && r.amount_cents > 0)
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
