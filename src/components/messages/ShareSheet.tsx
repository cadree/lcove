import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useConversations } from "@/hooks/useConversations";
import { sendChatShare } from "@/lib/sendChatShare";
import { shareLink } from "@/lib/shareLink";
import type { ShareCard } from "@/lib/shareCard";

interface ShareSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: ShareCard | null;
  linkUrl: string;
}

export function ShareSheet({ open, onOpenChange, card, linkUrl }: ShareSheetProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { conversations, isLoading } = useConversations();
  const [query, setQuery] = useState("");
  const [note, setNote] = useState("");
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return conversations.filter((conversation) => {
      const name = labelFor(conversation, user?.id);
      return !needle || name.toLowerCase().includes(needle);
    });
  }, [conversations, query, user?.id]);

  const send = async (conversationId: string, name: string) => {
    if (!user || !card) return;
    setSendingId(conversationId);
    setError(null);
    try {
      await sendChatShare({ conversationId, senderId: user.id, card, note });
      queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      toast.success(`Sent to ${name}`);
      setNote("");
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not send";
      setError(message);
      toast.error(message);
    } finally {
      setSendingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 border-border bg-background p-0">
        <div className="border-b border-border px-5 pb-4 pt-5">
          <DialogTitle className="ether-title text-left text-3xl">Send</DialogTitle>
          <p className="mt-1 text-sm text-muted-foreground">A private message to a friend or a group chat.</p>
        </div>
        <div className="space-y-3 px-5 py-4">
          <Input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Add a note"
            aria-label="Note"
            className="min-h-11"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search chats"
            aria-label="Search chats"
            className="min-h-11"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {isLoading && (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
            {!isLoading && rows.length === 0 && (
              <p className="rounded-[14px] border border-border bg-card px-3 py-6 text-center text-sm text-muted-foreground">
                No chats yet. Open Messages and start one, then send this here.
              </p>
            )}
            {rows.map((conversation) => {
              const name = labelFor(conversation, user?.id);
              const busy = sendingId === conversation.id;
              return (
                <button
                  key={conversation.id}
                  type="button"
                  disabled={!card || sendingId !== null}
                  onClick={() => send(conversation.id, name)}
                  className="flex min-h-11 w-full items-center justify-between rounded-[14px] border border-border bg-card px-3 text-left text-foreground disabled:opacity-60"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-body text-sm font-extrabold">{name}</span>
                    <span className="mono-label text-[9px] text-muted-foreground">
                      {conversation.type === "group" ? "Group" : "Direct"}
                    </span>
                  </span>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 shrink-0" />}
                </button>
              );
            })}
          </div>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full"
            onClick={() => shareLink({ title: card?.title, text: card?.subtitle, url: linkUrl })}
          >
            Share link
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function labelFor(
  conversation: { type: string; name: string | null; participants?: { user_id: string; profile?: { display_name: string | null } | null }[] },
  userId?: string,
) {
  if (conversation.type === "group") return conversation.name || "Group";
  const other = conversation.participants?.find((person) => person.user_id !== userId);
  return other?.profile?.display_name || "Direct chat";
}
