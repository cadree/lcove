import { useEffect, useId, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { usePosts } from "@/hooks/usePosts";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { VideoLinkField } from "@/components/feed/VideoLinkField";
import { EmbedPlayer, EmbedThumbnail } from "@/components/feed/EmbedPlayer";
import { InlineError } from "@/components/ui/inline-error";
import { writeError } from "@/lib/writeError";
import { assertCleanText, OBJECTIONABLE_MESSAGE } from "@/lib/objectionableText";
import type { EmbedDraft } from "@/lib/videoEmbed";
import { VideoCoverPicker, type CoverChoice } from "@/components/media/VideoCoverPicker";
import { usePostDrafts, type PostDraft } from "@/hooks/usePostDrafts";

type Step = "pick" | "crop" | "caption" | "share";

const FRAME = 260;

interface CreateShareFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

async function bakeSquareCrop(src: string, scale: number, offsetX: number, offsetY: number) {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read the photo"));
    img.src = src;
  });

  const size = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not crop the photo");

  const base = Math.max(FRAME / image.naturalWidth, FRAME / image.naturalHeight);
  const drawW = image.naturalWidth * base * scale;
  const drawH = image.naturalHeight * base * scale;
  const left = (FRAME - drawW) / 2 + offsetX;
  const top = (FRAME - drawH) / 2 + offsetY;
  const ratio = size / FRAME;
  ctx.fillStyle = "#111111";
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(image, left * ratio, top * ratio, drawW * ratio, drawH * ratio);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
  if (!blob) throw new Error("Could not crop the photo");
  return new File([blob], "post.jpg", { type: "image/jpeg" });
}

export function CreateShareFlow({ open, onOpenChange }: CreateShareFlowProps) {
  const { user } = useAuth();
  const { createPost } = usePosts();
  const { drafts, save: saveDraft, remove: removeDraft, publish: publishDraft } = usePostDrafts();
  const [editingDraft, setEditingDraft] = useState<PostDraft | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const [step, setStep] = useState<Step>("pick");
  const [preview, setPreview] = useState<string | null>(null);
  // Release the previous photo's object URL whenever it is replaced or the flow closes.
  useEffect(() => () => {
    if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
  }, [preview]);
  const [croppedFile, setCroppedFile] = useState<File | null>(null);
  const [croppedUrl, setCroppedUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const captionErrorId = useId();
  const [kind, setKind] = useState<"photo" | "video" | "text">("text");
  const [linkUrl, setLinkUrl] = useState("");
  const [embed, setEmbed] = useState<EmbedDraft | null>(null);
  const [cover, setCover] = useState<CoverChoice | null>(null);
  const chooseCover = (next: CoverChoice | null) => {
    if (cover) URL.revokeObjectURL(cover.url);
    setCover(next);
  };

  const reset = () => {
    setStep("pick");
    setPreview(null);
    setCroppedFile(null);
    setCroppedUrl(null);
    setCaption("");
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setNatural(null);
    setError(null);
    setKind("text");
    setLinkUrl("");
    setEmbed(null);
    chooseCover(null);
    setEditingDraft(null);
  };

  const openDraft = (draft: PostDraft) => {
    reset();
    setEditingDraft(draft);
    setCaption(draft.content ?? "");
    setKind(draft.media_type);
    setCroppedUrl(draft.media_url);
    setStep("caption");
  };

  const keepDraft = async () => {
    try {
      setError(null);
      await saveDraft.mutateAsync({
        id: editingDraft?.id,
        content: caption,
        file: croppedFile,
        cover: kind === "video" ? cover?.file ?? null : null,
        mediaType: kind,
      });
      handleOpenChange(false);
    } catch (err) {
      setError(writeError(err, "Could not save the draft"));
    }
  };

  const chooseFile = (accept: string) => {
    fileInputRef.current?.setAttribute("accept", accept);
    fileInputRef.current?.click();
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const onPick = (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setLinkUrl("");
    setEmbed(null);
    if (file.type.startsWith("video/")) {
      if (file.size > 80 * 1024 * 1024) {
        setError("Videos need to be under 80 MB.");
        return;
      }
      setKind("video");
      setCroppedFile(file);
      setCroppedUrl(URL.createObjectURL(file));
      setPreview(null);
      setStep("caption");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("Choose a photo or a video.");
      return;
    }
    setKind("photo");
    // An object URL points at the file instead of copying it into a base64 string (a 12 MB photo would be ~16 MB of JS string).
    const src = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setNatural({ w: img.naturalWidth, h: img.naturalHeight });
      setPreview(src);
      setScale(1);
      setOffset({ x: 0, y: 0 });
      setStep("crop");
    };
    img.onerror = () => URL.revokeObjectURL(src);
    img.src = src;
  };

  const goToCaption = async () => {
    if (!preview) {
      setStep("caption");
      return;
    }
    try {
      setError(null);
      const file = await bakeSquareCrop(preview, scale, offset.x, offset.y);
      setCroppedFile(file);
      setCroppedUrl(URL.createObjectURL(file));
      setStep("caption");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not crop the photo");
    }
  };

  const share = async () => {
    if (!caption.trim() && !croppedFile && !embed && !editingDraft) return;
    try {
      setError(null);
      assertCleanText(caption);
      if (editingDraft) {
        await publishDraft.mutateAsync({ draft: editingDraft, content: caption });
        handleOpenChange(false);
        return;
      }
      await createPost.mutateAsync({
        content: caption.trim() || undefined,
        file: embed ? undefined : croppedFile || undefined,
        mediaType: embed ? "video" : kind === "video" ? "video" : croppedFile ? "photo" : "text",
        embed: embed ?? undefined,
        cover: kind === "video" ? cover?.file ?? null : null,
        inlineError: true,
      });
      handleOpenChange(false);
    } catch (err) {
      const message = writeError(err, "Could not share that post");
      setError(message);
      if (message === OBJECTIONABLE_MESSAGE) setStep("caption");
    }
  };

  const stepLabel = { pick: "Pick", crop: "Crop", caption: "Caption", share: "Share" }[step];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md gap-0 rounded-[16px] border border-border bg-background p-0">
        <div className="px-5 pt-5 pb-4 border-b border-border">
          <p className="eyebrow">{stepLabel}</p>
          <DialogTitle className="ether-title text-3xl font-medium text-left">Create</DialogTitle>
          <DialogDescription className="sr-only">Choose a photo, video, or caption, then share it</DialogDescription>
        </div>

        <div className="px-5 py-5">
          {!user && <p className="text-sm text-muted-foreground">Sign in to share a post.</p>}

          {user && step === "pick" && (
            <div className="space-y-3">
              <Button className="w-full min-h-11" onClick={() => chooseFile("image/*")}>
                Choose a photo
              </Button>
              <Button variant="outline" className="w-full min-h-11" onClick={() => chooseFile("video/*")}>
                Choose a video
              </Button>
              <Button variant="outline" className="w-full min-h-11" onClick={() => { setKind("text"); setEmbed(null); setStep("caption"); }}>
                Caption only
              </Button>
              <VideoLinkField
                url={linkUrl}
                onUrlChange={setLinkUrl}
                onDraft={setEmbed}
              />
              {embed && (
                <Button className="w-full min-h-11" onClick={() => setStep("caption")}>
                  Next
                </Button>
              )}
              {error && <p className="text-sm text-destructive">{error}</p>}
              {drafts.length > 0 && (
                <DraftList
                  drafts={drafts}
                  onEdit={openDraft}
                  onPublish={(draft) => publishDraft.mutate({ draft }, { onError: (err) => setError(writeError(err, "Could not share that draft")) })}
                  onDelete={(draft) => removeDraft.mutate(draft.id)}
                  busy={publishDraft.isPending || removeDraft.isPending}
                />
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={(event) => {
                  onPick(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </div>
          )}

          {user && step === "crop" && preview && (
            <div className="space-y-4">
              <div
                className="relative mx-auto overflow-hidden bg-muted touch-none"
                style={{ width: FRAME, maxWidth: "100%", height: FRAME }}
                onPointerDown={(event) => {
                  dragRef.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y };
                  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
                }}
                onPointerMove={(event) => {
                  const drag = dragRef.current;
                  if (!drag) return;
                  setOffset({
                    x: drag.ox + event.clientX - drag.x,
                    y: drag.oy + event.clientY - drag.y,
                  });
                }}
                onPointerUp={() => {
                  dragRef.current = null;
                }}
              >
                {natural && (
                  <img
                    src={preview}
                    alt=""
                    draggable={false}
                    className="absolute max-w-none select-none"
                    style={{
                      width: natural.w * Math.max(FRAME / natural.w, FRAME / natural.h) * scale,
                      height: natural.h * Math.max(FRAME / natural.w, FRAME / natural.h) * scale,
                      left: (FRAME - natural.w * Math.max(FRAME / natural.w, FRAME / natural.h) * scale) / 2 + offset.x,
                      top: (FRAME - natural.h * Math.max(FRAME / natural.w, FRAME / natural.h) * scale) / 2 + offset.y,
                    }}
                  />
                )}
              </div>
              <label className="block text-sm text-muted-foreground">
                Zoom
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.01}
                  value={scale}
                  onChange={(event) => setScale(Number(event.target.value))}
                  className="mt-2 w-full min-h-11"
                />
              </label>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-2">
                <Button variant="outline" className="min-h-11 flex-1" onClick={() => setStep("pick")}>
                  Back
                </Button>
                <Button className="min-h-11 flex-1" onClick={goToCaption}>
                  Next
                </Button>
              </div>
            </div>
          )}

          {user && step === "caption" && (
            <div className="space-y-4">
              {embed ? (
                <EmbedPlayer embed={embed} title={embed.title} />
              ) : kind === "video" && croppedUrl ? (
                <>
                  <video src={croppedUrl} poster={editingDraft?.thumbnail_url ?? undefined} preload="metadata" className="max-h-[min(40vh,360px)] w-full rounded-[14px] bg-black object-contain" controls playsInline />
                  {croppedFile && <VideoCoverPicker videoUrl={croppedUrl} cover={cover} onChange={chooseCover} />}
                </>
              ) : croppedUrl ? (
                <img src={croppedUrl} alt="" className="aspect-[4/5] max-h-[min(52vh,420px)] w-full rounded-[14px] bg-muted object-contain" />
              ) : null}
              <Textarea
                value={caption}
                onChange={(event) => {
                  setCaption(event.target.value);
                  setError(null);
                }}
                placeholder="Write a caption"
                aria-label="Post caption"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? captionErrorId : undefined}
                className="min-h-28 rounded-[14px]"
                maxLength={2200}
              />
              <InlineError id={captionErrorId} message={error} />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="min-h-11 flex-1"
                  onClick={() => setStep(embed || kind === "video" ? "pick" : preview ? "crop" : "pick")}
                >
                  Back
                </Button>
                <Button
                  className="min-h-11 flex-1"
                  disabled={!caption.trim() && !croppedFile && !embed && !editingDraft?.media_url}
                  onClick={() => setStep("share")}
                >
                  Next
                </Button>
              </div>
              {!embed && (
                <Button
                  variant="ghost"
                  className="mono-label min-h-11 w-full text-[11px] text-muted-foreground"
                  disabled={saveDraft.isPending || (!caption.trim() && !croppedFile && !editingDraft)}
                  onClick={keepDraft}
                >
                  {saveDraft.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : editingDraft ? "Save draft changes" : "Save as draft"}
                </Button>
              )}
            </div>
          )}

          {user && step === "share" && (
            <div className="space-y-4">
              {embed ? (
                <div className="space-y-2">
                  <EmbedThumbnail embed={embed} thumbnailUrl={embed.thumbnailUrl} title={embed.title} className="aspect-video" />
                  {embed.title && <p className="text-sm text-foreground">{embed.title}</p>}
                </div>
              ) : kind === "video" && croppedUrl ? (
                <video src={croppedUrl} poster={cover?.url} preload="metadata" className="max-h-[min(52vh,420px)] w-full rounded-[14px] bg-black object-contain" controls playsInline />
              ) : croppedUrl ? (
                <img src={croppedUrl} alt="" className="aspect-[4/5] max-h-[min(52vh,420px)] w-full rounded-[14px] bg-muted object-contain" />
              ) : null}
              {caption.trim() && <p className="text-sm text-foreground whitespace-pre-wrap">{caption}</p>}
              <InlineError message={error} />
              <div className="flex gap-2">
                <Button variant="outline" className="min-h-11 flex-1" onClick={() => setStep("caption")}>
                  Back
                </Button>
                <Button className="min-h-11 flex-1" onClick={share} disabled={createPost.isPending || publishDraft.isPending}>
                  {createPost.isPending || publishDraft.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Share"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DraftList({ drafts, onEdit, onPublish, onDelete, busy }: {
  drafts: PostDraft[];
  onEdit: (draft: PostDraft) => void;
  onPublish: (draft: PostDraft) => void;
  onDelete: (draft: PostDraft) => void;
  busy: boolean;
}) {
  return (
    <section aria-label="Drafts" className="space-y-2 border-t border-border pt-4">
      <p className="mono-label text-[10px] text-muted-foreground">Drafts · only you can see these</p>
      <ul className="space-y-2">
        {drafts.map((draft) => {
          const still = draft.media_type === "video" ? draft.thumbnail_url : draft.media_url;
          return (
            <li key={draft.id} className="flex items-center gap-3 rounded-[14px] border border-border bg-card/60 p-2">
              <button type="button" onClick={() => onEdit(draft)} className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left" aria-label={`Edit draft ${draft.content || draft.media_type}`}>
                <span className="h-12 w-12 shrink-0 overflow-hidden rounded-[10px] bg-muted">
                  {still ? <img src={still} alt="" className="h-full w-full object-cover" loading="lazy" /> : (
                    <span className="mono-label flex h-full w-full items-center justify-center text-[8px] text-muted-foreground">{draft.media_type === "video" ? "Video" : "Text"}</span>
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm text-foreground">{draft.content || (draft.media_type === "video" ? "Untitled video" : draft.media_type === "photo" ? "Untitled photo" : "Empty draft")}</span>
                  <span className="mono-label block text-[9px] text-muted-foreground">Saved {new Date(draft.updated_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                </span>
              </button>
              <Button size="sm" className="min-h-11 shrink-0" disabled={busy} onClick={() => onPublish(draft)}>Post</Button>
              <Button size="sm" variant="ghost" className="min-h-11 shrink-0 text-muted-foreground" disabled={busy} onClick={() => onDelete(draft)} aria-label="Delete draft">Delete</Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
