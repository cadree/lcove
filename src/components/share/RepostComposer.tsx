import { useEffect, useId, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { InlineError } from "@/components/ui/inline-error";
import { writeError } from "@/lib/writeError";

export function RepostComposer({
  open,
  onOpenChange,
  pending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  onSubmit: (caption: string) => Promise<void>;
}) {
  const errorId = useId();
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setCaption("");
      setError(null);
    }
  }, [open]);

  const close = () => {
    if (pending) return;
    setCaption("");
    setError(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Repost to your profile</DialogTitle>
          <DialogDescription>Add your own caption, or leave it blank.</DialogDescription>
        </DialogHeader>
        <Textarea
          value={caption}
          onChange={(event) => {
            setCaption(event.target.value.slice(0, 500));
            setError(null);
          }}
          placeholder="Write a caption (optional)"
          aria-label="Repost caption"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          rows={4}
          maxLength={500}
        />
        <InlineError id={errorId} message={error} />
        <p className="text-right text-xs text-muted-foreground">{caption.trim().length}/500</p>
        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={pending}>Cancel</Button>
          <Button
            disabled={pending}
            onClick={async () => {
              setError(null);
              try {
                await onSubmit(caption);
                setCaption("");
                setError(null);
                onOpenChange(false);
              } catch (err) {
                setError(writeError(err, "Could not repost"));
              }
            }}
          >
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Repost
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
