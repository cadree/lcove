export function parseItemList(value: string | null | undefined): string[] {
  return String(value || "")
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function formatItemList(items: string[]): string {
  return items.map((item) => item.trim()).filter(Boolean).join("\n");
}
