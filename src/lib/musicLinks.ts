// cspell:words soundcloud bandcamp tidal youtu itsct itscg
import { embedPlayerSrc, nativeEmbedFrameSrc, parseVideoEmbedUrl } from "./videoEmbed.ts";

export type MusicPlatform =
  | "spotify"
  | "apple_music"
  | "soundcloud"
  | "youtube_music"
  | "tidal"
  | "bandcamp"
  | "other";

export const MUSIC_PLATFORM_LABELS: Record<MusicPlatform, string> = {
  spotify: "Spotify",
  apple_music: "Apple Music",
  soundcloud: "SoundCloud",
  youtube_music: "YouTube",
  tidal: "Tidal",
  bandcamp: "Bandcamp",
  other: "Link",
};

/** Query keys that only track who shared a link. Dropping them keeps saved links clean and stable. */
const TRACKING_PARAMS = /^(si|utm_[a-z]+|nd|context|ls|app|itsct|itscg|ref|feature|pp)$/i;

/**
 * Trim, add https:// when someone pastes "open.spotify.com/...", drop tracking params,
 * and refuse anything that is not an http(s) page. Returns null for junk.
 */
export function normalizeMusicUrl(raw: string): string | null {
  let value = (raw || "").trim();
  if (!value) return null;
  // Share sheets sometimes paste "Song name https://open.spotify.com/track/..."; keep the URL.
  const embedded = value.match(/https?:\/\/\S+/i);
  if (embedded) value = embedded[0];
  else if (/^[a-z0-9-]+(\.[a-z0-9-]+)+\//i.test(value)) value = `https://${value}`;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  url.protocol = "https:";
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.test(key)) url.searchParams.delete(key);
  }
  url.hash = "";
  const out = url.toString();
  return out.length > 2048 ? null : out;
}

export function detectMusicPlatform(url: string): MusicPlatform {
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "other";
  }
  if (host === "open.spotify.com" || host === "spotify.link") return "spotify";
  if (host === "music.apple.com" || host === "itunes.apple.com") return "apple_music";
  if (host === "soundcloud.com" || host === "m.soundcloud.com" || host === "on.soundcloud.com") return "soundcloud";
  if (host === "music.youtube.com" || host === "youtube.com" || host === "m.youtube.com" || host === "youtu.be") return "youtube_music";
  if (host === "tidal.com" || host === "listen.tidal.com") return "tidal";
  if (host.endsWith("bandcamp.com")) return "bandcamp";
  return "other";
}

/** Only Spotify and Apple Music pages can fill in the artist name and photo. */
export function canExtractArtist(url: string): boolean {
  const platform = detectMusicPlatform(url);
  return platform === "spotify" || platform === "apple_music";
}

export interface MusicEmbed {
  platform: MusicPlatform;
  src: string;
  /** Pixel height the provider's player is designed for at phone width. */
  height: number;
  title: string;
}

/**
 * Official player for a saved link, or null when the provider has no embeddable player
 * for that kind of page (Apple Music artist pages, Tidal, Bandcamp without an album id).
 * `native` swaps YouTube for the https wrapper page the iOS app needs.
 */
export function musicEmbedFor(rawUrl: string, options: { native?: boolean } = {}): MusicEmbed | null {
  const url = normalizeMusicUrl(rawUrl);
  if (!url) return null;
  const platform = detectMusicPlatform(url);
  const parsed = new URL(url);
  const parts = parsed.pathname.split("/").filter(Boolean);

  if (platform === "spotify") {
    // Locale prefix: open.spotify.com/intl-de/track/...
    const p = parts[0]?.startsWith("intl-") ? parts.slice(1) : parts;
    const kind = p[0];
    const id = p[1];
    if (!["track", "album", "artist", "playlist", "episode", "show"].includes(kind) || !/^[A-Za-z0-9]{10,40}$/.test(id || "")) return null;
    const compact = kind === "track" || kind === "episode";
    return { platform, src: `https://open.spotify.com/embed/${kind}/${id}?theme=0`, height: compact ? 152 : 352, title: `Spotify ${kind}` };
  }

  if (platform === "apple_music") {
    const storefront = parts[0];
    const kind = parts[1];
    if (!/^[a-z]{2}$/i.test(storefront || "")) return null;
    const id = [...parts].reverse().find((x) => /^(pl\.)?[a-z0-9.-]*\d+[a-z0-9.-]*$/i.test(x));
    const song = parsed.searchParams.get("i");
    if (kind === "album" && id && /^\d+$/.test(id)) {
      return {
        platform,
        src: `https://embed.music.apple.com/${storefront}/album/${id}${song && /^\d+$/.test(song) ? `?i=${song}` : ""}`,
        height: song ? 175 : 450,
        title: "Apple Music",
      };
    }
    if (kind === "song" && id && /^\d+$/.test(id)) {
      return { platform, src: `https://embed.music.apple.com/${storefront}/song/${id}`, height: 175, title: "Apple Music" };
    }
    if (kind === "playlist" && id && /^pl\.[a-z0-9-]+$/i.test(id)) {
      return { platform, src: `https://embed.music.apple.com/${storefront}/playlist/${id}`, height: 450, title: "Apple Music" };
    }
    return null; // Artist pages have no official embed.
  }

  if (platform === "soundcloud") {
    if (parsed.hostname.startsWith("on.") || parts.length === 0) return null;
    const params = new URLSearchParams({
      url: `https://soundcloud.com/${parts.join("/")}`,
      color: "#ff9fc8",
      auto_play: "false",
      hide_related: "true",
      show_comments: "false",
      show_reposts: "false",
      show_teaser: "false",
      visual: "false",
    });
    const single = parts.length === 2 && parts[1] !== "sets";
    return { platform, src: `https://w.soundcloud.com/player/?${params.toString()}`, height: single ? 166 : 300, title: "SoundCloud" };
  }

  if (platform === "youtube_music") {
    const asVideo = parsed.hostname.toLowerCase() === "music.youtube.com"
      ? url.replace("://music.youtube.com/", "://www.youtube.com/")
      : url;
    const video = parseVideoEmbedUrl(asVideo);
    if (!video) return null;
    const src = options.native ? nativeEmbedFrameSrc(video) : embedPlayerSrc(video);
    if (!src) return null;
    return { platform, src, height: 200, title: "YouTube" };
  }

  return null;
}

export interface SavedMusicLink {
  platform: string;
  url: string;
}

/** Clean, de-duplicated links ready to save; also reports which rows were not usable. */
export function cleanMusicLinks(links: SavedMusicLink[]): { links: SavedMusicLink[]; invalid: number[] } {
  const seen = new Set<string>();
  const out: SavedMusicLink[] = [];
  const invalid: number[] = [];
  links.forEach((link, index) => {
    if (!link.url.trim()) return;
    const url = normalizeMusicUrl(link.url);
    if (!url) {
      invalid.push(index);
      return;
    }
    if (seen.has(url)) return;
    seen.add(url);
    const detected = detectMusicPlatform(url);
    out.push({ platform: detected === "other" ? (link.platform || "other") : detected, url });
  });
  return { links: out, invalid };
}

/** First link that has an official player, so the profile can lead with it. */
export function featuredEmbed(links: SavedMusicLink[], options: { native?: boolean } = {}): MusicEmbed | null {
  const order: MusicPlatform[] = ["spotify", "apple_music", "soundcloud", "youtube_music"];
  for (const platform of order) {
    for (const link of links) {
      if (detectMusicPlatform(link.url) !== platform) continue;
      const embed = musicEmbedFor(link.url, options);
      if (embed) return embed;
    }
  }
  return null;
}
