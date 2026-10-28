const HEIC_EXTENSIONS = new Set(["heic", "heif"]);

const HEIC_MIME_TYPES = new Set([
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
]);

export const HEIC_CONVERSION_FAILED_MESSAGE =
  "Couldn't convert this HEIC photo, so it wasn't saved. Use a JPEG or PNG instead.";

export class HeicConversionError extends Error {
  constructor(message = HEIC_CONVERSION_FAILED_MESSAGE) {
    super(message);
    this.name = "HeicConversionError";
  }
}

function extensionOf(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? name;
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return "";
  return base.slice(dot + 1).toLowerCase();
}

function mimeOf(mime: string): string {
  return mime.toLowerCase().split(";", 1)[0].trim();
}

/** True when the picker offered a HEIC or HEIF photo. */
export function isHeicImage(name: string, mime: string): boolean {
  if (HEIC_MIME_TYPES.has(mimeOf(mime))) return true;
  return HEIC_EXTENSIONS.has(extensionOf(name));
}

/**
 * Storage name for an upload. HEIC and HEIF become `.jpg`.
 * Every other name is returned unchanged.
 */
export function jpegStorageName(name: string, mime = ""): string {
  if (!isHeicImage(name, mime)) return name;
  const slash = Math.max(name.lastIndexOf("/"), name.lastIndexOf("\\"));
  const dir = slash >= 0 ? name.slice(0, slash + 1) : "";
  const base = slash >= 0 ? name.slice(slash + 1) : name;
  const dot = base.lastIndexOf(".");
  const stem = dot > 0 ? base.slice(0, dot) : base;
  return `${dir}${stem || "photo"}.jpg`;
}

/**
 * Decode a HEIC/HEIF photo with the browser and encode a JPEG.
 * Throws HeicConversionError when the browser cannot decode it.
 */
export async function heicToJpeg(blob: Blob, fileName: string): Promise<File> {
  try {
    const { convertHeic } = await import("@su-engineering/heic");
    const converted = await convertHeic(blob, { type: "image/jpeg", quality: 0.92 });
    if (!converted.blob || converted.blob.size === 0) throw new HeicConversionError();
    return new File([converted.blob], fileName, { type: "image/jpeg" });
  } catch (error) {
    if (error instanceof HeicConversionError) throw error;
    console.error("HEIC conversion failed", error);
    throw new HeicConversionError();
  }
}
