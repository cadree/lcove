import { useSearchParams } from "react-router-dom";
import { ConfirmationScreen } from "@/components/events/guest/ConfirmationScreen";
import { OrderSummaryScreen } from "@/components/events/guest/OrderSummaryScreen";
import { PublicEventScreen, type PublicEventModel } from "@/components/events/guest/PublicEventScreen";
import { TicketPickerScreen } from "@/components/events/guest/TicketPickerScreen";
import { CreateEventChoice } from "@/components/events/host/CreateEventChoice";
import { EventFormScreen, type EventFormValues } from "@/components/events/host/EventFormScreen";
import { FinanceScreen } from "@/components/events/host/FinanceScreen";
import { HostDashboardScreen } from "@/components/events/host/HostDashboardScreen";
import { HostShareBar } from "@/components/events/HostShareBar";

const flyer = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="560"><rect width="100%" height="100%" fill="#24141c"/><text x="50%" y="48%" fill="#ffc2dc" font-size="42" text-anchor="middle" font-family="Georgia">ADA</text></svg>')}`;
const avatar = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><circle cx="40" cy="40" r="40" fill="#ffb3d1"/><text x="40" y="48" text-anchor="middle" font-size="28" font-family="Georgia" fill="#1a1020">A</text></svg>')}`;

const event: PublicEventModel = {
  title: "Listening night",
  summary: "A small room, one record at a time.",
  flyerUrl: flyer,
  fontId: "cinzel",
  theme: "dark",
  brandColor: "#ffb3d1",
  whenLabel: "Sat, Nov 1 · 7:00 PM – 10:00 PM",
  venue: "The loft",
  area: "Brooklyn, NY",
  ticketBadge: "Tickets from $20.91",
  addressHidden: true,
  location: null,
  hostName: "Ada Lane",
  hostAvatar: avatar,
  hostEvents: 4,
  hostAttendees: 86,
  guestNames: ["Nico"],
  guestAvatars: [avatar],
  going: 12,
  cta: "Buy tickets from $20.91",
  saved: false,
  past: false,
};

const form: EventFormValues = {
  title: "Listening night",
  start: "2026-11-01T19:00",
  end: "2026-11-01T22:00",
  venue: "The loft",
  summary: "A small room, one record at a time.",
  address: "18 Mercer",
  price: "20",
  capacity: "40",
  mode: "tickets",
  hideAddress: true,
  showOnExplore: true,
  passwordProtected: false,
  password: "",
  requireApproval: false,
  allowTransfers: true,
  absorbFees: false,
  repeats: "none",
  fontId: "cinzel",
  theme: "dark",
  videoUrl: "",
  features: "21+, live set",
  city: "New York",
  timezone: "America/New_York",
};

const noop = () => undefined;

export default function HostingShots() {
  const [params] = useSearchParams();
  const screen = params.get("screen") || "public";

  if (screen === "tickets") {
    return (
      <TicketPickerScreen
        title="Listening night"
        hostName="Ada Lane"
        hostAvatar={avatar}
        tiers={[
          { id: "ga", name: "General Admission", priceLabel: "$20.91 incl. $0.91 fees", description: "Only 1 ticket per device", soldOut: false, quantity: 1, max: 4 },
          { id: "late", name: "Late entry", priceLabel: "$12.00", description: null, soldOut: true, quantity: 0, max: 0 },
        ]}
        onChange={noop}
        onContinue={noop}
        onBack={noop}
      />
    );
  }

  if (screen === "checkout") {
    return (
      <OrderSummaryScreen
        hostName="Ada Lane"
        hostAvatar={avatar}
        lines={[{ id: "ga", name: "General Admission", quantity: 1, priceLabel: "$20.91" }]}
        totalLabel="$20.91"
        free={false}
        name=""
        email=""
        passwordRequired={false}
        password=""
        consent={false}
        errors={{}}
        submitting={false}
        onName={noop}
        onEmail={noop}
        onPassword={noop}
        onConsent={noop}
        onBack={noop}
        onCheckout={noop}
      />
    );
  }

  if (screen === "confirmation") {
    return (
      <ConfirmationScreen
        hostName="Ada Lane"
        hostAvatar={avatar}
        flyerUrl={flyer}
        title="Listening night"
        whenLabel="Sat, Nov 1 · 7:00 PM – 10:00 PM"
        address="The loft, New York"
        ticketCount={1}
        qrValue="ether-order-demo"
        subscribed
        walletEnabled
        onUpdates={noop}
        onWallet={noop}
        onCalendar={noop}
        onShare={noop}
      />
    );
  }

  if (screen === "dashboard") {
    return (
      <HostDashboardScreen
        name="Ada Lane"
        accounts={[{ id: "personal", label: "Ada Lane" }, { id: "org", label: "Loft nights" }]}
        accountId="personal"
        onAccount={noop}
        instagram="https://instagram.com/ada"
        stats={[
          { label: "Revenue", value: "$420.00" },
          { label: "Attendees", value: "86" },
          { label: "Events", value: "4" },
          { label: "Followers", value: "120" },
        ]}
        eventCount={4}
        onEvents={noop}
        onFinances={noop}
        onProfile={noop}
        onDoor={noop}
        onCreate={noop}
      />
    );
  }

  if (screen === "create") return <CreateEventChoice onChoose={noop} />;

  if (screen === "form" || screen === "form-errors") {
    return (
      <EventFormScreen
        values={screen === "form-errors" ? { ...form, title: "", end: "2026-11-01T18:00", venue: "" } : form}
        errors={screen === "form-errors" ? { title: "Add a title.", end: "End must be after the start.", venue: "Add a venue name." } : {}}
        guestNames={["Nico"]}
        going={12}
        saving={false}
        flyerUrl={flyer}
        onChange={noop}
        onFlyer={noop}
        onBack={noop}
        onSave={noop}
      />
    );
  }

  if (screen === "finances") {
    return (
      <FinanceScreen
        available="$0.00"
        pending="$0.00"
        country="US"
        currency="USD"
        sales
        transfers
        payouts={[]}
        methods={[{ id: "ba", label: "Bank ending in 4242", isDefault: true }]}
        onTransfer={noop}
        onAddMethod={noop}
        busy={false}
      />
    );
  }

  const hostShare = screen === "host" ? (
    <div className="rounded-2xl border border-border/60 bg-card/80 p-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Share your event</p>
      <HostShareBar title={event.title} url="https://etherbylcove.com/e/listening-night" />
    </div>
  ) : undefined;

  return (
    <PublicEventScreen
      model={event}
      hostShare={hostShare}
      following={false}
      onBack={noop}
      onSave={noop}
      onShare={noop}
      onLocation={noop}
      onGuestlist={noop}
      onFollow={noop}
      onCalendar={noop}
      onContact={noop}
      onReport={noop}
      onCta={noop}
    />
  );
}
