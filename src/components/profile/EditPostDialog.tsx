import { useEffect, useId, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { InlineError } from "@/components/ui/inline-error";
import { writeError } from "@/lib/writeError";
import { assertCleanText, OBJECTIONABLE_MESSAGE } from "@/lib/objectionableText";
import { VideoCoverPicker, type CoverChoice } from "@/components/media/VideoCoverPicker";
import { usePosts } from "@/hooks/usePosts";
import type { ProfilePost } from "@/types/post";

interface Props {
  post: ProfilePost;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Edit a post's caption, and the cover of a video post. */
export function EditPostDialog({ post, open, onOpenChange }: Props) {
  const { updatePost } = usePosts();
  const [caption, setCaption] = useState(post.content ?? "");
  const [cover, setCover] = useState<CoverChoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();
  const isVideo = post.media_type === "video" && Boolean(post.media_url);

  useEffect(() => {
    if (!open) return;
    setCaption(post.content ?? "");
    setError(null);
    setCover((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
  }, [open, post.id, post.content]);

  const chooseCover = (next: CoverChoice | null) => {
    setCover((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return next;
    });
  };

  const save = async () => {
    try {
      setError(null);
      assertCleanText(caption);
      await updatePost.mutateAsync({
        id: post.id,
        content: caption,
        cover: cover?.file ?? null,
        inlineError: true,
      });
      chooseCover(null);
      onOpenChange(false);
    } catch (err) {
      setError(writeError(err, "Could not update the post"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 rounded-[16px] border border-border bg-background p-0">
        <div className="border-b border-border px-5 pb-4 pt-5">
          <p className="eyebrow">Edit</p>
          <DialogTitle className="ether-title text-left text-3xl font-medium">Post</DialogTitle>
          <DialogDescription className="sr-only">
            {isVideo ? "Update the caption or the video cover" : "Update the caption"}
          </DialogDescription>
        </div>
        <div className="space-y-4 px-5 py-5">
          {isVideo && post.media_url && (
            <VideoCoverPicker
              videoUrl={post.media_url}
              cover={cover}
              onChange={chooseCover}
              existingUrl={post.thumbnail_url}
            />
          )}
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground" htmlFor={errorId + "-caption"}>Caption</label>
            <Textarea
              id={errorId + "-caption"}
              value={caption}
              onChange={(event) => { setCaption(event.target.value); setError(null); }}
              aria-invalid={error === OBJECTIONABLE_MESSAGE ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              className="min-h-24"
              maxLength={2200}
            />
          </div>
          <InlineError id={errorId} message={error} />
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="min-h-11 flex-1" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" className="min-h-11 flex-1" onClick={save} disabled={updatePost.isPending}>
              {updatePost.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
