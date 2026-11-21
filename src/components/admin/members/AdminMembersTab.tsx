import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowDownUp,
  Ban,
  ChevronLeft,
  ChevronRight,
  Coins,
  Eye,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  RotateCcw,
  Search,
  ShieldCheck,
  ShieldOff,
  SlidersHorizontal,
  Trash2,
  UserCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchMatchingMemberIds,
  runBulkAction,
  useAdminMemberDetail,
  useAdminMemberPage,
  useHideMembersLocally,
  useRefreshAdminMembers,
} from "@/hooks/useAdminMembers";
import {
  activeFilterCount,
  bulkActionsFor,
  DESTRUCTIVE,
  memberLabel,
  PAGE_SIZES,
  QUICK_VIEWS,
  resultSummary,
  sameFilters,
  standing,
  undoPlan,
  type AdminMember,
  type BulkAction,
  type BulkResult,
  type MemberFilters,
  type MemberSort,
  type SortDir,
  type StandingTone,
} from "@/lib/adminMembers";
import { readNumber } from "@/lib/numberField";

export interface MemberRowActions {
  credits: (member: AdminMember) => void;
  status: (member: AdminMember) => void;
  message: (member: AdminMember) => void;
  suspend: (member: AdminMember) => void;
  unsuspend: (member: AdminMember) => void;
  remove: (member: AdminMember) => void;
  restore: (member: AdminMember) => void;
  toggleAdmin: (member: AdminMember) => void;
}

type BulkChoice = BulkAction | "credits";

const BULK_LABEL: Record<BulkChoice, string> = {
  message: "Message",
  suspend: "Suspend",
  unsuspend: "Unsuspend",
  set_level: "Change level",
  ban: "Ban",
  unban: "Unban",
  remove: "Remove",
  restore: "Restore",
  credits: "Award credits",
};

const SORTS: { value: MemberSort; label: string }[] = [
  { value: "joined", label: "Joined" },
  { value: "active", label: "Last active" },
  { value: "name", label: "Name" },
  { value: "city", label: "City" },
  { value: "level", label: "Level" },
];

const TONE: Record<StandingTone, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-green-500/15 text-green-500" },
  pending: { label: "Pending", className: "bg-muted text-muted-foreground" },
  denied: { label: "Denied", className: "bg-orange-500/15 text-orange-500" },
  suspended: { label: "Suspended", className: "bg-amber-500/15 text-amber-500" },
  banned: { label: "Banned", className: "bg-red-500/15 text-red-500" },
  removed: { label: "Removed", className: "bg-red-900/40 text-red-200" },
};

function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

function initial(name: string): string {
  return (name.replace(/[^\p{L}\p{N}]/gu, "")[0] ?? "?").toUpperCase();
}

function ago(value: string | null): string {
  if (!value) return "never";
  return formatDistanceToNow(new Date(value), { addSuffix: true });
}

function StandingBadge({ member }: { member: AdminMember }) {
  const tone = TONE[standing(member)];
  return <Badge className={`shrink-0 px-2 py-0 text-[11px] font-medium ${tone.className}`}>{tone.label}</Badge>;
}

export function AdminMembersTab({ actions }: { actions: MemberRowActions }) {
  const [search, setSearch] = useState("");
  const query = useDebounced(search);
  const [filters, setFilters] = useState<MemberFilters>({});
  const [sort, setSort] = useState<MemberSort>("joined");
  const [dir, setDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(50);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [detail, setDetail] = useState<AdminMember | null>(null);
  const [bulk, setBulk] = useState<BulkChoice | null>(null);
  const [selectingAll, setSelectingAll] = useState(false);

  const effective = useMemo<MemberFilters>(() => ({ ...filters, q: query || undefined }), [filters, query]);
  const { data, isLoading, isFetching, error } = useAdminMemberPage({ filters: effective, sort, dir, page, pageSize });
  const rows = useMemo(() => data?.rows ?? [], [data]);
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const refresh = useRefreshAdminMembers();
  const hideLocally = useHideMembersLocally();

  // A new filter is a new list: start at the top and drop the old selection.
  useEffect(() => {
    setPage(0);
    setSelected(new Set());
  }, [effective, sort, dir, pageSize]);

  useEffect(() => {
    if (page > 0 && page >= pages) setPage(pages - 1);
  }, [page, pages]);

  const pageIds = rows.map((row) => row.user_id);
  const pageAllSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const allMatchingSelected = total > 0 && selected.size >= total;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const togglePage = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (pageAllSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });

  const selectAllMatching = async () => {
    setSelectingAll(true);
    try {
      const ids = await fetchMatchingMemberIds(effective);
      setSelected(new Set(ids));
      if (ids.length < total) toast.message(`Selected the first ${ids.length.toLocaleString()} that match`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not select everyone");
    } finally {
      setSelectingAll(false);
    }
  };

  const applyView = (next: MemberFilters) => {
    setFilters(next);
    setSearch("");
  };

  const currentView = QUICK_VIEWS.find((view) => sameFilters(view.filters, filters));
  const extraFilters = activeFilterCount(filters);
  const bulkChoices: BulkChoice[] = [...bulkActionsFor(filters), ...(filters.removed === "only" ? [] : (["credits"] as const))];

  const runAndReport = async (
    action: BulkAction,
    ids: string[],
    options: { reason?: string; payload?: Record<string, unknown> },
    allowUndo: boolean,
  ) => {
    const toastId = toast.loading(`${BULK_LABEL[action]}: 0 of ${ids.length}`);
    const result = await runBulkAction(action, ids, {
      ...options,
      onProgress: (n) => toast.loading(`${BULK_LABEL[action]}: ${n} of ${ids.length}`, { id: toastId }),
    });
    if (action === "remove" || action === "restore") hideLocally(result.done);
    refresh();
    reportResult(result, toastId, allowUndo);
    return result;
  };

  const reportResult = (result: BulkResult, toastId: string | number, allowUndo: boolean) => {
    const steps = allowUndo ? undoPlan(result) : [];
    const firstError = result.errors[0]?.error;
    const options = {
      id: toastId,
      duration: 10_000,
      description: firstError ? `First problem: ${firstError}` : undefined,
      action: steps.length
        ? {
            label: "Undo",
            onClick: async () => {
              for (const step of steps) {
                await runAndReport(step.action, step.userIds, { payload: step.payload, reason: "Undo" }, false);
              }
            },
          }
        : undefined,
    };
    if (result.succeeded === 0) toast.error(resultSummary(result), options);
    else if (result.failed > 0) toast.warning(resultSummary(result), options);
    else toast.success(resultSummary(result), options);
  };

  const awardCredits = async (ids: string[], amount: number, reason: string) => {
    const toastId = toast.loading(`Awarding credits: 0 of ${ids.length}`);
    let ok = 0;
    let failed = 0;
    let firstError: string | undefined;
    for (let i = 0; i < ids.length; i += 5) {
      const batch = ids.slice(i, i + 5);
      const results = await Promise.allSettled(
        batch.map(async (target) => {
          const { data: awarded, error: awardError } = await supabase.functions.invoke("award-credits", {
            body: { target_user_id: target, amount, description: reason, reference_type: "admin_award" },
          });
          if (awardError) throw awardError;
          if (awarded?.error) throw new Error(awarded.error);
        }),
      );
      for (const r of results) {
        if (r.status === "fulfilled") ok += 1;
        else {
          failed += 1;
          firstError ??= r.reason instanceof Error ? r.reason.message : String(r.reason);
        }
      }
      toast.loading(`Awarding credits: ${Math.min(i + 5, ids.length)} of ${ids.length}`, { id: toastId });
    }
    refresh();
    const summary = failed ? `Awarded credits to ${ok}, ${failed} failed` : `Awarded credits to ${ok}`;
    const opts = { id: toastId, description: firstError ? `First problem: ${firstError}` : undefined };
    if (ok === 0) toast.error(summary, opts);
    else if (failed) toast.warning(summary, opts);
    else toast.success(summary, opts);
  };

  const singleRemove = (member: AdminMember) => actions.remove(member);

  return (
    <div className="space-y-3 pb-28">
      {/* Search, filters and sort */}
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, city, phone"
            className="h-10 pl-9 pr-8"
            aria-label="Search members"
          />
          {search && (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground"
              onClick={() => setSearch("")}
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button variant="outline" size="sm" className="h-10 shrink-0 gap-1.5 px-3" onClick={() => setFiltersOpen(true)}>
          <SlidersHorizontal className="h-4 w-4" />
          <span className="hidden sm:inline">Filters</span>
          {extraFilters > 0 && <span className="rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground">{extraFilters}</span>}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-10 shrink-0 gap-1.5 px-3" aria-label="Sort">
              <ArrowDownUp className="h-4 w-4" />
              <span className="hidden sm:inline">{SORTS.find((s) => s.value === sort)?.label}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {SORTS.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onClick={() => {
                  if (option.value === sort) setDir(dir === "asc" ? "desc" : "asc");
                  else {
                    setSort(option.value);
                    setDir(option.value === "name" || option.value === "city" ? "asc" : "desc");
                  }
                }}
              >
                {option.label}
                {option.value === sort && <span className="ml-auto pl-4 text-xs text-muted-foreground">{dir === "asc" ? "A→Z / old first" : "Z→A / new first"}</span>}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Quick views */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" role="tablist" aria-label="Quick views">
        {QUICK_VIEWS.map((view) => {
          const on = currentView?.id === view.id;
          return (
            <button
              key={view.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => applyView(view.filters)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                on ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"
              }`}
            >
              {view.label}
            </button>
          );
        })}
      </div>

      {/* Count and select */}
      <div className="flex min-h-9 items-center gap-3 text-sm">
        <Checkbox
          checked={pageAllSelected}
          onCheckedChange={togglePage}
          disabled={rows.length === 0}
          aria-label="Select this page"
        />
        <div className="min-w-0 flex-1 text-muted-foreground">
          {isLoading ? "Loading…" : `${total.toLocaleString()} ${total === 1 ? "person" : "people"}`}
          {isFetching && !isLoading && <Loader2 className="ml-2 inline h-3 w-3 animate-spin" />}
        </div>
        {pageAllSelected && !allMatchingSelected && total > rows.length && (
          <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={selectAllMatching} disabled={selectingAll}>
            {selectingAll ? "Selecting…" : `Select all ${total.toLocaleString()}`}
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error instanceof Error ? error.message : "Could not load members"}</p>}

      {/* Rows */}
      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
        {isLoading
          ? Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-14 rounded-none" />)
          : rows.map((member) => (
              <MemberRow
                key={member.user_id}
                member={member}
                checked={selected.has(member.user_id)}
                onToggle={() => toggle(member.user_id)}
                onOpen={() => setDetail(member)}
                actions={{ ...actions, remove: singleRemove }}
              />
            ))}
        {!isLoading && rows.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">No one matches this view.</p>
        )}
      </div>

      {/* Pages */}
      {total > 0 && (
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
            <SelectTrigger className="h-8 w-[92px] text-xs" aria-label="Rows per page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size} / page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span>
            {(page * pageSize + 1).toLocaleString()}–{Math.min(total, (page + 1) * pageSize).toLocaleString()} of {total.toLocaleString()}
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Previous page">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)} aria-label="Next page">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Sticky bulk bar */}
      {selected.size > 0 && (
        <div
          className="fixed inset-x-0 z-40 px-3"
          style={{ bottom: "calc(84px + env(safe-area-inset-bottom, 0px) + 8px)" }}
          data-testid="bulk-bar"
        >
          <div className="mx-auto flex max-w-3xl items-center gap-2 rounded-2xl border border-border bg-background/95 p-2 shadow-xl backdrop-blur">
            <Button variant="ghost" size="icon" className="h-9 w-8 shrink-0" onClick={() => setSelected(new Set())} aria-label="Clear selection">
              <X className="h-4 w-4" />
            </Button>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{selected.size.toLocaleString()}<span className="hidden min-[380px]:inline"> selected</span></span>
            {bulkChoices.includes("message") && (
              <Button size="sm" variant="outline" className="h-9 gap-1 px-2.5" onClick={() => setBulk("message")}>
                <MessageCircle className="h-4 w-4" />
                <span>Message</span>
              </Button>
            )}
            {bulkChoices.includes("suspend") && (
              <Button size="sm" variant="outline" className="h-9 gap-1 px-2.5" onClick={() => setBulk("suspend")}>
                <Ban className="h-4 w-4" />
                <span>Suspend</span>
              </Button>
            )}
            {bulkChoices.includes("restore") && (
              <Button size="sm" variant="outline" className="h-9 gap-1.5" onClick={() => setBulk("restore")}>
                <RotateCcw className="h-4 w-4" />
                Restore
              </Button>
            )}
            {bulkChoices.length > 2 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" className="h-9 gap-1 px-3">
                    More
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="top">
                  {bulkChoices
                    .filter((choice) => !["message", "suspend", "restore"].includes(choice))
                    .map((choice) => (
                      <DropdownMenuItem
                        key={choice}
                        onClick={() => setBulk(choice)}
                        className={choice === "remove" || choice === "ban" ? "text-destructive focus:text-destructive" : undefined}
                      >
                        {BULK_LABEL[choice]}
                      </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      )}

      <FiltersSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        filters={filters}
        onApply={(next) => {
          setFilters(next);
          setFiltersOpen(false);
        }}
      />

      <MemberDetailSheet member={detail} onClose={() => setDetail(null)} actions={actions} />

      <BulkDialog
        choice={bulk}
        count={selected.size}
        onClose={() => setBulk(null)}
        onConfirm={async (choice, values) => {
          const ids = Array.from(selected);
          setBulk(null);
          if (choice === "credits") {
            await awardCredits(ids, values.amount ?? 0, values.reason ?? "");
            return;
          }
          const payload =
            choice === "set_level" ? { level: values.level } : choice === "message" ? { title: values.title, body: values.body } : undefined;
          const result = await runAndReport(choice, ids, { reason: values.reason, payload }, choice !== "message");
          // Keep only the people that failed selected, so a retry is one tap.
          setSelected(new Set(result.errors.map((e) => e.user_id)));
        }}
      />
    </div>
  );
}

function MemberRow({
  member,
  checked,
  onToggle,
  onOpen,
  actions,
}: {
  member: AdminMember;
  checked: boolean;
  onToggle: () => void;
  onOpen: () => void;
  actions: MemberRowActions;
}) {
  const name = memberLabel(member);
  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 ${checked ? "bg-primary/5" : ""}`}
      data-testid="member-row"
      data-user-id={member.user_id}
    >
      <Checkbox checked={checked} onCheckedChange={onToggle} aria-label={`Select ${name}`} />
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <Avatar className="h-9 w-9 shrink-0">
          {member.avatar_url && <AvatarImage src={member.avatar_url} alt="" />}
          <AvatarFallback className="text-xs">{initial(name)}</AvatarFallback>
        </Avatar>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium">{name}</span>
            {member.is_admin && <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-label="Admin" />}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {[member.email, member.city, member.mindset_level ? `L${member.mindset_level}` : null].filter(Boolean).join(" · ")}
          </span>
        </span>
        <span className="hidden shrink-0 text-xs text-muted-foreground md:block md:w-28">{ago(member.last_active_at)}</span>
        <span className="hidden shrink-0 text-xs text-muted-foreground md:block md:w-14">
          <Coins className="mr-1 inline h-3 w-3" />
          {member.credit_balance}
        </span>
        <StandingBadge member={member} />
      </button>
      <RowMenu member={member} onOpen={onOpen} actions={actions} />
    </div>
  );
}

function RowMenu({ member, onOpen, actions }: { member: AdminMember; onOpen: () => void; actions: MemberRowActions }) {
  const removed = !!member.deleted_at;
  const canUnsuspend = member.is_suspended && !removed && member.access_status !== "banned";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label={`Actions for ${memberLabel(member)}`}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={onOpen}>
          <Eye className="mr-2 h-4 w-4" /> View
        </DropdownMenuItem>
        {!removed && (
          <>
            <DropdownMenuItem onClick={() => actions.message(member)}>
              <MessageCircle className="mr-2 h-4 w-4" /> Message
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => actions.credits(member)}>
              <Coins className="mr-2 h-4 w-4" /> Credits
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => actions.status(member)}>Status</DropdownMenuItem>
            {canUnsuspend ? (
              <DropdownMenuItem onClick={() => actions.unsuspend(member)}>
                <UserCheck className="mr-2 h-4 w-4" /> Unsuspend
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => actions.suspend(member)}>
                <Ban className="mr-2 h-4 w-4" /> Suspend
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => actions.toggleAdmin(member)}>
              {member.is_admin ? <ShieldOff className="mr-2 h-4 w-4" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
              {member.is_admin ? "Remove admin" : "Make admin"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {removed ? (
          <DropdownMenuItem onClick={() => actions.restore(member)}>
            <RotateCcw className="mr-2 h-4 w-4" /> Restore
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => actions.remove(member)}>
            <Trash2 className="mr-2 h-4 w-4" /> Remove
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function FiltersSheet({
  open,
  onOpenChange,
  filters,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: MemberFilters;
  onApply: (filters: MemberFilters) => void;
}) {
  const [draft, setDraft] = useState<MemberFilters>(filters);
  useEffect(() => {
    if (open) setDraft(filters);
  }, [open, filters]);
  const set = <K extends keyof MemberFilters>(key: K, value: MemberFilters[K] | "any") =>
    setDraft((prev) => ({ ...prev, [key]: value === "any" ? undefined : value }));

  const pick = (key: keyof MemberFilters, label: string, options: [string, string][]) => (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={String(draft[key] ?? "any")} onValueChange={(v) => set(key, (key === "level" && v !== "any" ? Number(v) : v) as never)}>
        <SelectTrigger className="h-10">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="any">Any</SelectItem>
          {options.map(([value, text]) => (
            <SelectItem key={value} value={value}>
              {text}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
        <SheetHeader className="text-left">
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>Narrow the list. Bulk actions apply to whoever you select.</SheetDescription>
        </SheetHeader>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {pick("status", "Status", [["pending", "Pending"], ["active", "Active"], ["denied", "Denied"], ["banned", "Banned"]])}
          {pick("suspended", "Suspended", [["yes", "Suspended"], ["no", "Not suspended"]])}
          {pick("role", "Role", [["admin", "Admins"], ["member", "Members"]])}
          {pick("level", "Level", [["1", "Level 1"], ["2", "Level 2"], ["3", "Level 3"]])}
          {pick("active", "Activity", [["7d", "Active in 7 days"], ["30d", "Active in 30 days"], ["inactive_30d", "Quiet 30+ days"], ["never", "Never active"]])}
          {pick("removed", "Removed accounts", [["hide", "Hide"], ["only", "Only removed"], ["all", "Show too"]])}
          <div className="col-span-2 space-y-1.5">
            <Label className="text-xs text-muted-foreground">City</Label>
            <Input className="h-10" value={draft.city ?? ""} onChange={(e) => set("city", e.target.value)} placeholder="Any city" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Joined after</Label>
            <Input className="h-10" type="date" value={draft.joined_from?.startsWith("__") ? "" : draft.joined_from ?? ""} onChange={(e) => set("joined_from", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Joined before</Label>
            <Input className="h-10" type="date" value={draft.joined_to ?? ""} onChange={(e) => set("joined_to", e.target.value)} />
          </div>
        </div>
        <div className="mt-6 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => onApply({})}>
            Clear all
          </Button>
          <Button className="flex-1" onClick={() => onApply(draft)}>
            Show results
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MemberDetailSheet({
  member,
  onClose,
  actions,
}: {
  member: AdminMember | null;
  onClose: () => void;
  actions: MemberRowActions;
}) {
  const { data: detail, isLoading } = useAdminMemberDetail(member?.user_id ?? null);
  const run = (fn: (m: AdminMember) => void) => () => {
    if (!member) return;
    onClose();
    fn(member);
  };
  const links = Object.entries(detail?.social_links ?? {}).filter(([, v]) => !!v);
  return (
    <Sheet open={!!member} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        {member && (
          <>
            <SheetHeader className="text-left">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  {member.avatar_url && <AvatarImage src={member.avatar_url} alt="" />}
                  <AvatarFallback>{initial(memberLabel(member))}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <SheetTitle className="truncate">{memberLabel(member)}</SheetTitle>
                  <SheetDescription className="truncate">{member.email}</SheetDescription>
                </div>
              </div>
            </SheetHeader>
            <div className="mt-4 flex flex-wrap gap-1.5">
              <StandingBadge member={member} />
              {member.is_admin && <Badge className="bg-amber-500/15 text-amber-500">Admin</Badge>}
              {member.mindset_level && <Badge variant="outline">Level {member.mindset_level}</Badge>}
              <Badge variant="outline">
                <Coins className="mr-1 h-3 w-3" />
                {member.credit_balance}
              </Badge>
            </div>
            <dl className="mt-4 grid grid-cols-[auto,1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">City</dt>
              <dd>{member.city || "—"}</dd>
              <dt className="text-muted-foreground">Phone</dt>
              <dd>{member.phone || "—"}</dd>
              <dt className="text-muted-foreground">Joined</dt>
              <dd>{ago(member.created_at)}</dd>
              <dt className="text-muted-foreground">Last active</dt>
              <dd>{ago(member.last_active_at)}</dd>
              {member.suspension_reason && (
                <>
                  <dt className="text-muted-foreground">Reason</dt>
                  <dd>{member.suspension_reason}</dd>
                </>
              )}
            </dl>
            {isLoading ? (
              <Skeleton className="mt-4 h-16" />
            ) : (
              detail && (
                <div className="mt-4 space-y-3 text-sm">
                  {detail.bio && <p className="text-muted-foreground">{detail.bio}</p>}
                  {[["Roles", detail.creative_roles], ["Skills", detail.skills], ["Passions", detail.passions]].map(
                    ([label, list]) =>
                      (list as string[]).length > 0 && (
                        <div key={label as string}>
                          <p className="mb-1 text-xs text-muted-foreground">{label as string}</p>
                          <div className="flex flex-wrap gap-1">
                            {(list as string[]).map((item) => (
                              <Badge key={item} variant="secondary" className="text-xs">
                                {item}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ),
                  )}
                  {links.length > 0 && (
                    <div>
                      <p className="mb-1 text-xs text-muted-foreground">Links</p>
                      {links.map(([key, value]) => (
                        <p key={key} className="truncate">
                          <span className="capitalize text-muted-foreground">{key}:</span> {value}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )
            )}
            <div className="mt-6 grid grid-cols-2 gap-2">
              {member.deleted_at ? (
                <Button className="col-span-2" onClick={run(actions.restore)}>
                  <RotateCcw className="mr-2 h-4 w-4" /> Restore account
                </Button>
              ) : (
                <>
                  <Button variant="outline" onClick={run(actions.message)}>Message</Button>
                  <Button variant="outline" onClick={run(actions.credits)}>Credits</Button>
                  <Button variant="outline" onClick={run(actions.status)}>Status</Button>
                  {member.is_suspended && member.access_status !== "banned" ? (
                    <Button variant="outline" onClick={run(actions.unsuspend)}>Unsuspend</Button>
                  ) : (
                    <Button variant="outline" onClick={run(actions.suspend)}>Suspend</Button>
                  )}
                  <Button variant="outline" onClick={run(actions.toggleAdmin)}>
                    {member.is_admin ? "Remove admin" : "Make admin"}
                  </Button>
                  <Button variant="destructive" onClick={run(actions.remove)}>Remove</Button>
                </>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

interface BulkValues {
  reason?: string;
  level?: number;
  title?: string;
  body?: string;
  amount?: number;
}

function BulkDialog({
  choice,
  count,
  onClose,
  onConfirm,
}: {
  choice: BulkChoice | null;
  count: number;
  onClose: () => void;
  onConfirm: (choice: BulkChoice, values: BulkValues) => void | Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [level, setLevel] = useState("2");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [amount, setAmount] = useState("");
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (choice) {
      setReason("");
      setTitle("");
      setBody("");
      setAmount("");
      setTyped("");
    }
  }, [choice]);

  if (!choice) return null;
  const people = `${count.toLocaleString()} ${count === 1 ? "person" : "people"}`;
  const destructive = choice !== "credits" && DESTRUCTIVE.has(choice);
  const needsTyped = choice === "remove" && count > 10;
  const credits = readNumber(amount, { label: "Amount", min: 1, integer: true });

  const copy: Record<BulkChoice, string> = {
    message: `Sends an in-app notification to ${people}. People who turned off admin messages are skipped.`,
    suspend: `${people} lose access until you unsuspend them. You can undo this right after.`,
    unsuspend: `${people} get their access back.`,
    set_level: `Sets the level for ${people}. You can undo this right after.`,
    ban: `${people} are banned and signed out. You can undo this right after.`,
    unban: `${people} are unbanned and get access back.`,
    remove: `${people} are removed from the app and hidden everywhere members look. Their data is kept, so you can restore them.`,
    restore: `${people} are restored and become active again.`,
    credits: `Awards the same number of credits to each of ${people}. This can't be undone from here.`,
  };

  const ready =
    (choice !== "message" || title.trim().length > 0) &&
    (choice !== "credits" || (!credits.error && credits.value !== null && reason.trim().length > 0)) &&
    (!needsTyped || typed.trim().toUpperCase() === "REMOVE");

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {BULK_LABEL[choice]} {people}?
          </DialogTitle>
          <DialogDescription>{copy[choice]}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {choice === "message" && (
            <>
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What's this about?" />
              </div>
              <div className="space-y-1.5">
                <Label>Message</Label>
                <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} />
              </div>
            </>
          )}
          {choice === "set_level" && (
            <div className="space-y-1.5">
              <Label>New level</Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Level 1</SelectItem>
                  <SelectItem value="2">Level 2</SelectItem>
                  <SelectItem value="3">Level 3</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {choice === "credits" && (
            <div className="space-y-1.5">
              <Label>Credits each</Label>
              <Input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))} placeholder="e.g. 50" />
            </div>
          )}
          {choice !== "message" && (
            <div className="space-y-1.5">
              <Label>Reason {choice === "credits" ? "" : "(optional)"}</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Saved in the admin history" />
            </div>
          )}
          {needsTyped && (
            <div className="space-y-1.5">
              <Label>Type REMOVE to confirm</Label>
              <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoCapitalize="characters" />
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={!ready}
            onClick={() =>
              onConfirm(choice, {
                reason: reason.trim() || undefined,
                level: Number(level),
                title: title.trim(),
                body: body.trim(),
                amount: credits.value ?? undefined,
              })
            }
          >
            {BULK_LABEL[choice]} {people}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
