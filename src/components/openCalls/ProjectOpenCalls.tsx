import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, MapPin, Megaphone, Plus } from "lucide-react";
import { toast } from "sonner";
import { CityInput } from "@/components/city/CityInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  CALL_MAX_DAYS, CALL_NOTE_MAX, callApplyHref, callCity, callDateLabel, callDraftError, callEnded, roleOpen,
  type CallDraft, type CallRole, type OpenCall,
} from "@/lib/openCalls";
import { openCallsApi } from "@/lib/openCallsApi";
import { addDays, utcDay } from "@/lib/openTo";

export function PaidPill({ paid }: { paid: boolean }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${paid ? "bg-emerald-500/15 text-emerald-300" : "bg-muted text-muted-foreground"}`}>
      {paid ? "Paid" : "Unpaid"}
    </span>
  );
}

/**
 * Open calls on a project. The owner posts and closes them; everyone else sees
 * the ones still taking people, with Apply going to the existing role application.
 */
export function ProjectOpenCalls({
  projectId, roles, isOwner, onApply,
}: {
  projectId: string;
  roles: CallRole[];
  isOwner: boolean;
  /** Pick the role in the page's own apply form. Without it, Apply links to the project page. */
  onApply?: (roleId: string) => void;
}) {
  const cache = useQueryClient();
  const [posting, setPosting] = useState(false);
  const calls = useQuery({
    queryKey: ["project-open-calls", projectId],
    queryFn: () => openCallsApi.forProject(projectId),
    enabled: !!projectId,
    staleTime: 30_000,
  });
  const close = useMutation({
    mutationFn: (id: string) => openCallsApi.close(id),
    onSuccess: () => {
      toast.success("Call closed");
      void cache.invalidateQueries({ queryKey: ["project-open-calls", projectId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const byRole = new Map(roles.map((r) => [r.id, r]));
  const list = (calls.data || [])
    .map((call) => ({ call, role: byRole.get(call.role_id), ended: callEnded(call, byRole.get(call.role_id)) }))
    .filter((c) => isOwner || !c.ended);
  if (!isOwner && !list.length) return null;
  return (
    <section className="rounded-2xl border border-border/50 bg-card/95 p-5 shadow-lg" aria-labelledby={`open-calls-${projectId}`} data-testid="project-open-calls">
      <div className="flex items-center justify-between gap-2">
        <h3 id={`open-calls-${projectId}`} className="flex items-center gap-2 font-display text-lg font-semibold">
          <Megaphone className="h-5 w-5 text-primary" aria-hidden /> Open calls
        </h3>
        {isOwner && (
          <Button type="button" size="sm" variant="outline" className="min-h-11 rounded-full" onClick={() => setPosting(true)}>
            <Plus className="mr-1 h-4 w-4" /> Post a call
          </Button>
        )}
      </div>
      {isOwner && !list.length && (
        <p className="mt-2 text-sm text-muted-foreground">
          Need someone for a role? Post a call. It shows here and in Explore for people in that city.
        </p>
      )}
      <ul className="mt-2 divide-y divide-border/60">
        {list.map(({ call, role, ended }) => (
          <li key={call.id} className="py-3" data-testid="open-call">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {role?.role_name || "Role"} <PaidPill paid={call.paid} />
                  {ended && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{ended}</span>}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {callDateLabel(call.call_date)}</span>
                  <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {call.city_label}</span>
                </p>
                {call.description && <p className="mt-1.5 break-words text-sm text-foreground/85">{call.description}</p>}
              </div>
              {isOwner ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="min-h-11 shrink-0 text-muted-foreground"
                  disabled={close.isPending}
                  onClick={() => {
                    if (window.confirm("Close this call? It stops showing in Explore.")) close.mutate(call.id);
                  }}
                >
                  Close
                </Button>
              ) : onApply ? (
                <Button type="button" size="sm" className="min-h-11 shrink-0 rounded-full px-4" onClick={() => onApply(call.role_id)}>
                  Apply
                </Button>
              ) : (
                <Button asChild size="sm" className="min-h-11 shrink-0 rounded-full px-4">
                  <Link to={callApplyHref(call)}>Apply</Link>
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {isOwner && (
        <PostCallSheet
          open={posting}
          onOpenChange={setPosting}
          projectId={projectId}
          roles={roles.filter((r) => roleOpen(r) && !(calls.data || []).some((c) => c.role_id === r.id))}
          onPosted={() => {
            void cache.invalidateQueries({ queryKey: ["project-open-calls", projectId] });
            void cache.invalidateQueries({ queryKey: ["public-project", projectId] });
            void cache.invalidateQueries({ queryKey: ["projects"] });
          }}
        />
      )}
    </section>
  );
}

const NEW_ROLE = "__new";

function PostCallSheet({
  open, onOpenChange, projectId, roles, onPosted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  roles: CallRole[];
  onPosted: () => void;
}) {
  const [roleChoice, setRoleChoice] = useState<string>("");
  const [draft, setDraft] = useState<Omit<CallDraft, "roleId">>({ newRole: "", date: "", city: "", description: "" });
  const [paid, setPaid] = useState(true);
  const [tried, setTried] = useState(false);
  const choice = roleChoice || (roles[0]?.id ?? NEW_ROLE);
  const full = { ...draft, roleId: choice === NEW_ROLE ? null : choice };
  const error = callDraftError(full);
  const post = useMutation({
    mutationFn: () => {
      const city = callCity(draft.city)!;
      return openCallsApi.post({
        projectId,
        roleId: full.roleId,
        roleName: full.roleId ? null : draft.newRole.trim(),
        date: draft.date,
        cityKey: city.key,
        cityLabel: city.label,
        paid,
        description: draft.description.trim() || null,
      });
    },
    onSuccess: (result) => {
      if (result.listed) toast.success("Call posted. People in that city will see it in Explore.");
      else toast.success("Call posted on the project. It won't show in Explore while your profile is hidden from discovery.");
      setRoleChoice("");
      setDraft({ newRole: "", date: "", city: "", description: "" });
      setTried(false);
      onPosted();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const today = utcDay(new Date());
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-[28px] px-4 pb-8" style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))" }}>
        <SheetTitle className="ether-title pr-10 text-[22px]">Post an open call</SheetTitle>
        <SheetDescription className="mb-4 text-sm text-muted-foreground">
          Shows on this project and in Explore for people in the city you pick. Only the city is shared, never the address.
        </SheetDescription>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            setTried(true);
            if (!error) post.mutate();
          }}
        >
          <div>
            <label htmlFor="call-role" className="block text-xs text-muted-foreground">Role</label>
            <select
              id="call-role"
              value={choice}
              onChange={(e) => setRoleChoice(e.target.value)}
              className="mt-1 h-11 w-full rounded-[14px] border border-border bg-input px-3 text-base"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.role_name}</option>
              ))}
              <option value={NEW_ROLE}>New role…</option>
            </select>
            {choice === NEW_ROLE && (
              <Input
                aria-label="New role name"
                className="mt-2"
                value={draft.newRole}
                maxLength={70}
                placeholder="Gaffer, MUA, Model…"
                onChange={(e) => setDraft((d) => ({ ...d, newRole: e.target.value }))}
              />
            )}
          </div>
          <div>
            <label htmlFor="call-date" className="block text-xs text-muted-foreground">Date</label>
            <Input
              id="call-date"
              type="date"
              className="mt-1"
              min={today}
              max={addDays(today, CALL_MAX_DAYS)}
              value={draft.date}
              onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
            />
          </div>
          <div>
            <label htmlFor="call-city" className="block text-xs text-muted-foreground">City</label>
            <CityInput id="call-city" className="mt-1" value={draft.city} placeholder="Charlotte, NC" onChange={(city) => setDraft((d) => ({ ...d, city }))} />
          </div>
          <div className="flex rounded-full bg-muted p-1" role="group" aria-label="Pay">
            {[true, false].map((value) => (
              <button
                key={String(value)}
                type="button"
                aria-pressed={paid === value}
                onClick={() => setPaid(value)}
                className={`min-h-11 flex-1 rounded-full text-sm ${paid === value ? "bg-foreground text-background" : "text-muted-foreground"}`}
              >
                {value ? "Paid" : "Unpaid"}
              </button>
            ))}
          </div>
          <div>
            <label htmlFor="call-description" className="block text-xs text-muted-foreground">What it is (optional)</label>
            <Textarea
              id="call-description"
              className="mt-1"
              rows={3}
              maxLength={CALL_NOTE_MAX + 40}
              value={draft.description}
              placeholder="Two-hour night shoot, bring your own kit."
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            />
            <p className="mt-1 text-right text-[11px] text-muted-foreground">{draft.description.trim().length}/{CALL_NOTE_MAX}</p>
          </div>
          {tried && error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          <Button type="submit" className="min-h-11 w-full rounded-full" disabled={post.isPending}>
            {post.isPending ? "Posting…" : "Post call"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
