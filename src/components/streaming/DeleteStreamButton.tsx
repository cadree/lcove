import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useDeleteStream } from "@/hooks/useLiveStreams";

export function DeleteStreamButton({
  streamId,
  onDeleted,
  label = "Delete",
}: {
  streamId: string;
  onDeleted?: () => void;
  label?: string;
}) {
  const deleteStream = useDeleteStream();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        data-testid="delete-stream"
        className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
      >
        <Trash2 className="mr-1 h-4 w-4" />
        {label}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this stream?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the stream and its replay. People will no longer see it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={(event) => event.stopPropagation()}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              data-testid="confirm-delete-stream"
              disabled={deleteStream.isPending}
              onClick={async (event) => {
                event.stopPropagation();
                await deleteStream.mutateAsync(streamId);
                setOpen(false);
                onDeleted?.();
              }}
            >
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
