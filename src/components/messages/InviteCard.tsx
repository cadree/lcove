import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Check, FolderKanban, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cardStatus, joinLabel, whenLabel } from "@/lib/itemInvite";
import { loadInviteCard, respondItemInvite } from "@/lib/itemInviteApi";
import { cn } from "@/lib/utils";

/**
 * A project/gig or event invite, shown in the direct chat between the person
 * who sent it and the person invited. Both see where it stands; only the
 * invitee gets Join/RSVP, then the next step (pick a role, get a ticket, RSVP).
 */
export function InviteCard({ inviteId }: { inviteId: string }) {
  const navigate = useNavigate();
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false);
  const key = ["item-invite-card", inviteId];
  const { data: card, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => loadInviteCard(inviteId),
    refetchInterval: 20_000,
    staleTime: 10_000,
  });

  if (isLoading) {
    return <div className="h-[92px] w-[240px] animate-pulse rounded-[2px] border border-border bg-card" aria-hidden />;
  }
  if (!card) return null;

  const status = cardStatus(card);
  const when = whenLabel({ item_type: card.kind, starts_at: card.startsAt }, Intl.DateTimeFormat().resolvedOptions().timeZone);
  const detail = [when, card.place].filter(Boolean).join(" · ");
  const Icon = card.kind === "event" ? Calendar : FolderKanban;
  const itemPath = `/${card.kind}/${card.itemId}`;

  const answer = async (accept: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await respondItemInvite(card.inviteId, accept);
      await Promise.all([
        cache.invalidateQueries({ queryKey: key }),
        cache.invalidateQueries({ queryKey: ["notifications"] }),
        cache.invalidateQueries({ queryKey: ["messages"] }),
      ]);
      if (accept) navigate(result.path ?? card.path ?? itemPath);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not answer that invite");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid="invite-card" data-stage={card.stage} className="w-[240px] overflow-hidden rounded-[2px] border border-border bg-card text-left">
      <button type="button" className="block w-full text-left" onClick={() => navigate(itemPath)}>
        {card.coverUrl ? (
          <img src={card.coverUrl} alt="" className="aspect-[16/9] w-full object-cover" />
        ) : (
          <span className="flex aspect-[16/9] w-full items-center justify-center bg-muted">
            <Icon className="h-7 w-7 text-muted-foreground" />
          </span>
        )}
        <span className="block px-3 pt-2">
          <span className="mono-label block text-[9px] uppercase text-muted-foreground">
            {card.kind === "event" ? "Event invite" : "Project invite"}
          </span>
          <span className="mt-0.5 block truncate text-sm font-semibold text-foreground">{card.title}</span>
          {detail && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{detail}</span>}
        </span>
      </button>
      <div className="px-3 pb-3 pt-2">
        <p
          data-testid="invite-card-status"
          className={cn(
            "flex items-center gap-1 text-xs",
            status.tone === "done" ? "text-emerald-400" : status.tone === "progress" ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {status.tone === "done" && <Check className="h-3.5 w-3.5" />}
          {status.line}
        </p>
        {!card.available && card.stage === "pending" && <p className="mt-1 text-xs text-muted-foreground">No longer open</p>}
        {status.action === "answer" && (
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void answer(true)}
              className="inline-flex h-11 flex-1 items-center justify-center gap-1 rounded-full bg-primary px-4 text-xs font-bold text-primary-foreground disabled:opacity-60"
            >
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {joinLabel(card.kind)}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void answer(false)}
              className="inline-flex h-11 items-center rounded-full border border-border px-4 text-xs font-bold disabled:opacity-60"
            >
              Not now
            </button>
          </div>
        )}
        {status.action === "continue" && card.path && (
          <button
            type="button"
            onClick={() => navigate(card.path!)}
            className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-full bg-primary px-4 text-xs font-bold text-primary-foreground"
          >
            {status.continueLabel}
          </button>
        )}
      </div>
    </div>
  );
}
