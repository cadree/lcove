import { useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronRight, Music, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMusicProfile } from "@/hooks/useMusicProfile";
import { useExclusiveTracks } from "@/hooks/useExclusiveMusic";
import { useMusicCheckoutReturn } from "@/hooks/useMusicCheckoutReturn";
import { buildReleases, listenOnServices, profileLinks } from "@/lib/musicCatalog";
import { ListenOnRow } from "./ListenOnRow";
import { RecordSleeve } from "./RecordSleeve";

interface MusicProfileBlockProps {
  userId?: string;
  onConnectClick?: () => void;
}

const PREVIEW_COUNT = 4;

/**
 * The profile's music card: artist, one row of equal covers, one "Listen on"
 * row, and a way into the full catalog page.
 */
export const MusicProfileBlock = ({ userId, onConnectClick }: MusicProfileBlockProps) => {
  const { musicProfile, isLoading, isOwner } = useMusicProfile(userId);
  const targetUserId = userId || musicProfile?.user_id;
  const { tracks, hasAccess, isLoading: tracksLoading } = useExclusiveTracks(targetUserId);
  // Stripe checkout and payout setup come back to the profile.
  useMusicCheckoutReturn(isOwner);

  const services = useMemo(() => (musicProfile ? listenOnServices(profileLinks(musicProfile)) : []), [musicProfile]);
  const releases = useMemo(
    () => buildReleases(musicProfile?.albums ?? [], musicProfile?.top_tracks ?? []),
    [musicProfile],
  );

  if (isLoading || tracksLoading) {
    return (
      <div className="glass-strong rounded-xl p-6 animate-pulse">
        <div className="h-6 bg-muted rounded w-1/4 mb-4" />
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: PREVIEW_COUNT }, (_, i) => <div key={i} className="aspect-square rounded bg-muted" />)}
        </div>
      </div>
    );
  }

  const covers = [
    ...releases.map((r) => ({ key: r.key, title: r.title, cover: r.cover, locked: null as null | boolean })),
    ...tracks.map((t) => ({ key: t.id, title: t.title, cover: t.cover_image_url || undefined, locked: !hasAccess(t.id) })),
  ];
  const total = covers.length;
  const hasAnything = !!musicProfile || total > 0;

  if (!hasAnything) {
    if (!userId || !isOwner) return null;
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-strong rounded-xl p-5 text-center"
        data-testid="music-empty-owner"
      >
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/15">
          <Music className="h-6 w-6 text-primary" />
        </div>
        <h3 className="font-display text-lg font-medium text-foreground">Add your music</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste a Spotify, Apple Music, SoundCloud or YouTube link. Visitors get your catalog right from your profile.
        </p>
        <Button className="mt-4 min-h-11 w-full sm:w-auto" onClick={onConnectClick} data-testid="music-connect-cta">
          <Plus className="mr-1.5 h-4 w-4" /> Connect music
        </Button>
        <p className="mt-2 text-[11px] text-muted-foreground/80">Only you see this until you add something.</p>
      </motion.div>
    );
  }

  const name = musicProfile?.display_name || "Music";
  const musicPath = `/profile/${targetUserId}/music`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-strong rounded-xl overflow-hidden"
      data-testid="music-profile-block"
    >
      <div className="p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-3">
          {musicProfile?.artist_image_url ? (
            <img
              src={musicProfile.artist_image_url}
              alt={name}
              className="w-14 h-14 rounded-full object-cover border-2 border-primary/30 shrink-0"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <Music className="w-7 h-7 text-primary" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Music</p>
            <h3 className="font-display text-lg font-medium text-foreground truncate">{name}</h3>
            {musicProfile?.genres && musicProfile.genres.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {musicProfile.genres.slice(0, 3).map((genre) => (
                  <Badge key={genre} variant="secondary" className="text-[10px] px-1.5 py-0">{genre}</Badge>
                ))}
              </div>
            )}
          </div>
          {isOwner && (
            <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" aria-label="Edit music links" onClick={onConnectClick} data-testid="music-edit">
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </div>

        {total > 0 && (
          <Link to={musicPath} className="grid grid-cols-4 gap-2" aria-label={`Open ${name}'s music`} data-testid="music-preview-covers">
            {covers.slice(0, PREVIEW_COUNT).map((item) =>
              item.locked === null ? (
                <div key={item.key} className="aspect-square overflow-hidden rounded-md bg-muted shadow-md ring-1 ring-white/5">
                  {item.cover ? (
                    <img src={item.cover} alt={item.title} draggable={false} loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center"><Music className="h-5 w-5 text-muted-foreground" /></div>
                  )}
                </div>
              ) : (
                <RecordSleeve key={item.key} cover={item.cover} title={item.title} open={!item.locked} sealLabel=" " />
              ),
            )}
          </Link>
        )}

        <ListenOnRow services={services} />

        {total > 0 ? (
          <Button asChild variant="outline" className="w-full min-h-11 justify-between" data-testid="music-open-catalog">
            <Link to={musicPath}>
              <span>{isOwner ? "Open and arrange your music" : "See all music"}</span>
              <span className="flex items-center gap-1 text-muted-foreground">
                {total} <ChevronRight className="h-4 w-4" />
              </span>
            </Link>
          </Button>
        ) : (
          isOwner && (
            <Button asChild variant="outline" className="w-full min-h-11" data-testid="music-open-catalog">
              <Link to={musicPath}>Open your music page</Link>
            </Button>
          )
        )}
      </div>
    </motion.div>
  );
};

export default MusicProfileBlock;
