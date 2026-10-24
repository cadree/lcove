import { fileKind } from "./storageLimit.ts";

/**
 * Client-side gate for image uploads.
 *
 * nsfwjs MobileNetV2 scores Drawing, Hentai, Neutral, Porn, and Sexy.
 * Porn or Hentai at or above the threshold blocks the upload. Sexy is
 * allowed. content_reports cannot record a system reporter: reporter_id
 * references auth.users, and the insert trigger overwrites it with
 * auth.uid(). The content row also does not exist yet when the file is
 * checked, so there is no target to attach a report to.
 */
export const EXPLICIT_CLASSES = ["Porn", "Hentai"] as const;

export type ExplicitClass = (typeof EXPLICIT_CLASSES)[number];

/**
 * The model splits its confidence across five classes. 0.70 means one
 * explicit class outweighs the other four combined by more than two to
 * one. Clear pornography and hentai from this model usually land above
 * 0.85. Scores under 0.70 are often split with Sexy or Drawing, which
 * stay allowed.
 */
export const EXPLICIT_THRESHOLD = 0.7;

export const EXPLICIT_BLOCK_MESSAGE = "This image isn't allowed.";

export type ClassScore = {
  className: string;
  probability: number;
};

export type ExplicitDecision =
  | { action: "allow" }
  | { action: "block"; message: string; label: ExplicitClass; probability: number };

// ISO brand codes for HEIF, HEIC, and AVIF. A QuickTime movie uses a different brand.
// cspell:disable-next-line
const IMAGE_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "hevm", "hevs", "mif1", "msf1", "avif", "avis"]);

export function decideExplicit(predictions: ClassScore[]): ExplicitDecision {
  let best: { label: ExplicitClass; probability: number } | null = null;
  for (const prediction of predictions) {
    if (prediction.className !== "Porn" && prediction.className !== "Hentai") continue;
    if (!Number.isFinite(prediction.probability)) continue;
    if (!best || prediction.probability > best.probability) {
      best = { label: prediction.className, probability: prediction.probability };
    }
  }
  if (!best || best.probability < EXPLICIT_THRESHOLD) return { action: "allow" };
  return {
    action: "block",
    message: EXPLICIT_BLOCK_MESSAGE,
    label: best.label,
    probability: best.probability,
  };
}

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((value, index) => bytes[index] === value);
}

/** True when the leading bytes are a photo container, including a mislabeled one. */
export function hasImageMagic(bytes: Uint8Array): boolean {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return true;
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return true;
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return true;
  if (startsWith(bytes, [0x42, 0x4d])) return true;
  if (startsWith(bytes, [0x49, 0x49, 0x2a, 0x00]) || startsWith(bytes, [0x4d, 0x4d, 0x00, 0x2a])) return true;
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return true;
  }
  if (
    bytes.length >= 12 &&
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70
  ) {
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]).toLowerCase();
    return IMAGE_BRANDS.has(brand);
  }
  return false;
}

export function shouldCheckImage(name: string, mime: string, header: Uint8Array): boolean {
  if (hasImageMagic(header)) return true;
  return fileKind(name, mime) === "image";
}
