// cspell:words mixtapes
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Check, ImageIcon, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { ExclusiveTrack } from "@/hooks/useExclusiveMusic";
import type { LockedMusic } from "@/hooks/useLockedMusic";
import type { useMusicCatalog } from "@/hooks/useMusicCatalog";
import {
  SECTION_SUGGESTIONS,
  groupCatalog,
  moveInList,
  trackKey,
  validateSectionTitle,
  type CatalogGroup,
  type CatalogItemRef,
  type CatalogRelease,
} from "@/lib/musicCatalog";
import { CatalogReleaseCard } from "./CatalogReleaseCard";
import { ExclusiveTrackCard } from "./ExclusiveTrackCard";

type Catalog = ReturnType<typeof useMusicCatalog>;

type Entry =
  | { kind: "release"; key: string; release: CatalogRelease; title: string; cover?: string }
  | { kind: "track"; key: string; track: ExclusiveTrack; title: string; cover?: string };

interface MusicCatalogProps {
  releases: CatalogRelease[];
  locked: LockedMusic;
  catalog: Catalog;
  arranging: boolean;
}

/** Every release and locked track, in the owner's sections. */
export const MusicCatalog = ({ releases, locked, catalog, arranging }: MusicCatalogProps) => {
  const entries = useMemo(() => {
    const map = new Map<string, Entry>();
    for (const release of releases) map.set(release.key, { kind: "release", key: release.key, release, title: release.title, cover: release.cover });
    for (const track of locked.tracks)
      map.set(trackKey(track.id), { kind: "track", key: trackKey(track.id), track, title: track.title, cover: track.cover_image_url || undefined });
    return map;
  }, [releases, locked.tracks]);

  const refs: CatalogItemRef[] = useMemo(() => [...entries.values()].map((e) => ({ key: e.key, kind: e.kind })), [entries]);
  const groups = useMemo(
    () => groupCatalog(refs, catalog.sections, catalog.placements, { includeEmpty: arranging }),
    [refs, catalog.sections, catalog.placements, arranging],
  );
  const customGroups = groups.filter((g) => g.custom);

  return (
    <div className="space-y-10" data-testid="music-catalog">
      {arranging && <NewSection catalog={catalog} />}
      {groups.map((group) => (
        <CatalogSection
          key={group.id}
          group={group}
          entries={entries}
          locked={locked}
          catalog={catalog}
          arranging={arranging}
          customGroups={customGroups}
        />
      ))}
      {groups.length === 0 && !arranging && (
        <p className="py-10 text-center text-sm text-muted-foreground">No music here yet.</p>
      )}
    </div>
  );
};

const NewSection = ({ catalog }: { catalog: Catalog }) => {
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const existing = new Set(catalog.sections.map((s) => s.title.toLowerCase()));
  const add = (raw: string) => {
    const result = validateSectionTitle(raw);
    if ("message" in result) return setError(result.message);
    setError(null);
    catalog.createSection.mutate(result.title, { onSuccess: () => setTitle("") });
  };
  return (
    <div className="rounded-xl border border-dashed border-border/70 p-4" data-testid="new-section">
      <p className="text-sm font-medium text-foreground">New section</p>
      <p className="mt-0.5 text-xs text-muted-foreground">Group your music the way you put it out: albums, mixtapes, DJ mixes, anything.</p>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add(title);
        }}
      >
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Section name"
          maxLength={60}
          aria-label="New section name"
          className="h-11 flex-1"
        />
        <Button type="submit" className="min-h-11" disabled={catalog.busy}>
          <Plus className="mr-1 h-4 w-4" /> Add
        </Button>
      </form>
      {error && <p role="alert" className="mt-1.5 text-xs text-destructive">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {SECTION_SUGGESTIONS.filter((s) => !existing.has(s.toLowerCase())).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => add(s)}
            disabled={catalog.busy}
            className="min-h-11 rounded-full border border-border/60 px-3.5 text-xs text-foreground hover:bg-accent/30 disabled:opacity-50"
          >
            + {s}
          </button>
        ))}
      </div>
    </div>
  );
};

interface CatalogSectionProps {
  group: CatalogGroup;
  entries: Map<string, Entry>;
  locked: LockedMusic;
  catalog: Catalog;
  arranging: boolean;
  customGroups: CatalogGroup[];
}

const CatalogSection = ({ group, entries, locked, catalog, arranging, customGroups }: CatalogSectionProps) => {
  const index = customGroups.findIndex((g) => g.id === group.id);
  const items = group.keys.map((key) => entries.get(key)).filter((e): e is Entry => !!e);

  return (
    <section aria-label={group.title} data-testid="catalog-section" data-section={group.custom ? "custom" : group.id}>
      {arranging && group.custom ? (
        <SectionEditor group={group} items={items} catalog={catalog} index={index} customGroups={customGroups} />
      ) : (
        <SectionHeader group={group} count={items.length} />
      )}
      {items.length > 0 ? (
        <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3">
          {items.map((entry, i) => (
            <div key={entry.key} className="flex min-w-0 flex-col">
              {entry.kind === "release" ? (
                <CatalogReleaseCard release={entry.release} />
              ) : (
                <LockedCard track={entry.track} locked={locked} />
              )}
              {arranging && (
                <ItemControls
                  entry={entry}
                  group={group}
                  position={i}
                  keys={group.keys}
                  catalog={catalog}
                  customGroups={customGroups}
                />
              )}
            </div>
          ))}
        </div>
      ) : (
        arranging && <p className="mt-3 text-xs text-muted-foreground">Empty. Use "Section" under any cover to move music here.</p>
      )}
    </section>
  );
};

const SectionHeader = ({ group, count }: { group: CatalogGroup; count: number }) => (
  <div className="flex items-end gap-3 border-b border-border/40 pb-3">
    {group.cover && (
      <img src={group.cover} alt="" className="h-14 w-14 shrink-0 rounded-md object-cover shadow-md" />
    )}
    <div className="min-w-0 flex-1">
      <h3 className="font-display text-xl font-medium leading-tight text-foreground truncate">{group.title}</h3>
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {count} {count === 1 ? "release" : "releases"}
      </p>
    </div>
  </div>
);

const SectionEditor = ({
  group,
  items,
  catalog,
  index,
  customGroups,
}: {
  group: CatalogGroup;
  items: Entry[];
  catalog: Catalog;
  index: number;
  customGroups: CatalogGroup[];
}) => {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(group.title);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const covers = items.filter((e) => e.cover);
  const ids = customGroups.map((g) => g.id);

  const save = () => {
    const result = validateSectionTitle(title);
    if ("message" in result) return setError(result.message);
    setError(null);
    catalog.updateSection.mutate({ id: group.id, title: result.title }, { onSuccess: () => setEditing(false) });
  };

  return (
    <div className="space-y-3 rounded-xl border border-border/60 bg-card/40 p-3" data-testid="section-editor">
      <div className="flex items-center gap-2">
        {group.cover ? (
          <img src={group.cover} alt="" className="h-11 w-11 shrink-0 rounded-md object-cover" />
        ) : (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-muted">
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
        {editing ? (
          <form
            className="flex min-w-0 flex-1 gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} aria-label="Section name" className="h-11 min-w-0 flex-1" autoFocus />
            <Button type="submit" size="icon" className="h-11 w-11 shrink-0" aria-label="Save name" disabled={catalog.busy}>
              <Check className="h-4 w-4" />
            </Button>
            <Button type="button" size="icon" variant="ghost" className="h-11 w-11 shrink-0" aria-label="Cancel rename" onClick={() => { setEditing(false); setTitle(group.title); setError(null); }}>
              <X className="h-4 w-4" />
            </Button>
          </form>
        ) : (
          <>
            <h3 className="min-w-0 flex-1 truncate font-display text-lg font-medium text-foreground">{group.title}</h3>
            <Button size="icon" variant="ghost" className="h-11 w-11 shrink-0" aria-label={`Rename ${group.title}`} onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      <div className="flex flex-wrap items-center gap-1.5">
        <Button size="sm" variant="outline" className="min-h-11" aria-label={`Move ${group.title} up`} disabled={index <= 0 || catalog.busy}
          onClick={() => catalog.reorderSections.mutate(moveInList(ids, index, -1))}>
          <ArrowUp className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="outline" className="min-h-11" aria-label={`Move ${group.title} down`} disabled={index >= ids.length - 1 || catalog.busy}
          onClick={() => catalog.reorderSections.mutate(moveInList(ids, index, 1))}>
          <ArrowDown className="h-4 w-4" />
        </Button>
        <select
          aria-label={`Cover for ${group.title}`}
          value={group.cover ?? ""}
          disabled={catalog.busy || covers.length === 0}
          onChange={(e) => catalog.updateSection.mutate({ id: group.id, cover_url: e.target.value || null })}
          className="h-11 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="">{covers.length ? "No section cover" : "Cover: add music first"}</option>
          {covers.map((e) => (
            <option key={e.key} value={e.cover}>Cover: {e.title}</option>
          ))}
        </select>
        <Button size="sm" variant="ghost" className="min-h-11 text-destructive" aria-label={`Delete ${group.title}`} onClick={() => setConfirmDelete(true)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{group.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              The section goes away. The music in it stays on your page under Releases and Locked music.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">Keep it</AlertDialogCancel>
            <AlertDialogAction className="min-h-11" onClick={() => catalog.deleteSection.mutate(group.id)}>Delete section</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const ItemControls = ({
  entry,
  group,
  position,
  keys,
  catalog,
  customGroups,
}: {
  entry: Entry;
  group: CatalogGroup;
  position: number;
  keys: string[];
  catalog: Catalog;
  customGroups: CatalogGroup[];
}) => (
  <div className="mt-2 flex items-center gap-1" data-testid="item-controls">
    <select
      aria-label={`Section for ${entry.title}`}
      value={group.custom ? group.id : ""}
      disabled={catalog.busy || customGroups.length === 0}
      onChange={(e) =>
        catalog.placeItem.mutate({
          itemKey: entry.key,
          sectionId: e.target.value || null,
          trackId: entry.kind === "track" ? entry.track.id : undefined,
        })
      }
      className="h-11 min-w-0 flex-1 rounded-md border border-input bg-background px-1.5 text-xs"
    >
      <option value="">{customGroups.length ? "No section" : "Add a section first"}</option>
      {customGroups.map((g) => (
        <option key={g.id} value={g.id}>{g.title}</option>
      ))}
    </select>
    {group.custom && (
      <>
        <Button size="icon" variant="ghost" className="h-11 w-9 shrink-0" aria-label={`Move ${entry.title} earlier`} disabled={position === 0 || catalog.busy}
          onClick={() => catalog.reorderItems.mutate(moveInList(keys, position, -1))}>
          <ArrowUp className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" className="h-11 w-9 shrink-0" aria-label={`Move ${entry.title} later`} disabled={position === keys.length - 1 || catalog.busy}
          onClick={() => catalog.reorderItems.mutate(moveInList(keys, position, 1))}>
          <ArrowDown className="h-4 w-4" />
        </Button>
      </>
    )}
  </div>
);

const LockedCard = ({ track, locked }: { track: ExclusiveTrack; locked: LockedMusic }) => (
  <ExclusiveTrackCard
    track={track}
    hasAccess={locked.hasAccess(track.id)}
    isOwner={locked.isOwner}
    rules={locked.rules}
    payoutEnabled={locked.payoutEnabled}
    sales={locked.isOwner ? locked.sales[track.id] : undefined}
    onDelete={() => locked.deleteTrack.mutate(track.id)}
    onTogglePublish={() => locked.updateTrack.mutate({ id: track.id, is_published: !track.is_published })}
    onPurchase={locked.handlePurchase}
  />
);

export default MusicCatalog;
