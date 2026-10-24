/**
 * iOS Safari treats accept="audio/*" as the video camera roll and will not
 * offer mp3, wav, flac, m4a, or aac from Files. Concrete extensions and MIME
 * types open Files. Do not add the audio/* wildcard back.
 */
export const AUDIO_EXTENSIONS = ["mp3", "wav", "flac", "m4a", "aac"] as const;

export const AUDIO_MIME_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/flac",
  "audio/x-flac",
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
  "audio/aac",
  "audio/aacp",
  "audio/x-aac",
] as const;

export const AUDIO_FILE_ACCEPT = [
  ...AUDIO_EXTENSIONS.map((extension) => `.${extension}`),
  ...AUDIO_MIME_TYPES,
].join(",");

const EXTENSIONS = new Set<string>(AUDIO_EXTENSIONS);
const MIMES = new Set<string>(AUDIO_MIME_TYPES);

const CONTENT_TYPES: Record<(typeof AUDIO_EXTENSIONS)[number], string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  flac: "audio/flac",
  m4a: "audio/mp4",
  aac: "audio/aac",
};

export function audioExtension(name: string): string | null {
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSIONS.has(extension) ? extension : null;
}

/** iOS often sends an empty type or application/octet-stream for Files picks. */
export function isAudioUpload(file: { name: string; type: string }): boolean {
  if (audioExtension(file.name)) return true;
  const type = file.type.toLowerCase().split(";")[0]?.trim() ?? "";
  if (!type || type === "application/octet-stream") return false;
  if (type.startsWith("video/") || type.startsWith("image/")) return false;
  return MIMES.has(type) || type.startsWith("audio/");
}

/** MIME stored with the object so a bucket allow-list sees audio, not a blank type. */
export function audioContentType(file: { name: string; type: string }): string {
  const type = file.type.toLowerCase().split(";")[0]?.trim() ?? "";
  if (MIMES.has(type)) return type;
  const extension = audioExtension(file.name);
  if (extension && extension in CONTENT_TYPES) {
    return CONTENT_TYPES[extension as (typeof AUDIO_EXTENSIONS)[number]];
  }
  if (type.startsWith("audio/")) return type;
  return "application/octet-stream";
}
