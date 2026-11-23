import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Check, FolderPlus, GripVertical, Headphones, ImagePlus, Lock, MoreHorizontal, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { ExclusiveTrack } from "@/hooks/useExclusiveMusic";
import type { LockedMusic } from "@/hooks/useLockedMusic";
import type { useMusicCatalog } from "@/hooks/useMusicCatalog";
import type { useMusicPagePrefs } from "@/hooks/useMusicPagePrefs";
import { digitalPurchasesEnabled } from "@/lib/platform";
import { groupCatalog, openMusicLink, trackKey, validateSectionTitle, type CatalogRelease, type ListenOn } from "@/lib/musicCatalog";
import { MUSIC_PLATFORM_LABELS } from "@/lib/musicLinks";
import {
  coverUploadProblem, dragSteps, isDjLicense, moveKey, orderKeys, recentFirst, releaseBadge, trackBadge, type RowBadge,
} from "@/lib/musicView";
import { ExclusiveTrackCard } from "./ExclusiveTrackCard";
import { MusicServiceIcon } from "./ListenOnRow";

type Catalog = ReturnType<typeof useMusicCatalog>;
type Prefs = ReturnType<typeof useMusicPagePrefs>;

export interface ViewItem {
  key: string;
  kind: "release" | "track";
  title: string;
  subtitle: string;
  cover?: string;
  badge: RowBadge;
  createdAt?: string;
  year?: string;
  release?: CatalogRelease;
  track?: ExclusiveTrack;
}

const ROW_PX = 64;

interface MusicProfileViewProps {
  userId: string;
  name: string;
  avatarUrl?: string | null;
  handle?: string | null;
  genres: string[];
  releases: CatalogRelease[];
  services: ListenOn[];
  locked: LockedMusic;
  catalog: Catalog;
  prefs: Prefs;
  editing: boolean;
  /** Extra controls the page adds to the owner's edit bar. */
  editExtras?: ReactNode;
  /** Rendered above the tabs, for example a player card. */
  player?: (featured: ViewItem | null, open: (item: ViewItem) => void) => ReactNode;
}

/**
 * Someone's music: their face with reactions, a featured track pill, then Recent
 * and Catalog. Ether-hosted tracks open the existing locked-track card (preview,
 * buy, license, download, all with the server's access rules); linked releases
 * open on the service they came from.
 */
export function MusicProfileView({ userId, name, avatarUrl, handle, genres, releases, services, locked, catalog, prefs, editing, editExtras, player }: MusicProfileViewProps) {
  const [tab, setTab] = useState<"recent" | "catalog">("recent");
  const [openTrack, setOpenTrack] = useState<ExclusiveTrack | null>(null);
  const [editItem, setEditItem] = useState<ViewItem | null>(null);
  const iosApp = !digitalPurchasesEnabled();
  // Arranging happens in Catalog, so Edit opens there.
  useEffect(() => {
    if (editing) setTab("catalog");
  }, [editing]);
  const overrides = prefs.prefs.coverOverrides;

  const items = useMemo(() => {
    const map = new Map<string, ViewItem>();
    for (const release of releases) {
      map.set(release.key, {
        key: release.key,
        kind: "release",
        title: release.title,
        subtitle: [release.releaseType, release.year, release.platform ? MUSIC_PLATFORM_LABELS[release.platform] : null].filter(Boolean).join(" · ") || name,
        cover: overrides[release.key] || release.cover,
        badge: releaseBadge(release.platform),
        year: release.year,
        release,
      });
    }
    for (const track of locked.tracks) {
      const key = trackKey(track.id);
      map.set(key, {
        key,
        kind: "track",
        title: track.title,
        subtitle: `${name} · on Ether`,
        cover: track.cover_image_url || undefined,
        badge: trackBadge(track, locked.rules, { isOwner: locked.isOwner, hasAccess: locked.hasAccess(track.id), iosApp }),
        createdAt: track.created_at,
        track,
      });
    }
    return map;
  }, [releases, locked, name, overrides, iosApp]);

  const all = useMemo(() => [...items.values()], [items]);
  const recent = useMemo(() => recentFirst(all), [all]);
  const featured = (prefs.prefs.featuredKey && items.get(prefs.prefs.featuredKey)) || recent[0] || null;

  const groups = useMemo(() => {
    const refs = all.map((i) => ({ key: i.key, kind: i.kind }));
    const grouped = groupCatalog(refs, catalog.sections, catalog.placements, { includeEmpty: editing });
    const albums = grouped.filter((g) => g.custom);
    const loose = orderKeys(grouped.filter((g) => !g.custom).flatMap((g) => g.keys), prefs.prefs.looseOrder);
    return { albums, loose };
  }, [all, catalog.sections, catalog.placements, editing, prefs.prefs.looseOrder]);

  const open = (item: ViewItem) => {
    if (item.track) setOpenTrack(item.track);
    else openMusicLink(item.release?.url);
  };

  const favorites = groups.albums
    .map((album) => ({ album, cover: album.cover || album.keys.map((k) => items.get(k)?.cover).find(Boolean) }))
    .filter((a) => a.album.keys.length > 0 || editing);
  const favoriteCovers = favorites.length
    ? favorites.map((f) => ({ id: f.album.id, title: f.album.title, cover: f.cover, count: f.album.keys.length }))
    : recent.filter((i) => i.cover).slice(0, 6).map((i) => ({ id: i.key, title: i.title, cover: i.cover, count: 0 }));

  return (
    <div className="space-y-6" data-testid="music-profile-view">
      <header className="flex flex-col items-center pt-2 text-center">
        <div className="relative">
          <div className="h-[118px] w-[118px] overflow-hidden rounded-[34px] border-[3px] border-[var(--mv-line-strong)] bg-[var(--mv-surface)] shadow-[var(--mv-glow)]">
            {avatarUrl ? <img src={avatarUrl} alt={name} className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center font-display text-5xl text-[var(--mv-muted)]">{name.charAt(0)}</span>}
          </div>
          <span aria-hidden="true" className="music-sticker absolute -left-5 -top-3 text-[34px]">😍</span>
          <span aria-hidden="true" className="music-sticker absolute -left-6 top-12 text-[26px] [animation-delay:-1.4s]">☺️</span>
          <span aria-hidden="true" className="music-sticker absolute -bottom-2 -right-5 text-[34px] [animation-delay:-2.6s]">🔥</span>
        </div>
        <h1 className="mt-4 font-display text-[34px] leading-tight text-[var(--mv-text)] [text-shadow:var(--mv-text-glow)]">{name}</h1>
        <p className="mt-0.5 text-sm text-[var(--mv-muted)]">{handle ? `@${handle}` : genres.slice(0, 3).join(" · ") || "Music"}</p>

        {featured && (
          <button
            type="button"
            onClick={() => open(featured)}
            className="music-only-ether mt-5 flex min-h-12 w-full max-w-[420px] items-center justify-center gap-2 rounded-[18px] border border-[var(--mv-line)] bg-[var(--mv-surface)] px-4 text-[15px] text-[var(--mv-text)] backdrop-blur-md"
            data-testid="music-featured"
          >
            <Headphones className="h-5 w-5 shrink-0 text-[var(--mv-accent)]" />
            <span className="truncate font-semibold">{featured.title}</span>
            <span className="truncate text-[var(--mv-muted)]">{featured.kind === "track" ? name : featured.release?.platform ? MUSIC_PLATFORM_LABELS[featured.release.platform] : ""}</span>
          </button>
        )}
        {featured && (
          <p className="music-only-ether mt-2 text-[13px] text-[var(--mv-muted)]">
            {prefs.prefs.featuredKey ? "Featured" : "Latest"} {featured.kind === "track" ? "on Ether" : featured.release?.platform && featured.release.platform !== "other" ? `on ${MUSIC_PLATFORM_LABELS[featured.release.platform]}` : ""}
          </p>
        )}
        {services.length > 0 && (
          <div className="mt-3 flex flex-wrap justify-center gap-2" data-testid="listen-on">
            {services.map((service) => (
              <button
                key={service.platform}
                type="button"
                onClick={() => openMusicLink(service.url)}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[var(--mv-line)] bg-[var(--mv-surface)] px-3.5 text-xs font-medium text-[var(--mv-text)]"
              >
                <MusicServiceIcon platform={service.platform} />
                {service.label}
              </button>
            ))}
          </div>
        )}
      </header>

      {player?.(featured, open)}

      {editing && (
        <OwnerBar catalog={catalog} extras={editExtras} />
      )}

      <div role="tablist" aria-label="Music" className="grid grid-cols-2 rounded-[20px] border border-[var(--mv-line)] bg-[var(--mv-surface)] p-1">
        {(["recent", "catalog"] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`min-h-11 rounded-[16px] text-[13px] font-bold uppercase tracking-[0.08em] transition-colors ${tab === id ? "bg-[var(--mv-tab-on)] text-[var(--mv-text)] shadow-[var(--mv-glow-soft)]" : "text-[var(--mv-muted)]"}`}
          >
            {id === "recent" ? "Recent" : "Catalog"}
          </button>
        ))}
      </div>

      {tab === "recent" ? (
        <section aria-label="Recent" className="space-y-5">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-[var(--mv-text)]">Recently added</h2>
              {recent.length > 4 && (
                <button type="button" className="min-h-11 text-[13px] font-semibold text-[var(--mv-text)]" onClick={() => setTab("catalog")}>See all</button>
              )}
            </div>
            {recent.length ? (
              <ul className="space-y-1">
                {recent.slice(0, 4).map((item) => (
                  <li key={item.key}><TrackRow item={item} onOpen={() => open(item)} /></li>
                ))}
              </ul>
            ) : (
              <p className="py-6 text-center text-sm text-[var(--mv-muted)]">No music here yet.</p>
            )}
          </div>
          {favoriteCovers.length > 0 && (
            <div>
              <h2 className="music-favorites text-center font-display text-[44px] leading-none">{favorites.length ? "Albums" : "Favorites"}</h2>
              <ul className="-mx-4 mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide">
                {favoriteCovers.map((f) => (
                  <li key={f.id} className="w-[132px] shrink-0 snap-start">
                    <button type="button" onClick={() => setTab("catalog")} className="music-tile block w-full text-left">
                      <span className="block aspect-square overflow-hidden rounded-[18px] bg-[var(--mv-surface)]">
                        {f.cover ? <img src={f.cover} alt="" className="h-full w-full object-cover" loading="lazy" /> : null}
                      </span>
                      <span className="mt-1.5 block truncate px-1 text-[13px] font-semibold text-[var(--mv-text)]">{f.title}</span>
                      {f.count > 0 && <span className="block px-1 text-[11px] text-[var(--mv-muted)]">{f.count} {f.count === 1 ? "track" : "tracks"}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      ) : (
        <section aria-label="Catalog" className="space-y-7" data-testid="music-catalog-tab">
          {groups.albums.map((album) => (
            <div key={album.id}>
              <AlbumHeader
                title={album.title}
                cover={album.cover || album.keys.map((k) => items.get(k)?.cover).find(Boolean) || null}
                count={album.keys.length}
                editing={editing}
                userId={userId}
                onCover={(url) => catalog.updateSection.mutate({ id: album.id, cover_url: url })}
                onDelete={() => {
                  if (window.confirm(`Delete the album "${album.title}"? The music in it moves back to your list.`)) catalog.deleteSection.mutate(album.id);
                }}
              />
              {album.keys.length === 0 && editing && (
                <p className="mt-2 text-xs text-[var(--mv-muted)]">Empty. Open ⋯ on any song to move it here.</p>
              )}
              <SortableRows
                keys={album.keys}
                items={items}
                editing={editing}
                onOpen={open}
                onEdit={setEditItem}
                onReorder={(keys) => catalog.reorderItems.mutate(keys)}
              />
            </div>
          ))}
          {groups.loose.length > 0 && (
            <div>
              <h2 className="mb-1 text-[15px] font-semibold text-[var(--mv-text)]">{groups.albums.length ? "Singles and more" : "All music"}</h2>
              <SortableRows
                keys={groups.loose}
                items={items}
                editing={editing}
                onOpen={open}
                onEdit={setEditItem}
                onReorder={(keys) => prefs.save.mutate({ looseOrder: keys })}
              />
            </div>
          )}
          {!groups.albums.length && !groups.loose.length && <p className="py-6 text-center text-sm text-[var(--mv-muted)]">No music here yet.</p>}
        </section>
      )}

      <Sheet open={!!openTrack} onOpenChange={(o) => !o && setOpenTrack(null)}>
        <SheetContent side="bottom" className="mx-auto max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-[28px]">
          <SheetTitle className="font-display text-2xl">{openTrack?.title}</SheetTitle>
          <SheetDescription>{name}</SheetDescription>
          {openTrack && (
            <div className="mx-auto mt-4 max-w-[280px] space-y-3">
              <ExclusiveTrackCard
                track={openTrack}
                hasAccess={locked.hasAccess(openTrack.id)}
                isOwner={locked.isOwner}
                rules={locked.rules}
                payoutEnabled={locked.payoutEnabled}
                onPurchase={locked.handlePurchase}
                sales={locked.sales[openTrack.id]}
              />
              <DjLicense track={openTrack} locked={locked} iosApp={iosApp} />
            </div>
          )}
        </SheetContent>
      </Sheet>

      {editItem && (
        <ItemEditSheet
          item={editItem}
          userId={userId}
          catalog={catalog}
          prefs={prefs}
          locked={locked}
          loose={groups.loose}
          onClose={() => setEditItem(null)}
        />
      )}
    </div>
  );
}

function BadgePill({ badge }: { badge: RowBadge }) {
  const tone: Record<RowBadge["tone"], string> = {
    free: "border-[var(--mv-line)] text-[var(--mv-text)]",
    price: "border-transparent bg-[var(--mv-accent)] text-[var(--mv-on-accent)]",
    license: "border-[var(--mv-accent-2)] text-[var(--mv-accent-2)]",
    members: "border-[var(--mv-line)] text-[var(--mv-accent)]",
    unlocked: "border-[var(--mv-line)] text-[var(--mv-text)]",
    preview: "border-[var(--mv-line)] text-[var(--mv-muted)]",
    draft: "border-dashed border-[var(--mv-line)] text-[var(--mv-muted)]",
  };
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${tone[badge.tone]}`}>
      {(badge.tone === "price" || badge.tone === "members" || badge.tone === "license") && <Lock className="h-3 w-3" aria-hidden />}
      {badge.label}
    </span>
  );
}

function TrackRow({ item, onOpen, editing, grip, onEdit }: { item: ViewItem; onOpen: () => void; editing?: boolean; grip?: ReactNode; onEdit?: () => void }) {
  return (
    <div className="flex h-16 items-center gap-3 rounded-[16px] px-1">
      {editing && grip}
      <button type="button" onClick={onOpen} disabled={editing} className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-default">
        <span className="music-cover block h-12 w-12 shrink-0 overflow-hidden rounded-[12px] bg-[var(--mv-surface)]">
          {item.cover ? <img src={item.cover} alt="" className="h-full w-full object-cover" loading="lazy" /> : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-semibold text-[var(--mv-text)]">{item.title}</span>
          <span className="block truncate text-[13px] text-[var(--mv-muted)]">{item.subtitle}</span>
        </span>
      </button>
      {editing ? (
        <button type="button" onClick={onEdit} aria-label={`Edit ${item.title}`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--mv-text)] hover:bg-[var(--mv-surface)]">
          <MoreHorizontal className="h-5 w-5" />
        </button>
      ) : (
        <BadgePill badge={item.badge} />
      )}
    </div>
  );
}

/** Rows the owner drags by the grip; others shift as it passes. Transform only. */
function SortableRows({ keys, items, editing, onOpen, onEdit, onReorder }: {
  keys: string[];
  items: Map<string, ViewItem>;
  editing: boolean;
  onOpen: (item: ViewItem) => void;
  onEdit: (item: ViewItem) => void;
  onReorder: (keys: string[]) => void;
}) {
  const [drag, setDrag] = useState<{ index: number; dy: number } | null>(null);
  const start = useRef<{ y: number; index: number } | null>(null);
  const steps = drag ? dragSteps(drag.dy, ROW_PX) : 0;
  const target = drag ? Math.max(0, Math.min(keys.length - 1, drag.index + steps)) : -1;
  const shift = (i: number) => {
    if (!drag || i === drag.index) return 0;
    if (drag.index < target && i > drag.index && i <= target) return -ROW_PX;
    if (drag.index > target && i < drag.index && i >= target) return ROW_PX;
    return 0;
  };
  return (
    <ul className="space-y-0">
      {keys.map((key, i) => {
        const item = items.get(key);
        if (!item) return null;
        const dragging = drag?.index === i;
        return (
          <li
            key={key}
            className={`relative ${dragging ? "z-10 rounded-[16px] bg-[var(--mv-surface-strong)] shadow-[0_12px_30px_-12px_rgba(0,0,0,.8)]" : "transition-transform duration-200"}`}
            style={{ transform: `translate3d(0, ${dragging ? drag!.dy : shift(i)}px, 0)` }}
          >
            <TrackRow
              item={item}
              editing={editing}
              onOpen={() => onOpen(item)}
              onEdit={() => onEdit(item)}
              grip={
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={`Drag to reorder ${item.title}. Arrow keys move it.`}
                  className="flex h-11 w-8 shrink-0 cursor-grab touch-none items-center justify-center text-[var(--mv-muted)]"
                  onKeyDown={(e) => {
                    if (e.key === "ArrowUp" && i > 0) onReorder(moveKey(keys, i, i - 1));
                    if (e.key === "ArrowDown" && i < keys.length - 1) onReorder(moveKey(keys, i, i + 1));
                  }}
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture?.(e.pointerId);
                    start.current = { y: e.clientY, index: i };
                    setDrag({ index: i, dy: 0 });
                  }}
                  onPointerMove={(e) => {
                    if (!start.current) return;
                    setDrag({ index: start.current.index, dy: e.clientY - start.current.y });
                  }}
                  onPointerUp={() => {
                    const from = start.current;
                    start.current = null;
                    if (from && drag) {
                      const to = Math.max(0, Math.min(keys.length - 1, from.index + dragSteps(drag.dy, ROW_PX)));
                      if (to !== from.index) onReorder(moveKey(keys, from.index, to));
                    }
                    setDrag(null);
                  }}
                  onPointerCancel={() => {
                    start.current = null;
                    setDrag(null);
                  }}
                >
                  <GripVertical className="h-5 w-5" />
                </span>
              }
            />
          </li>
        );
      })}
    </ul>
  );
}

async function uploadCover(file: File, userId: string): Promise<string | null> {
  const problem = coverUploadProblem(file);
  if (problem) {
    toast.error(problem);
    return null;
  }
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${userId}/music-cover-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("media").upload(path, file, { upsert: false, contentType: file.type || undefined });
  if (error) {
    toast.error(`Cover did not upload: ${error.message}`);
    return null;
  }
  return supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
}

function CoverPicker({ userId, onPicked, children, className }: { userId: string; onPicked: (url: string) => void; children: ReactNode; className?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button type="button" className={className} disabled={busy} onClick={() => input.current?.click()}>
        {busy ? "Uploading…" : children}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setBusy(true);
          const url = await uploadCover(file, userId).finally(() => setBusy(false));
          if (url) onPicked(url);
        }}
      />
    </>
  );
}

function AlbumHeader({ title, cover, count, editing, userId, onCover, onDelete }: {
  title: string; cover: string | null; count: number; editing: boolean; userId: string; onCover: (url: string) => void; onDelete: () => void;
}) {
  return (
    <div className="mb-1 flex items-center gap-3">
      <span className="music-tile block h-14 w-14 shrink-0 overflow-hidden rounded-[14px] bg-[var(--mv-surface)]">
        {cover && <img src={cover} alt="" className="h-full w-full object-cover" />}
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="truncate font-display text-[22px] leading-tight text-[var(--mv-text)]">{title}</h2>
        <p className="text-xs text-[var(--mv-muted)]">{count} {count === 1 ? "track" : "tracks"}</p>
      </div>
      {editing && (
        <>
          <CoverPicker userId={userId} onPicked={onCover} className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--mv-text)] hover:bg-[var(--mv-surface)]">
            <ImagePlus className="h-5 w-5" aria-label={`Change cover for ${title}`} />
          </CoverPicker>
          <button type="button" onClick={onDelete} aria-label={`Delete album ${title}`} className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--mv-muted)] hover:bg-[var(--mv-surface)]">
            <Trash2 className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  );
}

function OwnerBar({ catalog, extras }: { catalog: Catalog; extras?: ReactNode }) {
  const [title, setTitle] = useState("");
  const add = () => {
    const checked = validateSectionTitle(title);
    if ("message" in checked) {
      toast.error(checked.message);
      return;
    }
    catalog.createSection.mutate(checked.title, { onSuccess: () => setTitle("") });
  };
  return (
    <div className="space-y-3 rounded-[22px] border border-dashed border-[var(--mv-line)] p-3" data-testid="music-owner-bar">
      <p className="text-xs text-[var(--mv-muted)]">Drag the grip to reorder. Open ⋯ on a song to move it into an album, change its cover or feature it.</p>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New album name" className="min-h-11 flex-1 border-[var(--mv-line)] bg-transparent text-[var(--mv-text)]" maxLength={60} />
        <Button type="submit" disabled={!title.trim() || catalog.busy} className="min-h-11 bg-[var(--mv-accent)] text-[var(--mv-on-accent)] hover:bg-[var(--mv-accent)]">
          <FolderPlus className="mr-1.5 h-4 w-4" /> Album
        </Button>
      </form>
      {extras}
    </div>
  );
}

function ItemEditSheet({ item, userId, catalog, prefs, locked, loose, onClose }: {
  item: ViewItem; userId: string; catalog: Catalog; prefs: Prefs; locked: LockedMusic; loose: string[]; onClose: () => void;
}) {
  const placement = catalog.placements.find((p) => p.item_key === item.key);
  const featured = prefs.prefs.featuredKey === item.key;
  const looseIndex = loose.indexOf(item.key);
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="mx-auto w-full max-w-lg rounded-t-[28px]">
        <SheetTitle className="font-display text-2xl">{item.title}</SheetTitle>
        <SheetDescription>{item.kind === "track" ? "Hosted on Ether" : "Linked release"}</SheetDescription>
        <div className="mt-4 space-y-3">
          <label className="block text-sm font-medium">
            Album
            <select
              className="mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={placement?.section_id ?? ""}
              disabled={catalog.busy}
              onChange={(e) => {
                catalog.placeItem.mutate({ itemKey: item.key, sectionId: e.target.value || null, trackId: item.track?.id });
              }}
            >
              <option value="">Not in an album</option>
              {catalog.sections.map((s) => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </select>
          </label>
          <CoverPicker
            userId={userId}
            className="flex min-h-11 w-full items-center gap-2 rounded-md border border-input px-3 text-sm"
            onPicked={(url) => {
              if (item.track) locked.updateTrack.mutate({ id: item.track.id, cover_image_url: url });
              else prefs.save.mutate({ coverOverrides: { ...prefs.prefs.coverOverrides, [item.key]: url } });
              onClose();
            }}
          >
            <ImagePlus className="h-4 w-4" /> Change cover art
          </CoverPicker>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full justify-start gap-2"
            onClick={() => {
              prefs.save.mutate({ featuredKey: featured ? null : item.key });
              onClose();
            }}
          >
            {featured ? <Check className="h-4 w-4" /> : <Star className="h-4 w-4" />}
            {featured ? "Featured (tap to unfeature)" : "Feature at the top"}
          </Button>
          {looseIndex >= 0 && !placement && (
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" className="min-h-11" disabled={looseIndex === 0} onClick={() => prefs.save.mutate({ looseOrder: moveKey(loose, looseIndex, looseIndex - 1) })}>
                <ArrowUp className="mr-1.5 h-4 w-4" /> Up
              </Button>
              <Button type="button" variant="outline" className="min-h-11" disabled={looseIndex === loose.length - 1} onClick={() => prefs.save.mutate({ looseOrder: moveKey(loose, looseIndex, looseIndex + 1) })}>
                <ArrowDown className="mr-1.5 h-4 w-4" /> Down
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** A DJ license is a purchase rule on the track; checkout and access stay with the server. */
function DjLicense({ track, locked, iosApp }: { track: ExclusiveTrack; locked: LockedMusic; iosApp: boolean }) {
  const { user } = useAuth();
  const rule = locked.rules.find((r) => r.track_id === track.id && isDjLicense(r));
  if (!rule || locked.isOwner || iosApp || !user) return null;
  // When the license is the track's only purchase rule, the card's own Buy button already sells it.
  const cardRule = locked.rules.filter((r) => r.track_id === track.id || r.track_id == null).find((r) => r.rule_type === "purchase");
  if (cardRule === rule) return null;
  return (
    <Button type="button" variant="outline" className="min-h-11 w-full" disabled={!locked.payoutEnabled} onClick={() => void locked.handlePurchase(track, rule)}>
      <Lock className="mr-1.5 h-4 w-4" /> {rule.label || "DJ license"} ${(rule.amount_cents / 100).toFixed(2)}
    </Button>
  );
}
