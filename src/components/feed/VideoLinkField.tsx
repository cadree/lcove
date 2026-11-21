import { useEffect, useId, useRef, useState } from "react";
import { Link2, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmbedThumbnail } from "@/components/feed/EmbedPlayer";
import {
  fetchEmbedPreview,
  parseVideoEmbedUrl,
  youtubeThumbnailUrl,
  type EmbedDraft,
  type EmbedPreview,
} from "@/lib/videoEmbed";

interface VideoLinkFieldProps {
  url: string;
  onUrlChange: (url: string) => void;
  onDraft: (draft: EmbedDraft | null) => void;
}

export function VideoLinkField({ url, onUrlChange, onDraft }: VideoLinkFieldProps) {
  const onDraftRef = useRef(onDraft);
  onDraftRef.current = onDraft;
  const [preview, setPreview] = useState<EmbedPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fieldId = useId();
  const embed = parseVideoEmbedUrl(url);

  useEffect(() => {
    const trimmed = url.trim();
    if (!trimmed) {
      setError(null);
      setPreview(null);
      setLoading(false);
      onDraftRef.current(null);
      return;
    }

    const parsed = parseVideoEmbedUrl(trimmed);
    if (!parsed) {
      setError("Only a YouTube or Vimeo link can be posted.");
      setPreview(null);
      setLoading(false);
      onDraftRef.current(null);
      return;
    }

    let cancelled = false;
    const immediate = parsed.provider === "youtube" ? youtubeThumbnailUrl(parsed.id) : null;
    setError(null);
    setLoading(true);
    setPreview({ title: null, authorName: null, thumbnailUrl: immediate });
    onDraftRef.current({
      provider: parsed.provider,
      id: parsed.id,
      hash: parsed.hash,
      thumbnailUrl: immediate,
      title: null,
    });

    fetchEmbedPreview(parsed).then((next) => {
      if (cancelled) return;
      setPreview(next);
      setLoading(false);
      onDraftRef.current({
        provider: parsed.provider,
        id: parsed.id,
        hash: parsed.hash,
        thumbnailUrl: next.thumbnailUrl,
        title: next.title,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm text-muted-foreground" htmlFor={fieldId}>
        <Link2 className="h-4 w-4" />
        YouTube or Vimeo link
      </label>
      <div className="flex gap-2">
        <Input
          id={fieldId}
          value={url}
          onChange={(event) => onUrlChange(event.target.value)}
          placeholder="Paste a YouTube or Vimeo link"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="min-h-11"
        />
        {url && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="min-h-11 min-w-11 shrink-0"
            onClick={() => onUrlChange("")}
            aria-label="Remove video link"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {embed && preview && (
        <div className="flex items-center gap-3 rounded-[2px] border border-border bg-muted/40 p-2">
          <div className="h-16 w-28 shrink-0 overflow-hidden bg-black">
            <EmbedThumbnail embed={embed} thumbnailUrl={preview.thumbnailUrl} title={preview.title} />
          </div>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {embed.provider === "youtube" ? "YouTube" : "Vimeo"}
              {loading ? " · finding title" : ""}
            </p>
            <p className="truncate text-sm text-foreground">{preview.title || "Video link ready"}</p>
            {loading && <Loader2 className="mt-1 h-3 w-3 animate-spin text-muted-foreground" />}
          </div>
        </div>
      )}
    </div>
  );
}
