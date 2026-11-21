import { Capacitor } from "@capacitor/core";
import { cn } from "@/lib/utils";
import { embedPlayerSrc, nativeEmbedFrameSrc, sanitizeThumbnailUrl, youtubeThumbnailUrl, type VideoEmbed } from "@/lib/videoEmbed";

interface EmbedPlayerProps {
  embed: VideoEmbed;
  title?: string | null;
  className?: string;
}

/**
 * The iframe src is built from a checked provider and id.
 * A pasted URL is never assigned to src.
 * In the Capacitor app the src is the https wrapper on etherbylcove.com.
 * That page embeds youtube-nocookie or the Vimeo player, so YouTube
 * receives an https referrer instead of capacitor://localhost (error 153).
 */
export function EmbedPlayer({ embed, title, className }: EmbedPlayerProps) {
  const src = Capacitor.isNativePlatform() ? nativeEmbedFrameSrc(embed) : embedPlayerSrc(embed);
  if (!src) return null;
  const label = title?.trim() || (embed.provider === "youtube" ? "YouTube video" : "Vimeo video");

  return (
    <div className={cn("relative aspect-video w-full bg-black", className)}>
      <iframe
        src={src}
        title={label}
        className="absolute inset-0 h-full w-full border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        loading="lazy"
      />
    </div>
  );
}

interface EmbedThumbnailProps {
  embed: VideoEmbed;
  thumbnailUrl?: string | null;
  title?: string | null;
  className?: string;
}

export function EmbedThumbnail({ embed, thumbnailUrl, title, className }: EmbedThumbnailProps) {
  const src = sanitizeThumbnailUrl(thumbnailUrl) ?? (embed.provider === "youtube" ? youtubeThumbnailUrl(embed.id) : null);
  if (!src) {
    return <div className={cn("h-full w-full bg-muted", className)} />;
  }
  return (
    <img
      src={src}
      alt={title?.trim() || (embed.provider === "youtube" ? "YouTube video" : "Vimeo video")}
      className={cn("h-full w-full object-cover", className)}
      loading="lazy"
    />
  );
}
