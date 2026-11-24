import { useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { MUSIC_PLATFORM_LABELS, musicEmbedFor } from "@/lib/musicLinks";
import { openMusicLink, type CatalogRelease } from "@/lib/musicCatalog";
import { MusicServiceIcon } from "./ListenOnRow";

const metaLine = (release: CatalogRelease) => [release.releaseType, release.year].filter(Boolean).join(" · ");

const Cover = ({ release, className }: { release: CatalogRelease; className?: string }) =>
  release.cover ? (
    <img src={release.cover} alt={release.title} draggable={false} loading="lazy" className={className} />
  ) : (
    <div className={`${className} flex items-center justify-center bg-muted`}>
      <Music className="h-8 w-8 text-muted-foreground" />
    </div>
  );

const TrackList = ({ tracks, limit }: { tracks: string[]; limit?: number }) => {
  if (tracks.length === 0) return null;
  const shown = limit ? tracks.slice(0, limit) : tracks;
  return (
    <ol className="space-y-0.5 text-[11px] leading-snug text-muted-foreground">
      {shown.map((name, i) => (
        <li key={`${i}-${name}`} className="flex gap-2 truncate">
          <span className="w-4 shrink-0 tabular-nums text-muted-foreground/60">{String(i + 1).padStart(2, "0")}</span>
          <span className="truncate">{name}</span>
        </li>
      ))}
      {limit && tracks.length > limit && <li className="pl-6 text-muted-foreground/70">+{tracks.length - limit} more</li>}
    </ol>
  );
};

/**
 * A linked release as a poster card: square cover, then type and year, title,
 * album and the track list when the link reader returned one. Tapping opens the
 * release with its official player.
 */
export const CatalogReleaseCard = ({ release, footer }: { release: CatalogRelease; footer?: React.ReactNode }) => {
  const [open, setOpen] = useState(false);
  const meta = metaLine(release);
  const embed = open && release.url ? musicEmbedFor(release.url, { native: Capacitor.isNativePlatform() }) : null;
  const service = release.platform && release.platform !== "other" ? MUSIC_PLATFORM_LABELS[release.platform] : null;

  return (
    <article className="flex h-full min-w-0 flex-col" data-testid="catalog-release">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group block w-full text-left"
        aria-label={`Open ${release.title}`}
      >
        <div className="aspect-square w-full overflow-hidden rounded-md bg-muted shadow-[0_10px_24px_rgba(0,0,0,0.35)] ring-1 ring-white/5">
          <Cover release={release} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        </div>
        <div className="mt-2.5 space-y-0.5">
          {meta && <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{meta}</p>}
          <h4 className="font-display text-sm font-medium leading-tight text-foreground line-clamp-2">{release.title}</h4>
          {release.album && <p className="truncate text-xs text-muted-foreground">{release.album}</p>}
        </div>
      </button>
      {release.tracks.length > 0 && (
        <div className="mt-2">
          <TrackList tracks={release.tracks} limit={4} />
        </div>
      )}
      {footer && <div className="mt-auto pt-2">{footer}</div>}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[90dvh] px-5 pb-8 pt-6" data-testid="release-sheet">
          <div className="mx-auto w-full max-w-md space-y-4">
            <div className="flex gap-4">
              <Cover release={release} className="h-28 w-28 shrink-0 rounded-md object-cover shadow-lg" />
              <div className="min-w-0 flex-1 pr-8">
                {meta && <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{meta}</p>}
                <SheetTitle className="font-display text-xl leading-tight">{release.title}</SheetTitle>
                <SheetDescription className="truncate">{release.album || (service ? `On ${service}` : "Linked release")}</SheetDescription>
              </div>
            </div>
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
              />
            )}
            {release.tracks.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Tracks</p>
                <TrackList tracks={release.tracks} />
              </div>
            )}
            {release.url && (
              <Button variant="outline" className="min-h-11 w-full gap-2" onClick={() => openMusicLink(release.url)}>
                <MusicServiceIcon platform={release.platform} />
                {service ? `Open in ${service}` : "Open link"}
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </article>
  );
};

export default CatalogReleaseCard;
