import { errorMessage } from "@/lib/errorMessage";
import { embedColumnMissing, videoEmbedMigrationMessage } from "@/lib/videoEmbed";

/** Message to show beside a field when a write fails. */
export function writeError(error: unknown, fallback: string): string {
  if (embedColumnMissing(error)) return videoEmbedMigrationMessage();
  return errorMessage(error, fallback);
}
