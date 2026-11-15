import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Calendar, Check, FolderKanban, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  detailLine,
  pickerCopy,
  roleTag,
  rowAction,
  sendToast,
  splitTargets,
  type InviteKind,
  type InviteTarget,
} from "@/lib/itemInvite";
import { loadInviteTargets, sendItemInvite } from "@/lib/itemInviteApi";
import { cn } from "@/lib/utils";

/**
 * Pick one of your projects/gigs or events (or a public one listed in your
 * city) and invite this person to it. One tap sends; the row then says Sent.
 */
export function InvitePicker({
  kind,
  invitee,
  onBack,
  onCreate,
  onSent,
}: {
  kind: InviteKind;
  invitee: { userId: string; firstName: string };
  onBack: () => void;
  onCreate: () => void;
  onSent?: () => void;
}) {
  const copy = pickerCopy(kind, invitee.firstName);
  const cache = useQueryClient();
  const key = useMemo(() => ["item-invite-targets", kind, invitee.userId], [kind, invitee.userId]);
  const targets = useQuery({
    queryKey: key,
    queryFn: () => loadInviteTargets(invitee.userId, kind),
    refetchOnMount: "always",
  });
  const [sent, setSent] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const send = useMutation({
    mutationFn: (row: InviteTarget) => sendItemInvite(kind, row.item_id, invitee.userId),
    onMutate: (row) => setBusy(row.item_id),
    onSuccess: (result, row) => {
      if (result.status === "already_in") {
        cache.setQueryData<InviteTarget[]>(key, (rows) => rows?.map((r) => (r.item_id === row.item_id ? { ...r, state: result.state } : r)));
        toast.info(sendToast(result, invitee.firstName, row.title));
        return;
      }
      setSent((prev) => new Set(prev).add(row.item_id));
      cache.setQueryData<InviteTarget[]>(key, (rows) => rows?.map((r) => (r.item_id === row.item_id ? { ...r, state: "invited" } : r)));
      if (result.status === "already_invited") toast.info(sendToast(result, invitee.firstName, row.title));
      else toast.success(sendToast(result, invitee.firstName, row.title));
      onSent?.();
    },
    onError: (error: Error) => toast.error(error.message || "Could not send that invite"),
    onSettled: () => setBusy(null),
  });

  const { yours, nearby } = splitTargets(targets.data ?? []);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <div data-testid="invite-picker">
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/70"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h3 className="min-w-0 flex-1 text-[17px] font-semibold leading-tight text-[#faf5f0]">{copy.title}</h3>
      </div>

      {targets.isLoading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-white/60">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading
        </div>
      ) : targets.isError ? (
        <div className="rounded-2xl bg-white/5 px-4 py-6 text-center text-sm text-white/70">
          <p>{(targets.error as Error)?.message || "Could not load your list."}</p>
          <button type="button" className="mt-3 min-h-11 font-semibold text-[#ff9fc8] underline" onClick={() => void targets.refetch()}>
            Try again
          </button>
        </div>
      ) : (
        <>
          <Section heading={copy.yoursHeading} empty={copy.emptyYours} rows={yours} kind={kind} sent={sent} busy={busy}
            firstName={invitee.firstName} timeZone={timeZone} onInvite={(row) => send.mutate(row)} />
          <Section heading={copy.nearbyHeading} empty={copy.emptyNearby} rows={nearby} kind={kind} sent={sent} busy={busy}
            firstName={invitee.firstName} timeZone={timeZone} onInvite={(row) => send.mutate(row)} />
        </>
      )}

      <button
        type="button"
        onClick={onCreate}
        className="mx-auto mt-4 flex min-h-11 items-center gap-1.5 px-3 text-[13px] font-medium text-white/60 underline-offset-4 hover:underline"
      >
        <Plus className="h-4 w-4" /> {copy.create}
      </button>
    </div>
  );
}

function Section({
  heading,
  empty,
  rows,
  kind,
  sent,
  busy,
  firstName,
  timeZone,
  onInvite,
}: {
  heading: string;
  empty: string;
  rows: InviteTarget[];
  kind: InviteKind;
  sent: ReadonlySet<string>;
  busy: string | null;
  firstName: string;
  timeZone: string;
  onInvite: (row: InviteTarget) => void;
}) {
  return (
    <section className="mt-2">
      <h4 className="mono-label mb-2 text-[9px] tracking-[.2em] text-[#ff9fc8]">{heading}</h4>
      {rows.length === 0 ? (
        <p className="rounded-2xl bg-white/5 px-4 py-4 text-[13px] text-white/55">{empty}</p>
      ) : (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
          {rows.map((row) => (
            <TargetRow key={row.item_id} row={row} kind={kind} action={rowAction(row, sent, firstName)} busy={busy === row.item_id}
              disabledAll={busy !== null} timeZone={timeZone} onInvite={() => onInvite(row)} />
          ))}
        </ul>
      )}
    </section>
  );
}

function TargetRow({
  row,
  kind,
  action,
  busy,
  disabledAll,
  timeZone,
  onInvite,
}: {
  row: InviteTarget;
  kind: InviteKind;
  action: { label: string; disabled: boolean; done: boolean };
  busy: boolean;
  disabledAll: boolean;
  timeZone: string;
  onInvite: () => void;
}) {
  const tag = roleTag(row);
  const detail = detailLine(row, timeZone);
  const Icon = kind === "event" ? Calendar : FolderKanban;
  return (
    <li className="flex min-w-0 items-center gap-3 rounded-2xl bg-white/[0.07] p-2.5 ring-1 ring-white/10" data-testid="invite-row" data-state={action.disabled ? "off" : "on"}>
      <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#4a4150]">
        {row.cover_url ? <img src={row.cover_url} alt="" className="h-full w-full object-cover" /> : <Icon className="h-5 w-5 text-white/60" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-[#faf5f0]">{row.title}</span>
          {tag && <span className="shrink-0 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-white/70">{tag}</span>}
        </span>
        {detail && <span className="mt-0.5 block truncate text-xs text-white/55">{detail}</span>}
      </span>
      <button
        type="button"
        onClick={onInvite}
        disabled={action.disabled || disabledAll}
        aria-label={action.disabled ? `${row.title}: ${action.label}` : `${action.label} to ${row.title}`}
        className={cn(
          "inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full px-3.5 text-xs font-bold transition",
          action.done
            ? "bg-[#79C3CF]/20 text-[#bfe8ee]"
            : action.disabled
              ? "bg-white/5 text-white/40"
              : "bg-[#ff9fc8] text-[#2c1320] active:scale-95 disabled:opacity-60",
        )}
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : action.done ? <Check className="h-3.5 w-3.5" /> : null}
        {action.disabled ? action.label : "Invite"}
      </button>
    </li>
  );
}
