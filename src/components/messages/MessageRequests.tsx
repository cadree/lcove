import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Inbox } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { discovery, type MessageRequest } from "@/lib/creativeDiscovery";
import { safeWebLink } from "@/lib/tripMoney";

/** Quiet requests from people you haven't matched with. Hidden when there are none. */
export function MessageRequests({ onOpenChat }: { onOpenChat: (conversationId: string) => void }) {
  const { user } = useAuth();
  const cache = useQueryClient();
  const [open, setOpen] = useState(false);
  const inbox = useQuery({
    queryKey: ["message-requests", user?.id],
    queryFn: discovery.requests,
    enabled: !!user,
    staleTime: 30_000,
    retry: false,
  });
  const refresh = () => cache.invalidateQueries({ queryKey: ["message-requests"] });
  const connect = useMutation({
    mutationFn: (r: MessageRequest) => discovery.swipe(r.user_id, true),
    onSuccess: async (result, r) => {
      await refresh();
      void cache.invalidateQueries({ queryKey: ["conversations"] });
      if (result.matched && result.conversation_id) onOpenChat(result.conversation_id);
      else toast.success(`Connected with ${r.display_name || "them"}.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const ignore = useMutation({
    mutationFn: (r: MessageRequest) => discovery.ignoreRequest(r.id),
    onSuccess: () => void refresh(),
    onError: (e: Error) => toast.error(e.message),
  });
  const incoming = inbox.data?.incoming || [];
  if (!incoming.length) return null;
  return (
    <section className="border-b border-border/30 px-4 py-2" aria-label="Message requests">
      <button
        type="button"
        className="flex min-h-11 w-full items-center gap-2 text-left text-sm"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Inbox size={16} className="text-muted-foreground" />
        <span className="flex-1">Requests</span>
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">{incoming.length}</span>
        <ChevronDown size={16} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
      </button>
      {open && (
        <ul className="space-y-3 pb-2">
          <li className="text-xs text-muted-foreground">
            From people you haven't matched with. They aren't told you've seen these. Connect back to move the note into a chat.
          </li>
          {incoming.map((r) => {
            const photo = safeWebLink(r.avatar_url);
            return (
              <li key={r.id} className="rounded-2xl bg-white/5 p-3">
                <Link to={`/profile/${r.user_id}`} className="flex items-center gap-2">
                  <span className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-white/10">
                    {photo && <img src={photo} alt="" className="h-full w-full object-cover" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{r.display_name}</span>
                    {r.city && <span className="block truncate text-xs text-muted-foreground">{r.city}</span>}
                  </span>
                </Link>
                <p className="mt-2 whitespace-pre-wrap text-sm">{r.body}</p>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" disabled={connect.isPending} onClick={() => connect.mutate(r)}>Connect back</Button>
                  <Button size="sm" variant="ghost" disabled={ignore.isPending} onClick={() => ignore.mutate(r)}>Ignore</Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
