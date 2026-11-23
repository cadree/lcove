import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { Check, Loader2, Music, Pencil, SlidersHorizontal } from "lucide-react";
import PageLayout from "@/components/layout/PageLayout";
import { BackButton } from "@/components/navigation/BackButton";
import { Button } from "@/components/ui/button";
import { ConnectMusicDialog } from "@/components/music/ConnectMusicDialog";
import { ExclusiveMusicSection } from "@/components/music/ExclusiveMusicSection";
import { MusicProfileView } from "@/components/music/MusicProfileView";
import { SavedMusicSection } from "@/components/music/SavedMusicSection";
import { useLockedMusic } from "@/hooks/useLockedMusic";
import { useMusicCatalog } from "@/hooks/useMusicCatalog";
import { useMusicCheckoutReturn } from "@/hooks/useMusicCheckoutReturn";
import { useMusicPagePrefs } from "@/hooks/useMusicPagePrefs";
import { useMusicProfile } from "@/hooks/useMusicProfile";
import { useProfile } from "@/hooks/useProfile";
import { buildReleases, listenOnServices, profileLinks } from "@/lib/musicCatalog";
import { featuredEmbed } from "@/lib/musicLinks";

/** An artist's music: the profile view (Recent and Catalog), official embeds, and the owner's tools. */
const ProfileMusic = () => {
  const { userId } = useParams<{ userId: string }>();
  const { profile, loading: profileLoading } = useProfile(userId);
  const { musicProfile, isLoading: musicLoading } = useMusicProfile(userId);
  const locked = useLockedMusic(userId);
  const catalog = useMusicCatalog(userId);
  const prefs = useMusicPagePrefs(userId);
  const [editing, setEditing] = useState(false);
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
      <div className="mx-auto w-full max-w-3xl px-3 pb-10" data-testid="profile-music-page">
        <div className="sticky top-0 z-20 -mx-3 flex items-center gap-2 bg-background/85 px-3 py-2 backdrop-blur-md">
          <BackButton fallback={userId ? `/profile/${userId}` : "/profile"} />
          <p className="flex-1 truncate text-sm font-medium text-foreground">Music</p>
          {isOwner && (
            <>
              <Button variant="ghost" size="sm" className="min-h-11" onClick={() => setEditLinks(true)} data-testid="music-edit-links">
                <Pencil className="mr-1.5 h-4 w-4" /> Links
              </Button>
              <Button
                variant={editing ? "default" : "outline"}
                size="sm"
                className="min-h-11"
                onClick={() => setEditing((v) => !v)}
                aria-pressed={editing}
                data-testid="music-edit-mode"
              >
                {editing ? <Check className="mr-1.5 h-4 w-4" /> : <SlidersHorizontal className="mr-1.5 h-4 w-4" />}
                {editing ? "Done" : "Edit"}
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
          <div className="music-view mt-2 space-y-6 rounded-[32px] px-4 pb-6 pt-5" data-look="ether">
            {userId && (
              <MusicProfileView
                userId={userId}
                name={name}
                avatarUrl={musicProfile?.artist_image_url || profile?.avatar_url}
                handle={profile?.username}
                genres={musicProfile?.genres ?? []}
                releases={releases}
                services={services}
                locked={locked}
                catalog={catalog}
                prefs={prefs}
                editing={editing && isOwner}
              />
            )}

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
                className="block w-full rounded-[20px] border-0 bg-[var(--mv-surface)]"
                style={{ height: embed.height }}
                data-testid="music-embed"
              />
            )}
          </div>
        )}
        {!loading && userId && (
          <div className="mt-6 space-y-6">
            <ExclusiveMusicSection userId={userId} hideOwnerEmpty={!editing} />
            <SavedMusicSection userId={userId} />
          </div>
        )}
      </div>
      {isOwner && <ConnectMusicDialog open={editLinks} onOpenChange={setEditLinks} defaultName={profile?.display_name} />}
    </PageLayout>
  );
};

export default ProfileMusic;
