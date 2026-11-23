/**
 * Listen together: a DM card that points at one track and one live session.
 * Ether-hosted tracks sync over a Realtime channel; streaming links are share-only.
 */
export type ListenSource = "ether" | "spotify" | "soundcloud" | "apple_music";

export interface ListenCard {
  kind: "listen";
  /** Random id for the live session (the Realtime channel name). */
  session: string;
  hostId: string;
  source: ListenSource;
  title: string;
  artist: string;
  artwork?: string | null;
  /** exclusive_tracks id, Ether-hosted tracks only. */
  trackId?: string;
  /** In-app page for the track's artist. */
  href: string;
  /** Streaming link, link-only sources. */
  url?: string;
  /** The sharer was playing the public preview, so joiners sync the preview. */
  hostPreview?: boolean;
}

const PREFIX = "ether-card:";
const SOURCES: ListenSource[] = ["ether", "spotify", "soundcloud", "apple_music"];
const LINK_HOSTS: Record<Exclude<ListenSource, "ether">, string[]> = {
  spotify: ["open.spotify.com", "spotify.link"],
  soundcloud: ["soundcloud.com", "on.soundcloud.com", "m.soundcloud.com"],
  apple_music: ["music.apple.com"],
};

export function encodeListenCard(card: ListenCard) {
  return `${PREFIX}${JSON.stringify(card)}`;
}

function safeLink(source: ListenSource, url: unknown): string | undefined {
  if (source === "ether" || typeof url !== "string") return undefined;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return undefined;
    return LINK_HOSTS[source].includes(parsed.hostname) ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function decodeListenCard(line: string): ListenCard | null {
  if (!line.startsWith(PREFIX)) return null;
  try {
    const p = JSON.parse(line.slice(PREFIX.length)) as Partial<ListenCard>;
    if (!p || p.kind !== "listen") return null;
    if (typeof p.session !== "string" || !/^[\w-]{8,64}$/.test(p.session)) return null;
    if (typeof p.hostId !== "string" || typeof p.title !== "string" || typeof p.artist !== "string") return null;
    if (!p.source || !SOURCES.includes(p.source)) return null;
    if (typeof p.href !== "string" || !p.href.startsWith("/") || p.href.startsWith("//")) return null;
    const url = safeLink(p.source, p.url);
    if (p.source === "ether" ? typeof p.trackId !== "string" : !url) return null;
    const artwork = typeof p.artwork === "string" && /^https:\/\//.test(p.artwork) ? p.artwork : null;
    return {
      kind: "listen",
      session: p.session,
      hostId: p.hostId,
      source: p.source,
      title: p.title.slice(0, 200),
      artist: p.artist.slice(0, 200),
      artwork,
      trackId: p.source === "ether" ? p.trackId : undefined,
      href: p.href,
      url,
      hostPreview: p.source === "ether" ? p.hostPreview === true : undefined,
    };
  } catch {
    return null;
  }
}

export function newSessionId(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

/** Map a streaming platform to a share-only source; anything else is not shareable as a card. */
export function linkSource(platform: string | undefined): Exclude<ListenSource, "ether"> | null {
  return platform === "spotify" || platform === "soundcloud" || platform === "apple_music" ? platform : null;
}

export type JoinMode = "link" | "sync-full" | "sync-preview" | "preview-only" | "buy";

/**
 * What the person tapping "Listen together" gets. Full sync needs the server to
 * have signed the full file for them; a host on the preview syncs the preview.
 */
export function joinMode(input: { source: ListenSource; hostPreviewOnly: boolean; fullUrl: string | null; previewUrl: string | null }): JoinMode {
  if (input.source !== "ether") return "link";
  if (input.hostPreviewOnly) return input.previewUrl ? "sync-preview" : "buy";
  if (input.fullUrl) return "sync-full";
  return input.previewUrl ? "preview-only" : "buy";
}

export interface HostState {
  trackId: string;
  playing: boolean;
  position: number;
  previewOnly: boolean;
}

/**
 * How far a joiner may drift before we seek. Small drifts are left alone so
 * playback does not stutter on every heartbeat.
 */
export const DRIFT_SECONDS = 0.8;

export function syncStep(local: { playing: boolean; position: number; trackId: string | null }, host: HostState, drift = DRIFT_SECONDS): { seek: number | null; play: boolean | null; switched: boolean } {
  if (local.trackId !== host.trackId) return { seek: null, play: false, switched: true };
  const seek = Math.abs(local.position - host.position) > drift ? host.position : null;
  const play = local.playing === host.playing ? null : host.playing;
  return { seek, play, switched: false };
}

export interface Listener {
  userId: string;
  name: string;
  avatar: string | null;
}

/** Everyone in the session except me, one entry per person, from a Realtime presence state. */
export function othersListening(state: Record<string, unknown[]>, me: string | null | undefined): Listener[] {
  const out = new Map<string, Listener>();
  for (const entries of Object.values(state)) {
    for (const raw of entries) {
      const e = raw as Partial<Listener>;
      if (typeof e?.userId !== "string" || e.userId === me || out.has(e.userId)) continue;
      out.set(e.userId, { userId: e.userId, name: typeof e.name === "string" ? e.name : "Someone", avatar: typeof e.avatar === "string" ? e.avatar : null });
    }
  }
  return [...out.values()];
}

/** A Listen together card for the Ether track the shared player is on, or null. */
export function cardFromPlaying(
  track: { id: string; title: string; artist: string; artwork?: string | null; artistUserId?: string; previewOnly?: boolean } | null,
  hostId: string,
  session: string,
): ListenCard | null {
  if (!track || !track.id.startsWith("track:") || !track.artistUserId) return null;
  return {
    kind: "listen",
    session,
    hostId,
    source: "ether",
    title: track.title,
    artist: track.artist,
    artwork: track.artwork && /^https:\/\//.test(track.artwork) ? track.artwork : null,
    trackId: track.id.slice("track:".length),
    href: `/profile/${track.artistUserId}/music`,
    hostPreview: !!track.previewOnly,
  };
}

export function listenFallbackText(card: ListenCard) {
  return card.source === "ether" ? `Listen together: ${card.title} by ${card.artist}` : `${card.title} by ${card.artist}`;
}
