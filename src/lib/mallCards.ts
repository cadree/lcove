/** Newest product images per store, up to `limit` each, for mall card previews. */
export function mallPreviews(
  items: readonly { store_id: string; images: string[] | null }[],
  limit = 3,
): Map<string, string[]> {
  const previews = new Map<string, string[]>();
  for (const item of items) {
    const image = item.images?.find((src) => typeof src === "string" && src.trim());
    if (!image) continue;
    const list = previews.get(item.store_id) ?? [];
    if (list.length < limit && !list.includes(image)) list.push(image);
    previews.set(item.store_id, list);
  }
  return previews;
}
