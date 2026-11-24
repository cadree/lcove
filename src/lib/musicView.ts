/**
 * The music profile view: one row shape for linked releases and Ether-hosted
 * tracks, the badge each row shows, and the owner's ordering. Access itself is
 * never decided here; the badge only reflects what the server already allows.
 */
import { MUSIC_PLATFORM_LABELS, type MusicPlatform } from "./musicLinks.ts";

export type MusicLook = "ether" | "neon";
export const MUSIC_LOOKS: { id: MusicLook; label: string }[] = [
  { id: "ether", label: "Ether" },
  { id: "neon", label: "Neon" },
];

export function asLook(value: string | null | undefined): MusicLook {
  return value === "neon" ? "neon" : "ether";
}

export type BadgeTone = "free" | "price" | "license" | "members" | "unlocked" | "preview" | "draft";
export interface RowBadge {
  label: string;
  tone: BadgeTone;
}

export interface RuleLike {
  rule_type: string;
  label?: string | null;
  amount_cents: number;
  track_id?: string | null;
  is_active?: boolean;
  metadata?: unknown;
}

export interface TrackLike {
  id: string;
  price_cents: number;
  access_type?: string;
  is_published: boolean;
}

/** A purchase rule an artist set up as a DJ license (by metadata or by its name). */
export function isDjLicense(rule: RuleLike): boolean {
  if (rule.rule_type !== "purchase" || rule.is_active === false) return false;
  const meta = rule.metadata && typeof rule.metadata === "object" ? (rule.metadata as Record<string, unknown>) : {};
  return meta.license === "dj" || /\bdj\b/i.test(rule.label || "");
}

export function rulesFor(trackId: string, rules: RuleLike[]): RuleLike[] {
  return rules.filter((r) => r.is_active !== false && (r.track_id === trackId || r.track_id == null));
}

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/** The badge on a hosted track row, in the same price order the checkout uses. */
export function trackBadge(
  track: TrackLike,
  rules: RuleLike[],
  { isOwner, hasAccess, iosApp }: { isOwner: boolean; hasAccess: boolean; iosApp: boolean },
): RowBadge {
  if (isOwner && !track.is_published) return { label: "Draft", tone: "draft" };
  if (track.access_type === "free" && track.price_cents === 0 && track.is_published) return { label: "Free listening", tone: "free" };
  if (hasAccess && !isOwner) return { label: "Unlocked", tone: "unlocked" };
  const mine = rulesFor(track.id, rules);
  const license = mine.find((r) => isDjLicense(r) && r.track_id === track.id);
  if (license) return { label: iosApp ? "DJ license" : `DJ license ${money(license.amount_cents)}`, tone: "license" };
  const purchase = mine.find((r) => r.rule_type === "purchase" && !isDjLicense(r));
  const price = purchase && purchase.amount_cents > 0 ? purchase.amount_cents : track.price_cents || 0;
  if (price > 0) return { label: iosApp ? "Exclusive" : money(price), tone: "price" };
  if (mine.some((r) => r.rule_type === "subscription")) return { label: "Subscribers", tone: "members" };
  return { label: "Preview", tone: "preview" };
}

export function releaseBadge(platform: MusicPlatform | undefined): RowBadge {
  return { label: platform && platform !== "other" ? `Free on ${MUSIC_PLATFORM_LABELS[platform]}` : "Free", tone: "free" };
}

/** The owner's saved order first, then anything new in its original order. Unknown keys drop out. */
export function orderKeys(keys: string[], saved: string[] | null | undefined): string[] {
  const known = new Set(keys);
  const seen = new Set<string>();
  const out: string[] = [];
  const take = (key: string) => {
    seen.add(key);
    out.push(key);
  };
  for (const key of saved ?? []) if (known.has(key) && !seen.has(key)) take(key);
  for (const key of keys) if (!seen.has(key)) take(key);
  return out;
}

/** Move one entry from one index to another (a drag), clamped to the list. */
export function moveKey<T>(list: T[], from: number, to: number): T[] {
  if (from < 0 || from >= list.length) return list;
  const target = Math.max(0, Math.min(list.length - 1, to));
  if (target === from) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(target, 0, item);
  return next;
}

/** Rows a drag of `dy` pixels crosses, for fixed-height rows. */
export function dragSteps(dy: number, rowHeight: number): number {
  if (rowHeight <= 0) return 0;
  return Math.trunc((dy + Math.sign(dy) * rowHeight * 0.5) / rowHeight);
}

export interface RecentInput {
  key: string;
  kind: "release" | "track";
  createdAt?: string;
  year?: string;
}

/** Newest first: hosted tracks by upload time, linked releases by year, ties keep their order. */
export function recentFirst<T extends RecentInput>(items: T[]): T[] {
  const stamp = (item: T) => (item.createdAt ? Date.parse(item.createdAt) : item.year ? Date.parse(`${item.year}-01-01`) : 0) || 0;
  return items.map((item, index) => ({ item, index })).sort((a, b) => stamp(b.item) - stamp(a.item) || a.index - b.index).map((x) => x.item);
}

export const MAX_COVER_UPLOAD_BYTES = 5 * 1024 * 1024;
export function coverUploadProblem(file: { size: number; type: string }): string | null {
  if (!/^image\/(jpeg|png|webp|gif|heic|heif)$/i.test(file.type)) return "Pick a JPG, PNG or WebP image.";
  if (file.size > MAX_COVER_UPLOAD_BYTES) return "Cover art must be under 5 MB.";
  return null;
}

/** Only https covers are saved, matching the database checks. */
export function safeCoverOverrides(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, url] of Object.entries(value as Record<string, unknown>)) {
    if (typeof url === "string" && /^https:\/\//.test(url) && url.length <= 2048) out[key] = url;
  }
  return out;
}

export interface HostedTrackLike {
  id: string;
  title: string;
  cover_image_url?: string | null;
  preview_clip_url?: string | null;
  artist_user_id: string;
}

/**
 * What the shared player may play for a hosted track: the full file only when the
 * server already signed a URL for this viewer, otherwise the public preview clip.
 */
export function playableTrack(
  track: HostedTrackLike,
  artist: string,
  fullUrl: string | null | undefined,
): { id: string; title: string; artist: string; artwork: string | null; src: string; artistUserId: string; previewOnly: boolean } | null {
  const src = fullUrl || track.preview_clip_url || null;
  if (!src) return null;
  return {
    id: `track:${track.id}`,
    title: track.title,
    artist,
    artwork: track.cover_image_url ?? null,
    src,
    artistUserId: track.artist_user_id,
    previewOnly: !fullUrl,
  };
}
