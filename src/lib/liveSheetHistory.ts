export const LIVE_SHEET_KEY = "etherLiveSheet";

/** Keep the router index and add the sheet marker so Back closes the sheet. */
export function liveSheetState(current: unknown, streamId: string): Record<string, unknown> {
  const base = current && typeof current === "object" ? { ...(current as Record<string, unknown>) } : {};
  return { ...base, [LIVE_SHEET_KEY]: streamId };
}

export function liveSheetId(state: unknown): string | null {
  if (!state || typeof state !== "object") return null;
  const id = (state as { etherLiveSheet?: unknown }).etherLiveSheet;
  return typeof id === "string" && id.length > 0 ? id : null;
}

export function shouldPopLiveSheet(state: unknown, streamId: string): boolean {
  return liveSheetId(state) === streamId;
}
