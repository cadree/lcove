// Reads artist, tracks and art from Spotify's public embed page
// (open.spotify.com/embed/<kind>/<id>). That page ships its data as JSON, needs no
// API credentials, and names the artist for tracks and albums. The regular page
// only gives og:title, which is the song name on a track page.

const KINDS = new Set(["artist", "album", "track", "playlist"]);

/** { kind, id } for an open.spotify.com URL, or null. Handles /intl-xx/ prefixes. */
export function spotifyRef(rawUrl) {
  let url;
  try {
    url = new URL(String(rawUrl || "").trim());
  } catch {
    return null;
  }
  if (url.hostname.toLowerCase() !== "open.spotify.com") return null;
  let parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] && parts[0].startsWith("intl-")) parts = parts.slice(1);
  if (parts[0] === "embed") parts = parts.slice(1);
  const [kind, id] = parts;
  if (!KINDS.has(kind) || !/^[A-Za-z0-9]{10,40}$/.test(id || "")) return null;
  return { kind, id };
}

export function spotifyEmbedPageUrl(ref) {
  return `https://open.spotify.com/embed/${ref.kind}/${ref.id}`;
}

const trackUrl = (uri) => {
  const m = /^spotify:track:([A-Za-z0-9]+)$/.exec(uri || "");
  return m ? `https://open.spotify.com/track/${m[1]}` : undefined;
};

function biggestImage(entity) {
  const list = entity?.visualIdentity?.image || entity?.coverArt?.sources || [];
  if (!Array.isArray(list) || list.length === 0) return null;
  const sorted = [...list].sort((a, b) => (b.maxWidth || b.width || 0) - (a.maxWidth || a.width || 0));
  return typeof sorted[0]?.url === "string" ? sorted[0].url : null;
}

/**
 * Parse the embed page HTML. Returns the same shape the edge function sends to the
 * app, or null when the page carried no usable data.
 *  - artist: name is the artist; trackList is their top tracks.
 *  - track: artist from entity.artists[0] (falls back to subtitle).
 *  - album: artist from subtitle; tracks from trackList.
 *  - playlist: no artist (the subtitle is the playlist owner); tracks only.
 */
export function parseSpotifyEmbed(html, ref, { oembedImage = null, pageUrl = null } = {}) {
  const m = /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/.exec(html || "");
  if (!m) return null;
  let entity;
  try {
    entity = JSON.parse(m[1])?.props?.pageProps?.state?.data?.entity;
  } catch {
    return null;
  }
  if (!entity || typeof entity !== "object") return null;

  const image = biggestImage(entity) || oembedImage || null;
  const title = typeof entity.name === "string" ? entity.name : typeof entity.title === "string" ? entity.title : null;
  let artistName = null;
  if (ref.kind === "artist") artistName = title;
  else if (ref.kind === "track") {
    const first = Array.isArray(entity.artists) ? entity.artists.find((a) => a && typeof a.name === "string") : null;
    artistName = first?.name || (typeof entity.subtitle === "string" ? entity.subtitle.split(",")[0].trim() : null);
  } else if (ref.kind === "album") {
    artistName = typeof entity.subtitle === "string" ? entity.subtitle.split(",")[0].trim() : null;
  }

  const list = Array.isArray(entity.trackList) ? entity.trackList : [];
  const topTracks = list.slice(0, 10).map((t) => ({
    name: String(t.title || ""),
    album_name: ref.kind === "album" ? title || undefined : undefined,
    album_image: ref.kind === "album" ? image || undefined : undefined,
    preview_url: typeof t?.audioPreview?.url === "string" ? t.audioPreview.url : undefined,
    spotify_url: trackUrl(t.uri),
  })).filter((t) => t.name);

  if (ref.kind === "track" && title) {
    topTracks.unshift({
      name: title,
      album_image: image || undefined,
      preview_url: typeof entity?.audioPreview?.url === "string" ? entity.audioPreview.url : undefined,
      spotify_url: pageUrl || `https://open.spotify.com/track/${ref.id}`,
    });
  }

  const albums = [];
  if (ref.kind === "album" && title) {
    const iso = entity?.releaseDate?.isoString;
    albums.push({
      name: title,
      image_url: image || undefined,
      release_date: typeof iso === "string" ? iso.slice(0, 10) : undefined,
      type: "album",
      spotify_url: pageUrl || `https://open.spotify.com/album/${ref.id}`,
    });
  }

  return { image_url: image, artist_name: artistName, genres: [], top_tracks: topTracks, albums };
}
