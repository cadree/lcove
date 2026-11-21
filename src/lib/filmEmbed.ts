/** Turn a public film URL into an embed src. Direct files stay null. */
export function filmEmbedSrc(url: string): string | null {
  const value = String(url || "").trim();
  if (!value) return null;
  const youtube = value.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
  if (youtube) return `https://www.youtube.com/embed/${youtube[1]}`;
  const vimeo = value.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return null;
}

export function isDirectFilm(url: string): boolean {
  return /\.(mp4|webm|mov)(\?|$)/i.test(url);
}
