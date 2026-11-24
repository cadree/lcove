// cspell:words mzstatic mixtapes
import { MUSIC_PLATFORM_LABELS, detectMusicPlatform, normalizeMusicUrl, type MusicPlatform } from "./musicLinks.ts";

/** What the link reader saved on music_profiles. Every field is optional on purpose. */
export interface SavedAlbum {
  name?: string;
  image_url?: string;
  release_date?: string;
  type?: string;
  spotify_url?: string;
  apple_music_url?: string;
}

export interface SavedTrack {
  name?: string;
  album_name?: string;
  album_image?: string;
  spotify_url?: string;
  apple_music_url?: string;
}

/** One linked release card. Only fields the link reader actually returned are set. */
export interface CatalogRelease {
  kind: "release";
  key: string;
  title: string;
  album?: string;
  cover?: string;
  year?: string;
  releaseType?: string;
  url?: string;
  platform?: MusicPlatform;
  /** Track names the reader returned that belong to this release. */
  tracks: string[];
}

export interface MusicSectionRow {
  id: string;
  title: string;
  cover_url: string | null;
  position: number;
  created_at: string;
}

export interface MusicPlacementRow {
  section_id: string;
  item_key: string;
  position: number;
}

export interface CatalogItemRef {
  key: string;
  kind: "release" | "track";
}

export interface CatalogGroup {
  /** Section id, or one of the built-in groups for music not placed yet. */
  id: string;
  title: string;
  cover: string | null;
  custom: boolean;
  keys: string[];
}

export const UNSORTED_RELEASES = "releases";
export const UNSORTED_LOCKED = "locked";

/** Stable identity for a linked release: host and path, plus Apple's ?i= song id. */
export function releaseKey(rawUrl: string | undefined | null): string | null {
  const url = rawUrl ? normalizeMusicUrl(rawUrl) : null;
  if (!url) return null;
  const parsed = new URL(url);
  const path = parsed.pathname.replace(/\/+$/, "");
  const song = parsed.searchParams.get("i");
  return `release:${parsed.hostname.toLowerCase().replace(/^www\./, "")}${path}${song && /^\d+$/.test(song) ? `?i=${song}` : ""}`;
}

export const trackKey = (trackId: string) => `track:${trackId}`;

/**
 * Apple Music share images are wide link previews (1200x630). The same artwork
 * is served square by asking the image CDN for a square size, so every cover
 * in the grid matches. Other hosts are returned unchanged.
 */
export function squareCover(url: string | undefined | null): string | undefined {
  if (!url) return undefined;
  const match = url.match(/^(https:\/\/[a-z0-9-]+\.mzstatic\.com\/image\/thumb\/.+?)\/\d+x\d+[a-z]*(-\d+)?\.(jpg|jpeg|png|webp)$/i);
  return match ? `${match[1]}/600x600bb.jpg` : url;
}

const yearOf = (date?: string) => (date && /^\d{4}/.test(date) ? date.slice(0, 4) : undefined);
const clean = (value?: string) => (value || "").trim();
const same = (a?: string, b?: string) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

function typeLabel(type?: string): string | undefined {
  const t = clean(type).toLowerCase();
  if (!t) return undefined;
  if (t === "ep") return "EP";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function firstUrl(item: { spotify_url?: string; apple_music_url?: string }) {
  return item.spotify_url || item.apple_music_url || undefined;
}

/**
 * One list for everything the link reader saved, whatever service it came from.
 * Albums come first in saved order; a saved track that names one of those albums
 * joins its track list instead of getting a second card.
 */
export function buildReleases(albums: SavedAlbum[] = [], tracks: SavedTrack[] = []): CatalogRelease[] {
  const out: CatalogRelease[] = [];
  const seen = new Set<string>();
  const add = (release: CatalogRelease) => {
    if (seen.has(release.key)) return;
    seen.add(release.key);
    out.push(release);
  };

  for (const album of albums) {
    const title = clean(album.name);
    if (!title) continue;
    const url = firstUrl(album);
    add({
      kind: "release",
      key: releaseKey(url) ?? `release:name/${title.toLowerCase()}`,
      title,
      cover: squareCover(album.image_url),
      year: yearOf(album.release_date),
      releaseType: typeLabel(album.type),
      url: url ? normalizeMusicUrl(url) ?? undefined : undefined,
      platform: url ? detectMusicPlatform(url) : undefined,
      tracks: [],
    });
  }

  for (const track of tracks) {
    const title = clean(track.name);
    if (!title) continue;
    const url = firstUrl(track);
    const key = releaseKey(url) ?? `release:name/${title.toLowerCase()}`;
    if (seen.has(key)) continue;
    const parent = out.find((r) => same(r.title, track.album_name));
    if (parent) {
      if (!parent.tracks.some((name) => same(name, title))) parent.tracks.push(title);
      if (!parent.cover) parent.cover = squareCover(track.album_image);
      continue;
    }
    add({
      kind: "release",
      key,
      title,
      album: clean(track.album_name) || undefined,
      cover: squareCover(track.album_image),
      releaseType: "Track",
      url: url ? normalizeMusicUrl(url) ?? undefined : undefined,
      platform: url ? detectMusicPlatform(url) : undefined,
      tracks: [],
    });
  }
  return out;
}

export interface ListenOn {
  platform: MusicPlatform;
  label: string;
  url: string;
}

function isArtistPage(url: string) {
  try {
    return /\/artist\//i.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

/**
 * One button per service, never "Spotify, Apple Music, Spotify". For each
 * service the artist page wins over a single track or album link.
 */
export function listenOnServices(links: Array<{ platform?: string; url: string }>): ListenOn[] {
  const order: MusicPlatform[] = [];
  const chosen = new Map<MusicPlatform, string>();
  for (const link of links) {
    const url = normalizeMusicUrl(link.url);
    if (!url) continue;
    const detected = detectMusicPlatform(url);
    const platform: MusicPlatform =
      detected !== "other" ? detected : (link.platform as MusicPlatform) in MUSIC_PLATFORM_LABELS ? (link.platform as MusicPlatform) : "other";
    const current = chosen.get(platform);
    if (!current) {
      order.push(platform);
      chosen.set(platform, url);
    } else if (!isArtistPage(current) && isArtistPage(url)) {
      chosen.set(platform, url);
    }
  }
  return order.map((platform) => ({ platform, label: MUSIC_PLATFORM_LABELS[platform], url: chosen.get(platform)! }));
}

/** Sections in the owner's order; ties fall back to creation time, then id. */
export function orderSections<T extends Pick<MusicSectionRow, "id" | "position" | "created_at">>(sections: T[]): T[] {
  return [...sections].sort(
    (a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
  );
}

/**
 * The page the visitor sees: the owner's sections in order, each with its items
 * in order, then anything not placed yet under "Releases" and "Locked". Placements
 * that point at music no longer on the profile are dropped. Empty sections are
 * kept only for the owner, who needs them to fill them.
 */
export function groupCatalog(
  items: CatalogItemRef[],
  sections: MusicSectionRow[],
  placements: MusicPlacementRow[],
  options: { includeEmpty?: boolean } = {},
): CatalogGroup[] {
  const known = new Map(items.map((item, index) => [item.key, index]));
  const sectionIds = new Set(sections.map((s) => s.id));
  const placed = new Map<string, MusicPlacementRow>();
  for (const p of placements) {
    if (known.has(p.item_key) && sectionIds.has(p.section_id)) placed.set(p.item_key, p);
  }

  const groups: CatalogGroup[] = orderSections(sections).map((section) => {
    const keys = [...placed.values()]
      .filter((p) => p.section_id === section.id)
      .sort((a, b) => a.position - b.position || known.get(a.item_key)! - known.get(b.item_key)!)
      .map((p) => p.item_key);
    return { id: section.id, title: section.title, cover: section.cover_url, custom: true, keys };
  });

  const shown = groups.filter((g) => g.keys.length > 0 || options.includeEmpty);
  // "More ..." only reads right when a named section sits above it.
  const more = shown.length > 0;
  const loose = items.filter((item) => !placed.has(item.key));
  const looseReleases = loose.filter((i) => i.kind === "release").map((i) => i.key);
  const looseLocked = loose.filter((i) => i.kind === "track").map((i) => i.key);
  if (looseReleases.length) shown.push({ id: UNSORTED_RELEASES, title: more ? "More releases" : "Releases", cover: null, custom: false, keys: looseReleases });
  if (looseLocked.length) shown.push({ id: UNSORTED_LOCKED, title: more ? "More uploaded music" : "Uploaded music", cover: null, custom: false, keys: looseLocked });
  return shown;
}

/** Move one entry up (-1) or down (+1). Out-of-range moves return the same order. */
export function moveInList<T>(list: T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  if (index < 0 || index >= list.length || target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** Positions to write after a reorder: 0, 1, 2... in the given order. */
export function positionsFor(ids: string[]): Array<{ id: string; position: number }> {
  return ids.map((id, position) => ({ id, position }));
}

export const SECTION_SUGGESTIONS = ["Albums", "Mixtapes", "Singles", "DJ Mixes", "EPs"] as const;

/** Trimmed section title, or an error message the owner can act on. */
export function validateSectionTitle(raw: string): { ok: true; title: string } | { ok: false; message: string } {
  const title = raw.replace(/\s+/g, " ").trim();
  if (!title) return { ok: false, message: "Give the section a name." };
  if (title.length > 60) return { ok: false, message: "Keep section names under 60 characters." };
  return { ok: true, title };
}

/** Saved links, falling back to the older single Spotify / Apple Music columns. */
export function profileLinks(profile: {
  platform_links?: Array<{ platform?: string; url: string }> | null;
  spotify_artist_url?: string | null;
  apple_music_artist_url?: string | null;
}): Array<{ platform: string; url: string }> {
  const saved = (profile.platform_links || []).filter((l) => l && typeof l.url === "string");
  const links = saved.length
    ? saved.map((l) => ({ platform: l.platform || "other", url: l.url }))
    : [
        ...(profile.spotify_artist_url ? [{ platform: "spotify", url: profile.spotify_artist_url }] : []),
        ...(profile.apple_music_artist_url ? [{ platform: "apple_music", url: profile.apple_music_artist_url }] : []),
      ];
  return links.filter((l) => !!normalizeMusicUrl(l.url));
}

/** Open a saved link in a new tab, only if it is still a clean http(s) URL. */
export function openMusicLink(url?: string) {
  const safe = url ? normalizeMusicUrl(url) : null;
  if (safe) window.open(safe, "_blank", "noopener,noreferrer");
}
