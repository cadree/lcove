import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, HandHeart } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  VOUCH_LINE, VOUCH_NOTE_MAX, cleanVouchNote, vouchNoteError, wrapUpOrder, wrapUpProgress, type WrapUpMember,
} from "@/lib/vouches";
import { vouchesApi } from "@/lib/vouchesApi";

/** Wrap-up on a completed project: members vouch for each other. Shows nothing to non-members. */
export function ProjectWrapUp({ projectId, projectTitle }: { projectId: string; projectTitle?: string | null }) {
  const cache = useQueryClient();
  const [picked, setPicked] = useState<WrapUpMember | null>(null);
  const wrapUp = useQuery({
    queryKey: ["project-wrap-up", projectId],
    queryFn: () => vouchesApi.wrapUp(projectId),
    enabled: !!projectId,
    staleTime: 30_000,
  });
  const refresh = (userId?: string) => {
    void cache.invalidateQueries({ queryKey: ["project-wrap-up", projectId] });
    if (userId) void cache.invalidateQueries({ queryKey: ["profile-vouches", userId] });
  };
  const undo = useMutation({
    mutationFn: (m: WrapUpMember) => vouchesApi.remove(m.vouch_id!),
    onSuccess: (_, m) => {
      toast.success("Vouch removed");
      refresh(m.user_id);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const data = wrapUp.data;
  if (!data?.member || !data.completed || !data.team.length) return null;
  const team = wrapUpOrder(data.team);
  return (
    <section className="rounded-2xl border border-border/50 bg-card/95 p-5 shadow-lg" aria-labelledby="wrap-up-title" data-testid="project-wrap-up">
      <h3 id="wrap-up-title" className="flex items-center gap-2 font-display text-lg font-semibold">
        <HandHeart className="h-5 w-5 text-primary" aria-hidden /> Wrap-up
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        It's done. Vouch for the people who showed up and delivered. It shows on their profile.
      </p>
      <p className="mono-label mt-3 text-[10px] text-muted-foreground">{wrapUpProgress(team)}</p>
      <ul className="mt-2 divide-y divide-border/60">
        {team.map((m) => (
          <li key={m.user_id} className="flex items-center gap-3 py-2.5" data-testid="wrap-up-member">
            <Link to={`/profile/${m.user_id}`} className="flex min-h-11 min-w-0 flex-1 items-center gap-3">
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarImage src={m.avatar_url || undefined} />
                <AvatarFallback>{(m.name || "?").charAt(0)}</AvatarFallback>
              </Avatar>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{m.name || "Member"}</span>
                <span className="block truncate text-xs text-muted-foreground">{m.role}</span>
              </span>
            </Link>
            {m.vouched ? (
              <div className="flex shrink-0 items-center gap-1">
                <span className="inline-flex items-center gap-1 text-xs text-primary"><Check className="h-3.5 w-3.5" /> Vouched</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="min-h-11 px-2 text-xs text-muted-foreground"
                  disabled={undo.isPending || !m.vouch_id}
                  onClick={() => {
                    if (window.confirm(`Remove your vouch for ${m.name || "them"}?`)) undo.mutate(m);
                  }}
                >
                  Undo
                </Button>
              </div>
            ) : (
              <Button type="button" size="sm" className="min-h-11 shrink-0 rounded-full px-4" onClick={() => setPicked(m)}>
                Vouch
              </Button>
            )}
          </li>
        ))}
      </ul>
      <VouchSheet
        member={picked}
        projectId={projectId}
        projectTitle={projectTitle}
        onClose={() => setPicked(null)}
        onDone={(m) => refresh(m.user_id)}
      />
    </section>
  );
}

function VouchSheet({
  member, projectId, projectTitle, onClose, onDone,
}: {
  member: WrapUpMember | null;
  projectId: string;
  projectTitle?: string | null;
  onClose: () => void;
  onDone: (m: WrapUpMember) => void;
}) {
  const [note, setNote] = useState("");
  const send = useMutation({
    mutationFn: (m: WrapUpMember) => vouchesApi.vouch(projectId, m.user_id, cleanVouchNote(note)),
    onSuccess: (_, m) => {
      toast.success(`You vouched for ${m.name || "them"}`);
      setNote("");
      onDone(m);
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const error = vouchNoteError(note);
  return (
    <Sheet open={!!member} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto rounded-t-[28px] px-4 pb-8" style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))" }}>
        <SheetTitle className="ether-title pr-10 text-[22px]">Vouch for {member?.name || "them"}</SheetTitle>
        <SheetDescription className="mb-4 text-sm text-muted-foreground">
          {projectTitle ? `On ${projectTitle}. ` : ""}It shows on their profile with your name.
        </SheetDescription>
        {member && (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!error) send.mutate(member);
            }}
          >
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-muted/40 p-3">
              <Check className="h-5 w-5 shrink-0 text-primary" aria-hidden />
              <p className="text-sm font-medium">{VOUCH_LINE}</p>
            </div>
            <div>
              <label htmlFor="vouch-note" className="block text-xs text-muted-foreground">Add a note (optional)</label>
              <Textarea
                id="vouch-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={VOUCH_NOTE_MAX + 40}
                rows={3}
                placeholder="What they brought to it"
                className="mt-1"
              />
              <p className={`mt-1 text-right text-[11px] ${error ? "text-destructive" : "text-muted-foreground"}`}>
                {error || `${(cleanVouchNote(note) || "").length}/${VOUCH_NOTE_MAX}`}
              </p>
            </div>
            <Button type="submit" className="min-h-11 w-full rounded-full" disabled={!!error || send.isPending}>
              {send.isPending ? "Sending…" : "Vouch"}
            </Button>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
