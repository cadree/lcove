export type EmbedProvider = "youtube" | "vimeo";

export interface VideoEmbed {
  provider: EmbedProvider;
  id: string;
  hash?: string;
}

export interface EmbedDraft {
  provider: EmbedProvider;
  id: string;
  hash?: string;
  thumbnailUrl: string | null;
  title: string | null;
}

export interface EmbedPreview {
  title: string | null;
  authorName: string | null;
  thumbnailUrl: string | null;
}

export interface StoredEmbedFields {
  embed_provider?: string | null;
  embed_video_id?: string | null;
  embed_hash?: string | null;
  embed_thumbnail_url?: string | null;
  embed_title?: string | null;
}

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID = /^[0-9]{6,12}$/;
const VIMEO_HASH = /^[A-Za-z0-9]{4,64}$/;

const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com"]);
const YOUTU_BE_HOSTS = new Set(["youtu.be", "www.youtu.be"]);
const VIMEO_HOSTS = new Set(["vimeo.com", "www.vimeo.com"]);
const VIMEO_PLAYER_HOSTS = new Set(["player.vimeo.com"]);
const THUMBNAIL_HOSTS = new Set(["i.ytimg.com", "img.youtube.com", "i.vimeocdn.com"]);

function isHttp(url: URL) {
  return url.protocol === "https:" || url.protocol === "http:";
}

function pathParts(url: URL) {
  return url.pathname.split("/").filter(Boolean);
}

export function parseVideoEmbedUrl(input: string): VideoEmbed | null {
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > 2048) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (!isHttp(url) || url.username || url.password) return null;

  const host = url.hostname.toLowerCase();
  const parts = pathParts(url);

  if (YOUTUBE_HOSTS.has(host)) {
    if (parts.length === 1 && parts[0] === "watch") {
      const id = url.searchParams.get("v") ?? "";
      if (!YOUTUBE_ID.test(id)) return null;
      return { provider: "youtube", id };
    }
    if (parts.length === 2 && parts[0] === "shorts" && YOUTUBE_ID.test(parts[1])) {
      return { provider: "youtube", id: parts[1] };
    }
    return null;
  }

  if (YOUTU_BE_HOSTS.has(host)) {
    if (parts.length === 1 && YOUTUBE_ID.test(parts[0])) {
      return { provider: "youtube", id: parts[0] };
    }
    return null;
  }

  if (VIMEO_HOSTS.has(host)) {
    if (parts.length === 1 && VIMEO_ID.test(parts[0])) {
      return { provider: "vimeo", id: parts[0] };
    }
    if (parts.length === 2 && VIMEO_ID.test(parts[0]) && VIMEO_HASH.test(parts[1])) {
      return { provider: "vimeo", id: parts[0], hash: parts[1] };
    }
    return null;
  }

  if (VIMEO_PLAYER_HOSTS.has(host)) {
    if (parts.length === 2 && parts[0] === "video" && VIMEO_ID.test(parts[1])) {
      const hash = url.searchParams.get("h");
      if (hash && !VIMEO_HASH.test(hash)) return null;
      return hash ? { provider: "vimeo", id: parts[1], hash } : { provider: "vimeo", id: parts[1] };
    }
    return null;
  }

  return null;
}

export function embedPlayerSrc(embed: VideoEmbed): string | null {
  if (embed.provider === "youtube") {
    if (!YOUTUBE_ID.test(embed.id)) return null;
    const params = new URLSearchParams({
      rel: "0",
      playsinline: "1",
    });
    return `https://www.youtube-nocookie.com/embed/${embed.id}?${params.toString()}`;
  }

  if (embed.provider === "vimeo") {
    if (!VIMEO_ID.test(embed.id)) return null;
    if (embed.hash && !VIMEO_HASH.test(embed.hash)) return null;
    const params = new URLSearchParams({
      dnt: "1",
      playsinline: "1",
      title: "0",
      byline: "0",
      portrait: "0",
    });
    if (embed.hash) params.set("h", embed.hash);
    return `https://player.vimeo.com/video/${embed.id}?${params.toString()}`;
  }

  return null;
}

export function youtubeThumbnailUrl(id: string): string | null {
  if (!YOUTUBE_ID.test(id)) return null;
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

export function sanitizeThumbnailUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    if (!THUMBNAIL_HOSTS.has(url.hostname.toLowerCase())) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function embedFromPost(post: StoredEmbedFields): VideoEmbed | null {
  if (post.embed_provider === "youtube" && post.embed_video_id && YOUTUBE_ID.test(post.embed_video_id)) {
    if (post.embed_hash) return null;
    return { provider: "youtube", id: post.embed_video_id };
  }
  if (post.embed_provider === "vimeo" && post.embed_video_id && VIMEO_ID.test(post.embed_video_id)) {
    if (post.embed_hash && !VIMEO_HASH.test(post.embed_hash)) return null;
    return post.embed_hash
      ? { provider: "vimeo", id: post.embed_video_id, hash: post.embed_hash }
      : { provider: "vimeo", id: post.embed_video_id };
  }
  return null;
}

export function canonicalEmbedUrl(embed: VideoEmbed): string {
  if (embed.provider === "youtube") return `https://www.youtube.com/watch?v=${embed.id}`;
  return embed.hash ? `https://vimeo.com/${embed.id}/${embed.hash}` : `https://vimeo.com/${embed.id}`;
}

export function embedColumnsForInsert(draft: EmbedDraft) {
  const embed = embedFromPost({
    embed_provider: draft.provider,
    embed_video_id: draft.id,
    embed_hash: draft.hash ?? null,
  });
  if (!embed || !embedPlayerSrc(embed)) {
    throw new Error("Only a YouTube or Vimeo link can be posted.");
  }
  const title = draft.title?.trim() ? draft.title.trim().slice(0, 300) : null;
  return {
    media_url: null,
    media_type: "video" as const,
    embed_provider: embed.provider,
    embed_video_id: embed.id,
    embed_hash: embed.hash ?? null,
    embed_thumbnail_url:
      sanitizeThumbnailUrl(draft.thumbnailUrl) ??
      (embed.provider === "youtube" ? youtubeThumbnailUrl(embed.id) : null),
    embed_title: title,
  };
}

export function embedColumnMissing(error: unknown) {
  const message = error && typeof error === "object" && "message" in error && typeof error.message === "string"
    ? error.message
    : "";
  return /embed_provider|embed_video_id|embed_hash|embed_thumbnail_url|embed_title/.test(message);
}

export async function fetchEmbedPreview(
  embed: VideoEmbed,
  fetchImpl: typeof fetch = fetch,
): Promise<EmbedPreview> {
  const fallbackThumb = embed.provider === "youtube" ? youtubeThumbnailUrl(embed.id) : null;
  const page = canonicalEmbedUrl(embed);
  const endpoint = embed.provider === "youtube"
    ? `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(page)}`
    : `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(page)}`;

  try {
    const response = await fetchImpl(endpoint);
    if (!response.ok) {
      return { title: null, authorName: null, thumbnailUrl: fallbackThumb };
    }
    const data = await response.json() as {
      title?: unknown;
      author_name?: unknown;
      thumbnail_url?: unknown;
    };
    return {
      title: typeof data.title === "string" ? data.title.slice(0, 300) : null,
      authorName: typeof data.author_name === "string" ? data.author_name.slice(0, 200) : null,
      thumbnailUrl: sanitizeThumbnailUrl(typeof data.thumbnail_url === "string" ? data.thumbnail_url : null) ?? fallbackThumb,
    };
  } catch {
    return { title: null, authorName: null, thumbnailUrl: fallbackThumb };
  }
}
