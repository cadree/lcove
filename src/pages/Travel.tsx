import { ReportDialog } from "@/components/safety/ReportDialog";
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plane, Plus, MessageCircle } from "lucide-react";
import PageLayout from "@/components/layout/PageLayout";
import { CityInput } from "@/components/city/CityInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { discovery, type Trip, type TripItem } from "@/lib/creativeDiscovery";
import { money, parseCents, safeWebLink } from "@/lib/tripMoney";
import { resolveCity } from "@/lib/cities";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { readNumber } from "@/lib/numberField";
import { canComplete, todayIso, tripDatesError, tripRange, tripStatus } from "@/lib/tripDates";

export default function Travel() {
  const { user } = useAuth();
  const cache = useQueryClient();
  const [params, setParams] = useSearchParams();
  const selected = params.get("trip");
  const [reportOrganizer, setReportOrganizer] = useState<string | null>(null);
  const [city, setCity] = useState(params.get("city") || "");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [create, setCreate] = useState(false);
  const trips = useQuery({
    queryKey: ["trips", user?.id, city, start, end],
    queryFn: () =>
      discovery.trips(
        city.trim() ? resolveCity(city).city_key : null,
        start || null,
        end || null
      ),
    enabled: !!user,
  });
  const trip = useQuery({
    queryKey: ["trip", selected, user?.id],
    queryFn: () => discovery.trip(selected!),
    enabled: !!selected && !!user,
    refetchInterval: 15000,
  });
  const join = useMutation({
    mutationFn: (id: string) => discovery.tripAction("join", id),
    onSuccess: async (data) => {
      await cache.invalidateQueries({ queryKey: ["trips"] });
      await cache.invalidateQueries({ queryKey: ["conversations"] });
      setParams({ trip: data.id });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <PageLayout>
      <div className="mx-auto max-w-3xl space-y-5 px-4 py-5">
        <header className="flex items-center justify-between">
          <div>
            <Link
              className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground"
              to="/explore?section=people"
            >
              <ArrowLeft size={16} /> Discover
            </Link>
            <h1 className="ether-title text-3xl">Let’s travel</h1>
          </div>
          <Button onClick={() => setCreate(true)} disabled={!user}>
            <Plus size={18} /> Plan a trip
          </Button>
        </header>
        <p className="rounded-2xl border border-border bg-muted/40 p-4 text-sm">
          Meet creatives heading to the same city. Plan a shared budget and
          pledge your share. Ether does not collect money or book travel.
          Payments recorded here are self-reported.
        </p>
        {selected ? (
          <>
            <Button variant="outline" onClick={() => setParams({})}>
              All trips
            </Button>
            {trip.isPending ? (
              <p role="status">Loading trip…</p>
            ) : trip.isError ? (
              <p role="alert">
                Unable to load this trip. You may need to join first.{" "}
                <button className="underline" onClick={() => trip.refetch()}>
                  Retry
                </button>
              </p>
            ) : (
              trip.data && (
                <TripDetail trip={trip.data} onLeave={() => setParams({})} />
              )
            )}
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="col-span-2 sm:col-span-1">
                <Label htmlFor="travel-city">Destination</Label>
                <CityInput
                  id="travel-city"
                  value={city}
                  onChange={setCity}
                  placeholder="Any city"
                />
              </div>
              <div>
                <Label htmlFor="travel-start">From</Label>
                <Input
                  id="travel-start"
                  type="date"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="travel-end">Through</Label>
                <Input
                  id="travel-end"
                  type="date"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </div>
            </div>
            {!user ? (
              <Link to="/auth" className="underline">
                Sign in to join or plan a trip
              </Link>
            ) : trips.isPending ? (
              <p role="status">Finding trips…</p>
            ) : trips.isError ? (
              <p role="alert">
                Travel planning is unavailable.{" "}
                <button className="underline" onClick={() => trips.refetch()}>
                  Retry
                </button>
              </p>
            ) : !trips.data?.length ? (
              <p className="py-8 text-center text-muted-foreground">
                No matching trips yet. Start one with a destination and dates.
              </p>
            ) : (
              trips.data.map((t) => (
                <article key={t.id} className="file-panel space-y-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-widest text-muted-foreground">
                        {t.city_label}
                      </p>
                      <h2 className="ether-title text-xl">{t.title}</h2>
                    </div>
                    <Plane size={20} />
                  </div>
                  <p className="text-sm">
                    {tripRange(t.starts_on, t.ends_on)} · {t.member_count}/{t.capacity}{" "}
                    travelers · {tripStatus(t.status)}
                  </p>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {t.notes}
                  </p>
                  <p className="text-sm">
                    Travelers: {t.roster.map((m) => m.display_name).join(", ")}
                  </p>
                  {t.organizer_id !== user?.id && (
                    <button
                      className="min-h-11 text-sm underline"
                      onClick={() => setReportOrganizer(t.organizer_id)}
                    >
                      Report organizer
                    </button>
                  )}
                  {t.joined ? (
                    <Button onClick={() => setParams({ trip: t.id })}>
                      Open trip & budget
                    </Button>
                  ) : (
                    <Button
                      disabled={join.isPending || t.member_count >= t.capacity}
                      onClick={() => {
                        if (
                          window.confirm(
                            "Join this trip and its group chat? The listed travelers will see your profile and budget pledges. Joining does not unlock private DMs."
                          )
                        )
                          join.mutate(t.id);
                      }}
                    >
                      Join trip & group chat
                    </Button>
                  )}
                </article>
              ))
            )}
          </>
        )}
        {reportOrganizer && (
          <ReportDialog
            open
            onOpenChange={(open) => {
              if (!open) setReportOrganizer(null);
            }}
            targetType="profile"
            targetId={reportOrganizer}
          />
        )}
        <CreateTrip
          initialCity={city}
          open={create}
          onOpenChange={setCreate}
          onCreated={(id) => setParams({ trip: id })}
        />
      </div>
    </PageLayout>
  );
}

function CreateTrip({
  initialCity,
  open,
  onOpenChange,
  onCreated,
}: {
  initialCity: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const cache = useQueryClient();
  const [city, setCity] = useState(initialCity);
  const [start, setStart] = useState("");
  const requestId = useRef(crypto.randomUUID());
  useEffect(() => {
    if (open) setCity(initialCity);
  }, [open, initialCity]);
  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      discovery.tripAction("create", null, {
        ...data,
        request_id: requestId.current,
      }),
    onSuccess: async (t) => {
      await cache.invalidateQueries({ queryKey: ["trips"] });
      await cache.invalidateQueries({ queryKey: ["conversations"] });
      requestId.current = crypto.randomUUID();
      onOpenChange(false);
      onCreated(t.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Plan a creative trip</DialogTitle>
          <DialogDescription>
            A planning group, not a reservation. Include what you want to do,
            what’s shared and cancellation expectations.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            const resolved = resolveCity(city);
            if (resolved.confidence !== "exact") {
              toast.error("Choose a destination from the city suggestions.");
              return;
            }
            const datesError = tripDatesError(String(data.get("start") ?? ""), String(data.get("end") ?? ""));
            if (datesError) {
              toast.error(datesError);
              return;
            }
            const capacity = readNumber(String(data.get("capacity") ?? ""), { label: "Maximum travelers", min: 2, max: 20, integer: true });
            if (capacity.error) {
              toast.error(capacity.error);
              return;
            }
            mutation.mutate({
              title: data.get("title"),
              city_key: resolved.city_key,
              city_label: resolved.city_display,
              starts_on: data.get("start"),
              ends_on: data.get("end"),
              capacity: capacity.value,
              notes: data.get("notes"),
            });
          }}
        >
          <div>
            <Label htmlFor="trip-title">Trip name</Label>
            <Input
              id="trip-title"
              name="title"
              required
              minLength={3}
              maxLength={100}
              placeholder="A creative weekend in Atlanta"
            />
          </div>
          <div>
            <Label htmlFor="trip-city">City</Label>
            <CityInput id="trip-city" value={city} onChange={setCity} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="trip-start">Arrival</Label>
              <Input id="trip-start" name="start" type="date" min={todayIso()} value={start} onChange={(e) => setStart(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="trip-end">Departure</Label>
              <Input id="trip-end" name="end" type="date" min={start || todayIso()} required />
            </div>
          </div>
          <div>
            <Label htmlFor="trip-capacity">
              Maximum travelers, including you
            </Label>
            <Input
              id="trip-capacity"
              name="capacity"
              type="number"
              min={2}
              max={20}
              step={1}
              defaultValue={4}
              required
            />
          </div>
          <div>
            <Label htmlFor="trip-notes">Plan & cancellation expectations</Label>
            <Textarea
              id="trip-notes"
              name="notes"
              maxLength={2000}
              required
              placeholder="Dates, room sharing, transport, and what happens if someone cancels. Don’t post addresses or booking codes here."
            />
          </div>
          <Button
            type="submit"
            disabled={mutation.isPending}
            className="w-full"
          >
            {mutation.isPending ? "Creating…" : "Create trip & group chat"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TripDetail({ trip, onLeave }: { trip: Trip; onLeave: () => void }) {
  const { user } = useAuth();
  const cache = useQueryClient();
  const me = trip.members.find((m) => m.user_id === user?.id);
  const organizer = trip.organizer_id === user?.id;
  const frozen = trip.items.some((i) => i.receipt_url);
  const closed = ["cancelled", "completed"].includes(trip.status);
  const mutation = useMutation({
    mutationFn: ({
      action,
      data = {},
    }: {
      action: string;
      data?: Record<string, unknown>;
    }) => discovery.tripAction(action, trip.id, data),
    onSuccess: async (_, variables) => {
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["trip", trip.id] }),
        cache.invalidateQueries({ queryKey: ["trips"] }),
        cache.invalidateQueries({ queryKey: ["conversations"] }),
      ]);
      if (variables.action === "leave") onLeave();
      else toast.success("Trip updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const act = (action: string, data: Record<string, unknown> = {}) =>
    mutation.mutate({ action, data });
  const approved =
    trip.members.length >= 2 &&
    trip.total_cents > 0 &&
    trip.members.every((m) => m.approved_revision === trip.revision);
  const centsInput = (raw: FormDataEntryValue | null) => {
    const value = parseCents(String(raw));
    if (value === null)
      toast.error("Enter a valid amount with at most two decimal places.");
    return value;
  };
  return (
    <div className="space-y-5">
      <section className="file-panel space-y-3 p-5">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          {trip.city_label} · {tripStatus(trip.status)}
        </p>
        <h2 className="ether-title text-2xl">{trip.title}</h2>
        <p>
          {tripRange(trip.starts_on, trip.ends_on)}
        </p>
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">
          {trip.notes}
        </p>
        <Link
          className="inline-flex min-h-11 items-center gap-2 underline"
          to={`/messages?conversation=${trip.conversation_id}`}
        >
          <MessageCircle size={18} /> Open group chat
        </Link>
      </section>
      <section className="file-panel space-y-4 p-5">
        <div className="flex flex-wrap justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">
              Estimated group budget · USD · version {trip.revision}
            </p>
            <p className="text-3xl font-semibold">{money(trip.total_cents)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Your equal share</p>
            <p className="text-2xl">{money(me?.share_cents || 0)}</p>
          </div>
        </div>
        <p className="text-sm">
          Pledged:{" "}
          {money(trip.members.reduce((sum, m) => sum + m.pledge_cents, 0))} ·
          Reported paid outside Ether:{" "}
          {money(
            trip.members.reduce((sum, m) => sum + m.reported_paid_cents, 0)
          )}
        </p>
        <p className="rounded-xl bg-muted p-3 text-sm">
          {approved
            ? "Everyone approved this budget. Arrange bookings and payment outside Ether, then record receipts below."
            : "Everyone must pledge their share and approve this version before an agreed booking can be recorded."}{" "}
          These are promises and self-reported records, not verified funds.
        </p>
        <ul className="space-y-3">
          {trip.members.map((m) => (
            <li key={m.user_id} className="border-b border-border pb-2 text-sm">
              <div className="flex justify-between gap-2">
                <Link
                  to={`/profile/${m.user_id}`}
                  className="font-medium underline"
                >
                  {m.display_name}
                  {m.user_id === user?.id ? " (you)" : ""}
                </Link>
                <span>{money(m.share_cents)}</span>
              </div>
              <p className="mt-1 text-muted-foreground">
                Pledged {money(m.pledge_cents)} · Reported paid{" "}
                {money(m.reported_paid_cents)} ·{" "}
                {m.approved_revision === trip.revision
                  ? "Budget approved"
                  : "Awaiting approval"}
              </p>
            </li>
          ))}
        </ul>
        {!closed && me && (
          <div className="space-y-3">
            {!frozen && (
              <>
                <Button
                  className="w-full"
                  disabled={mutation.isPending || !trip.total_cents}
                  onClick={() => act("pledge", { cents: me.share_cents })}
                >
                  Pledge my {money(me.share_cents)} share
                </Button>
                <Button
                  variant="outline"
                  disabled={mutation.isPending || !me.pledge_cents}
                  onClick={() => act("pledge", { cents: 0 })}
                >
                  Withdraw my pledge
                </Button>
              </>
            )}
            <Button
              className="w-full"
              disabled={
                mutation.isPending ||
                me.pledge_cents < me.share_cents ||
                approved ||
                !trip.total_cents
              }
              onClick={() => act("approve_budget", { revision: trip.revision })}
            >
              Approve this budget & my share
            </Button>
            <form
              className="grid items-end gap-2 sm:flex"
              onSubmit={(e) => {
                e.preventDefault();
                const cents = centsInput(
                  new FormData(e.currentTarget).get("paid")
                );
                if (cents !== null) act("report_paid", { cents });
              }}
            >
              <div className="min-w-0 flex-1">
                <Label htmlFor="paid-amount">
                  My total paid outside Ether (USD)
                </Label>
                <Input
                  id="paid-amount"
                  name="paid"
                  inputMode="decimal"
                  placeholder="0.00"
                  required
                />
              </div>
              <Button variant="outline" disabled={mutation.isPending}>
                Record my payment
              </Button>
            </form>
            <p className="text-xs text-muted-foreground">
              Only you can change your payment report. Keep proof in the group.
              This does not transfer money or verify a payment.
            </p>
          </div>
        )}
      </section>
      <section className="space-y-3">
        <h3 className="ether-title text-xl">Quotes & receipts</h3>
        <p className="text-sm text-muted-foreground">
          Include taxes and fees in each estimate. Approve quotes before
          purchasing; confirm receipts after purchasing. Use private, redacted
          receipt links that your group can access.
        </p>
        {trip.items.map((item) => (
          <Expense
            key={item.id}
            item={item}
            trip={trip}
            pending={mutation.isPending}
            onAction={act}
            canRemove={organizer && !frozen && !closed}
            canRecord={approved && !closed}
            closed={closed}
          />
        ))}
        {organizer && !frozen && !closed && (
          <form
            className="file-panel space-y-3 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const data = new FormData(form);
              const cents = centsInput(data.get("amount"));
              if (cents !== null && cents > 0)
                mutation.mutate(
                  {
                    action: "add_item",
                    data: {
                      label: data.get("label"),
                      estimate_cents: cents,
                      quote_url: data.get("url"),
                    },
                  },
                  { onSuccess: () => form.reset() }
                );
            }}
          >
            <h4 className="font-medium">Add a budget item</h4>
            <Label htmlFor="expense-label">What are you sharing?</Label>
            <Input
              id="expense-label"
              name="label"
              maxLength={120}
              required
              placeholder="Lodging, including cleaning and taxes"
            />
            <Label htmlFor="expense-amount">Full estimated cost (USD)</Label>
            <Input
              id="expense-amount"
              name="amount"
              required
              inputMode="decimal"
              placeholder="1500.00"
            />
            <Label htmlFor="expense-quote">
              Quote or listing link (optional)
            </Label>
            <Input
              id="expense-quote"
              name="url"
              type="url"
              placeholder="https://…"
            />
            <Button disabled={mutation.isPending}>Add budget item</Button>
          </form>
        )}
        {frozen && (
          <p className="text-sm text-muted-foreground">
            A booking has been recorded. The roster, pledges and budget are
            locked to preserve everyone’s agreement. Discuss corrections or
            cancellation in the group.
          </p>
        )}
      </section>
      {!closed && (
        <div className="flex flex-wrap gap-3">
          {organizer ? (
            <>
              <Button
                variant="outline"
                disabled={mutation.isPending}
                onClick={() => {
                  if (
                    window.confirm(
                      "Cancel this trip? Records remain, but Ether cannot refund payments made elsewhere. Agree any reimbursements with the group."
                    )
                  )
                    act("cancel");
                }}
              >
                Cancel trip
              </Button>
              {trip.status === "booked" &&
                (canComplete(trip) ? (
                  <Button
                    disabled={mutation.isPending}
                    onClick={() => act("complete")}
                  >
                    Mark trip completed
                  </Button>
                ) : (
                  <p className="self-center text-sm text-muted-foreground">
                    You can mark it completed from {tripRange(trip.ends_on, trip.ends_on)}.
                  </p>
                ))}
            </>
          ) : (
            !frozen && (
              <Button
                variant="outline"
                disabled={mutation.isPending}
                onClick={() => {
                  if (
                    window.confirm(
                      "Leave this trip? Everyone’s pledges and approvals will reset to reflect the new shares."
                    )
                  )
                    act("leave");
                }}
              >
                Leave trip
              </Button>
            )
          )}
        </div>
      )}
      {closed && me && (
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            disabled={mutation.isPending}
            onClick={() => {
              if (
                window.confirm(
                  "Leave this trip’s group chat? The trip record stays for the other travelers."
                )
              )
                act("leave");
            }}
          >
            Leave trip chat
          </Button>
        </div>
      )}
      <details className="file-panel p-4">
        <summary className="min-h-11 cursor-pointer">Activity history</summary>
        <ul className="space-y-2 text-sm text-muted-foreground">
          {trip.audit.map((a) => (
            <li key={a.id}>
              {new Date(a.created_at).toLocaleString()} ·{" "}
              {trip.members.find((m) => m.user_id === a.actor_id)
                ?.display_name || "Former traveler"}{" "}
              · {a.action.replace(/_/g, " ")}
              {a.details?.cents !== undefined
                ? `: ${money(a.details.cents)}`
                : ""}
              {a.details?.actual_cents !== undefined
                ? `: ${money(a.details.actual_cents)}`
                : ""}{" "}
              · v{a.revision}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function Expense({
  item,
  trip,
  pending,
  onAction,
  canRemove,
  canRecord,
  closed,
}: {
  item: TripItem;
  trip: Trip;
  pending: boolean;
  onAction: (action: string, data?: Record<string, unknown>) => void;
  canRemove: boolean;
  canRecord: boolean;
  closed: boolean;
}) {
  const confirmations = item.votes.filter((v) => v.approved).length;
  const disputed = item.votes.some((v) => !v.approved);
  return (
    <article className="file-panel space-y-3 p-4">
      <div className="flex justify-between gap-3">
        <h4 className="font-medium">{item.label}</h4>
        <span>{money(item.estimate_cents)}</span>
      </div>
      {safeWebLink(item.quote_url) && (
        <a
          className="inline-flex min-h-11 items-center text-sm underline"
          href={safeWebLink(item.quote_url)}
          target="_blank"
          rel="noopener noreferrer"
        >
          Review quote / listing
        </a>
      )}
      {canRemove && (
        <Button
          variant="ghost"
          disabled={pending}
          onClick={() => onAction("remove_item", { item_id: item.id })}
        >
          Remove item
        </Button>
      )}
      {item.receipt_url ? (
        <>
          <p className="text-sm">
            Actual cost: {money(item.actual_cents || 0)} ·{" "}
            {disputed
              ? "Needs discussion"
              : confirmations === trip.members.length
              ? "Receipt confirmed by everyone"
              : `${confirmations}/${trip.members.length} confirmed`}
          </p>
          <p className="text-xs text-muted-foreground">
            Recorded by{" "}
            {trip.members.find((m) => m.user_id === item.purchased_by)
              ?.display_name || "Traveler"}
            . {money(item.estimate_cents - (item.actual_cents || 0))} below
            estimate; reconcile unused contributions outside Ether.
          </p>
          <a
            className="inline-flex min-h-11 items-center underline"
            href={safeWebLink(item.receipt_url)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Review receipt
          </a>
          {!closed && (
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={pending}
                onClick={() =>
                  onAction("confirm_receipt", {
                    item_id: item.id,
                    approved: true,
                  })
                }
              >
                Confirm receipt
              </Button>
              <Button
                variant="outline"
                disabled={pending}
                onClick={() =>
                  onAction("confirm_receipt", {
                    item_id: item.id,
                    approved: false,
                  })
                }
              >
                Needs discussion
              </Button>
            </div>
          )}
        </>
      ) : (
        canRecord && (
          <form
            className="space-y-3 border-t border-border pt-3"
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              const cents = parseCents(String(data.get("actual")));
              if (cents === null || cents <= 0) {
                toast.error("Enter a valid actual cost.");
                return;
              }
              onAction("record_receipt", {
                item_id: item.id,
                revision: trip.revision,
                actual_cents: cents,
                receipt_url: data.get("receipt"),
              });
            }}
          >
            <Label htmlFor={`actual-${item.id}`}>
              Amount you paid to the supplier (USD)
            </Label>
            <Input
              id={`actual-${item.id}`}
              name="actual"
              inputMode="decimal"
              required
            />
            <Label htmlFor={`receipt-${item.id}`}>Private receipt link</Label>
            <Input
              id={`receipt-${item.id}`}
              name="receipt"
              type="url"
              required
              placeholder="https://…"
            />
            <Button disabled={pending}>Record my booking receipt</Button>
          </form>
        )
      )}
    </article>
  );
}
