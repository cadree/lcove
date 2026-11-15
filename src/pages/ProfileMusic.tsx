import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { motion } from "framer-motion";
import { Check, LayoutList, Loader2, Music, Pencil } from "lucide-react";
import PageLayout from "@/components/layout/PageLayout";
import { BackButton } from "@/components/navigation/BackButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConnectMusicDialog } from "@/components/music/ConnectMusicDialog";
import { ExclusiveMusicSection } from "@/components/music/ExclusiveMusicSection";
import { ListenOnRow } from "@/components/music/ListenOnRow";
import { MusicCatalog } from "@/components/music/MusicCatalog";
import { SavedMusicSection } from "@/components/music/SavedMusicSection";
import { useLockedMusic } from "@/hooks/useLockedMusic";
import { useMusicCatalog } from "@/hooks/useMusicCatalog";
import { useMusicCheckoutReturn } from "@/hooks/useMusicCheckoutReturn";
import { useMusicProfile } from "@/hooks/useMusicProfile";
import { useProfile } from "@/hooks/useProfile";
import { buildReleases, listenOnServices, profileLinks } from "@/lib/musicCatalog";
import { featuredEmbed } from "@/lib/musicLinks";

/** An artist's whole catalog: every release and locked track, in their sections. */
const ProfileMusic = () => {
  const { userId } = useParams<{ userId: string }>();
  const { profile, loading: profileLoading } = useProfile(userId);
  const { musicProfile, isLoading: musicLoading } = useMusicProfile(userId);
  const locked = useLockedMusic(userId);
  const catalog = useMusicCatalog(userId);
  const [arranging, setArranging] = useState(false);
  const [editLinks, setEditLinks] = useState(false);
  useMusicCheckoutReturn(locked.isOwner);

  const links = useMemo(() => (musicProfile ? profileLinks(musicProfile) : []), [musicProfile]);
  const services = useMemo(() => listenOnServices(links), [links]);
  const releases = useMemo(
    () => buildReleases(musicProfile?.albums ?? [], musicProfile?.top_tracks ?? []),
    [musicProfile],
  );
  const embed = useMemo(() => featuredEmbed(links, { native: Capacitor.isNativePlatform() }), [links]);

  const loading = profileLoading || musicLoading || locked.isLoading || catalog.isLoading;
  const name = musicProfile?.display_name || profile?.display_name || "Music";
  const isOwner = locked.isOwner;
  const itemCount = releases.length + locked.tracks.length;

  return (
    <PageLayout showNotificationBell={false}>
      <div className="mx-auto w-full max-w-3xl px-5 pb-10" data-testid="profile-music-page">
        <div className="sticky top-0 z-20 -mx-5 flex items-center gap-2 bg-background/85 px-3 py-2 backdrop-blur-md">
          <BackButton fallback={userId ? `/profile/${userId}` : "/profile"} />
          <p className="flex-1 truncate text-sm font-medium text-foreground">Music</p>
          {isOwner && (
            <>
              <Button variant="ghost" size="sm" className="min-h-11" onClick={() => setEditLinks(true)} data-testid="music-edit-links">
                <Pencil className="mr-1.5 h-4 w-4" /> Links
              </Button>
              <Button
                variant={arranging ? "default" : "outline"}
                size="sm"
                className="min-h-11"
                onClick={() => setArranging((v) => !v)}
                aria-pressed={arranging}
                data-testid="music-arrange"
              >
                {arranging ? <Check className="mr-1.5 h-4 w-4" /> : <LayoutList className="mr-1.5 h-4 w-4" />}
                {arranging ? "Done" : "Arrange"}
              </Button>
            </>
          )}
        </div>

        {loading ? (
          <div className="flex min-h-[50vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !profile && !musicProfile && itemCount === 0 ? (
          <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
            <Music className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">This music page isn't available.</p>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 pt-4">
            <header className="flex items-center gap-4">
              {musicProfile?.artist_image_url || profile?.avatar_url ? (
                <img
                  src={musicProfile?.artist_image_url || profile?.avatar_url || ""}
                  alt={name}
                  className="h-20 w-20 shrink-0 rounded-full object-cover ring-2 ring-primary/30"
                />
              ) : (
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-primary/15">
                  <Music className="h-8 w-8 text-primary" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Catalog</p>
                <h1 className="font-display text-3xl font-medium leading-tight text-foreground break-words">{name}</h1>
                {musicProfile?.genres && musicProfile.genres.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {musicProfile.genres.slice(0, 4).map((genre) => (
                      <Badge key={genre} variant="secondary" className="px-1.5 py-0 text-[10px]">{genre}</Badge>
                    ))}
                  </div>
                )}
              </div>
            </header>

            <ListenOnRow services={services} />

            {embed && (
              <iframe
                key={embed.src}
                src={embed.src}
                title={`${embed.title} player`}
                width="100%"
                height={embed.height}
                loading="lazy"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                referrerPolicy="strict-origin-when-cross-origin"
                className="block w-full rounded-xl border-0 bg-muted/30"
                style={{ height: embed.height }}
                data-testid="music-embed"
              />
            )}

            {userId && <ExclusiveMusicSection userId={userId} />}

            {arranging && (
              <p className="text-xs text-muted-foreground" data-testid="arrange-hint">
                Make sections, rename and reorder them, pick a cover, and choose a section under each cover. Visitors see the result.
              </p>
            )}

            <MusicCatalog releases={releases} locked={locked} catalog={catalog} arranging={arranging} />

            {userId && <SavedMusicSection userId={userId} />}
          </motion.div>
        )}
      </div>
      {isOwner && <ConnectMusicDialog open={editLinks} onOpenChange={setEditLinks} defaultName={profile?.display_name} />}
    </PageLayout>
  );
};

export default ProfileMusic;
