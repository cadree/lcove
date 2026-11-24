import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import {
  OPEN_TO, OPEN_TO_DEFAULT_DAYS, OPEN_TO_MAX_DAYS, addDays, cleanOpenTo, currentOpenTo, openToActive, openToUntilError,
  openToUntilLabel, utcDay, type OpenToRow, type OpenToTag,
} from "@/lib/openTo";
import { openToApi } from "@/lib/openToApi";
import { OpenToChips } from "./OpenToChips";

/** "Open to" line under the profile header. Visitors see current tags only. */
export function ProfileOpenTo({ userId, isOwner }: { userId: string; isOwner: boolean }) {
  const [editing, setEditing] = useState(false);
  const row = useQuery({
    queryKey: ["open-to", userId],
    queryFn: () => openToApi.forUser(userId),
    enabled: !!userId,
    staleTime: 60_000,
  });
  const tags = currentOpenTo(row.data);
  const expired = !!row.data && !openToActive(row.data);
  if (!isOwner && !tags.length) return null;
  return (
    <section className="px-4 pt-3" id="profile-open-to" data-testid="profile-open-to">
      {tags.length ? (
        <div className="flex items-start gap-2">
          <OpenToChips tags={tags} until={openToUntilLabel(row.data)} className="min-w-0 flex-1 py-1" />
          {isOwner && (
            <Button type="button" variant="ghost" size="icon" className="h-11 w-11 shrink-0" aria-label="Edit what you're open to" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </div>
      ) : isOwner && !row.isLoading ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex min-h-11 w-full items-center gap-2 rounded-2xl border border-dashed border-border px-3 text-left text-sm text-muted-foreground"
        >
          <Plus className="h-4 w-4 shrink-0" />
          {expired ? "Your “open to” tags expired. Tap to renew them." : "Add what you're open to: shoots, collabs, paid gigs…"}
        </button>
      ) : null}
      {isOwner && <OpenToSheet open={editing} onOpenChange={setEditing} userId={userId} row={row.data ?? null} />}
    </section>
  );
}

function OpenToSheet({ open, onOpenChange, userId, row }: { open: boolean; onOpenChange: (open: boolean) => void; userId: string; row: OpenToRow | null }) {
  const cache = useQueryClient();
  const [picked, setPicked] = useState<OpenToTag[]>([]);
  const [until, setUntil] = useState("");
  useEffect(() => {
    if (!open) return;
    setPicked(cleanOpenTo(row?.tags || []));
    // An expired end date can't be kept; start fresh.
    setUntil(row?.until && !openToUntilError(row.until) ? row.until : "");
  }, [open, row]);
  const save = useMutation({
    mutationFn: () => openToApi.save(picked, until || null),
    onSuccess: (saved) => {
      toast.success(saved.tags.length ? "Saved. People can see what you're open to." : "Cleared");
      void cache.invalidateQueries({ queryKey: ["open-to", userId] });
      void cache.invalidateQueries({ queryKey: ["people-members"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const today = utcDay(new Date());
  const untilError = openToUntilError(until || null);
  const toggle = (tag: OpenToTag) =>
    setPicked((now) => (now.includes(tag) ? now.filter((t) => t !== tag) : cleanOpenTo([...now, tag])));
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto rounded-t-[28px] px-4 pb-8" style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))" }}>
        <SheetTitle className="ether-title pr-10 text-[22px]">Open to</SheetTitle>
        <SheetDescription className="mb-4 text-sm text-muted-foreground">
          Shows on your profile and your card in Explore, so people know what to ask you about.
        </SheetDescription>
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (!untilError) save.mutate();
          }}
        >
          <div className="flex flex-wrap gap-2" role="group" aria-label="What you're open to">
            {OPEN_TO.map((tag) => {
              const on = picked.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(tag.id)}
                  className={`min-h-11 rounded-full border px-4 text-sm transition ${on ? "border-foreground bg-foreground text-background" : "border-border bg-transparent text-foreground"}`}
                >
                  {tag.label}
                </button>
              );
            })}
          </div>
          <div>
            <label className="block text-xs text-muted-foreground" htmlFor="open-to-until">Until (optional)</label>
            <div className="mt-1 flex items-center gap-2">
              <Input
                id="open-to-until"
                type="date"
                value={until}
                min={today}
                max={addDays(today, OPEN_TO_MAX_DAYS)}
                onChange={(e) => setUntil(e.target.value)}
                className="h-11 flex-1"
              />
              {until && (
                <Button type="button" variant="ghost" className="min-h-11" onClick={() => setUntil("")}>No date</Button>
              )}
            </div>
            <p className={`mt-1 text-xs ${untilError ? "text-destructive" : "text-muted-foreground"}`}>
              {untilError || (until ? "Hidden automatically after this day." : `No date: shows for ${OPEN_TO_DEFAULT_DAYS} days, then hides until you save again.`)}
            </p>
          </div>
          <div className="flex gap-2">
            {!!row && (
              <Button type="button" variant="outline" className="min-h-11 flex-1 rounded-full" disabled={save.isPending} onClick={() => { setPicked([]); setUntil(""); }}>
                Clear all
              </Button>
            )}
            <Button type="submit" className="min-h-11 flex-1 rounded-full" disabled={!!untilError || save.isPending || (!picked.length && !row)}>
              {save.isPending ? "Saving…" : picked.length ? "Save" : "Save (clear)"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
