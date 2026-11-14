import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { discovery } from "@/lib/creativeDiscovery";

/** Message someone from discovery. Matched: opens the chat. Not matched: a quiet request they can answer later. */
export function MessageRequestDialog({
  person,
  open,
  onOpenChange,
}: {
  person: { user_id: string; name: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [body, setBody] = useState("");
  const navigate = useNavigate();
  const cache = useQueryClient();
  const send = useMutation({
    mutationFn: () => discovery.requestMessage(person.user_id, body),
    onSuccess: (result) => {
      onOpenChange(false);
      setBody("");
      void cache.invalidateQueries({ queryKey: ["message-requests"] });
      if (result.status === "matched" && result.conversation_id) navigate(`/messages?chat=${result.conversation_id}`);
      else toast.success(`Sent. ${person.name} sees it in Requests, without a notification.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const left = 500 - body.length;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Message {person.name}</DialogTitle>
          <DialogDescription>
            If you haven't matched, this waits quietly in their Requests, with no notification. If you both connect, it becomes the first message in your chat.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (body.trim()) send.mutate();
          }}
        >
          <Textarea
            aria-label={`Message to ${person.name}`}
            value={body}
            maxLength={500}
            rows={4}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Say what you'd like to make together."
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground" aria-live="polite">{left} left</span>
            <Button type="submit" disabled={!body.trim() || send.isPending}>
              {send.isPending ? "Sending…" : "Send request"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
