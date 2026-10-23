import { useState } from "react";
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
  const [caption, setCaption] = useState("");

  const close = () => {
    if (pending) return;
    setCaption("");
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
          onChange={(event) => setCaption(event.target.value.slice(0, 500))}
          placeholder="Write a caption (optional)"
          aria-label="Repost caption"
          rows={4}
          maxLength={500}
        />
        <p className="text-right text-xs text-muted-foreground">{caption.trim().length}/500</p>
        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={pending}>Cancel</Button>
          <Button
            disabled={pending}
            onClick={async () => {
              try {
                await onSubmit(caption);
                setCaption("");
                onOpenChange(false);
              } catch {
                // The repost action already reports the error.
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
