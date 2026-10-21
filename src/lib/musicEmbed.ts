export function spotifyEmbedSrc(input: {
  externalId?: string | null;
  previewUrl?: string | null;
  pageUrl?: string | null;
}): string | null {
  const preview = input.previewUrl || "";
  if (preview.includes("open.spotify.com/embed/")) return preview;
  const source = `${input.pageUrl || ""} ${preview}`;
  const match = source.match(/open\.spotify\.com\/(track|album|artist|playlist)\/([a-zA-Z0-9]+)/);
  if (match) return `https://open.spotify.com/embed/${match[1]}/${match[2]}`;
  if (input.externalId && /^[a-zA-Z0-9]+$/.test(input.externalId)) {
    return `https://open.spotify.com/embed/track/${input.externalId}`;
  }
  return null;
}

export function appleMusicEmbedSrc(input: {
  previewUrl?: string | null;
  pageUrl?: string | null;
}): string | null {
  const preview = input.previewUrl || "";
  if (preview.includes("embed.music.apple.com")) return preview.split("?")[0].startsWith("https://embed.music.apple.com")
    ? preview
    : null;
  const source = input.pageUrl || preview;
  const match = source.match(/music\.apple\.com\/([a-z]{2})\/album\/(?:[^/?#]+\/)?(\d+)/i);
  if (!match) return null;
  const track = source.match(/[?&]i=(\d+)/);
  return `https://embed.music.apple.com/${match[1]}/album/${match[2]}${track ? `?i=${track[1]}` : ""}`;
}
