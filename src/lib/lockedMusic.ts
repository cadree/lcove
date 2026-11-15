// Rules shared by the locked-track upload form and the track card.

export const LOCKED_MUSIC_BUCKET = "music-private";
/** Same as the project's storage upload limit and the bucket's file_size_limit. */
export const MAX_LOCKED_AUDIO_BYTES = 50 * 1024 * 1024;
export const MAX_COVER_BYTES = 5 * 1024 * 1024;
export const MIN_TRACK_PRICE_CENTS = 50;
export const MAX_TRACK_PRICE_CENTS = 50000;
export const LOCKED_AUDIO_DETAIL =
  "MP3, WAV, FLAC, M4A or AAC, up to 50MB. Fans hear a 15-second preview until they buy.";

/** "$4.99", "4.99", "5" → cents; anything else → null. */
export function parsePriceCents(input: string): number | null {
  const cleaned = (input || "").replace(/[$\s,]/g, "");
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  const cents = Math.round(parseFloat(cleaned) * 100);
  return Number.isFinite(cents) ? cents : null;
}

export type LockedUploadProblem =
  | "title"
  | "audio_missing"
  | "audio_type"
  | "audio_size"
  | "cover_type"
  | "cover_size"
  | "price";

export interface LockedUploadInput {
  title: string;
  audio: { name: string; type: string; size: number } | null;
  cover: { name: string; type: string; size: number } | null;
  price: string;
  isAudio: (file: { name: string; type: string }) => boolean;
  /** Subscriber-only tracks may leave the price empty. */
  hasSubscriptionRule?: boolean;
}

export function lockedUploadProblems(input: LockedUploadInput): LockedUploadProblem[] {
  const problems: LockedUploadProblem[] = [];
  if (!input.title.trim()) problems.push("title");
  if (!input.audio) problems.push("audio_missing");
  else {
    if (!input.isAudio(input.audio)) problems.push("audio_type");
    if (input.audio.size > MAX_LOCKED_AUDIO_BYTES) problems.push("audio_size");
  }
  if (input.cover) {
    if (!input.cover.type.startsWith("image/") && !/\.(jpe?g|png|webp|heic|heif|gif)$/i.test(input.cover.name)) problems.push("cover_type");
    if (input.cover.size > MAX_COVER_BYTES) problems.push("cover_size");
  }
  const subscriberOnly = !!input.hasSubscriptionRule && !input.price.trim();
  const cents = parsePriceCents(input.price);
  if (!subscriberOnly && (cents === null || cents < MIN_TRACK_PRICE_CENTS || cents > MAX_TRACK_PRICE_CENTS)) problems.push("price");
  return problems;
}

export const LOCKED_UPLOAD_MESSAGES: Record<LockedUploadProblem, string> = {
  title: "Give the track a title.",
  audio_missing: "Choose the audio file.",
  audio_type: "That file isn't audio. Use MP3, WAV, FLAC, M4A or AAC.",
  audio_size: "That file is over 50MB. Export a smaller MP3 or M4A and try again.",
  cover_type: "Cover art must be an image.",
  cover_size: "Cover art must be under 5MB.",
  price: "Set a price between $0.50 and $500.",
};

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Extension of a stored path or URL, for the download file name. */
export function fileExtension(pathOrUrl: string, fallback = "mp3"): string {
  const clean = (pathOrUrl || "").split("?")[0];
  const match = /\.([a-z0-9]{2,5})$/i.exec(clean);
  return match ? match[1].toLowerCase() : fallback;
}

export interface SaleRow {
  track_id: string;
  amount_cents: number;
  payment_status?: string | null;
}

export interface TrackSales {
  sold: number;
  grossCents: number;
  refunded: number;
}

/** Paid sales and refunds per track, from the artist's view of exclusive_track_purchases. */
export function summarizeSales(rows: SaleRow[]): Record<string, TrackSales> {
  const out: Record<string, TrackSales> = {};
  for (const row of rows) {
    const entry = (out[row.track_id] ||= { sold: 0, grossCents: 0, refunded: 0 });
    if (row.payment_status === "paid") {
      entry.sold += 1;
      entry.grossCents += Number(row.amount_cents) || 0;
    } else if (row.payment_status === "refunded") {
      entry.refunded += 1;
    }
  }
  return out;
}
