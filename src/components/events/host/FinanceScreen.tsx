import { Button } from "@/components/ui/button";

export interface PayoutRow {
  id: string;
  label: string;
  status: string;
}

export interface PayoutMethod {
  id: string;
  label: string;
  isDefault: boolean;
}

export function FinanceScreen({
  available,
  pending,
  country,
  currency,
  sales,
  transfers,
  payouts,
  methods,
  onTransfer,
  onAddMethod,
  busy,
}: {
  available: string;
  pending: string;
  country: string;
  currency: string;
  sales: boolean;
  transfers: boolean;
  payouts: PayoutRow[];
  methods: PayoutMethod[];
  onTransfer: () => void;
  onAddMethod: () => void;
  busy: boolean;
}) {
  return (
    <div className="min-h-screen bg-background px-4 py-6">
      <h1 className="ether-title text-3xl">Finances</h1>
      <p className="mt-2 text-xs text-muted-foreground">Stripe test mode. Ether does not keep a platform fee on tickets.</p>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <Stat label="Available" value={available} />
        <Stat label="Pending" value={pending} />
      </div>
      <div className="mt-4 space-y-2 rounded-2xl border border-border/70 p-4 text-sm">
        <Row label="Country" value={country} />
        <Row label="Currency" value={currency} />
        <Row label="Sales" value={sales ? "Enabled" : "Not enabled"} />
        <Row label="Transfers" value={transfers ? "Enabled" : "Not enabled"} />
      </div>
      <Button className="mt-4 w-full rounded-full" disabled={busy} onClick={onTransfer}>Transfer balance</Button>
      <h2 className="mt-8 text-sm font-medium">Payouts</h2>
      {payouts.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No payouts yet.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {payouts.map((payout) => (
            <li key={payout.id} className="flex items-center justify-between rounded-xl border border-border/60 px-3 py-2 text-sm">
              <span>{payout.label}</span>
              <span className="text-muted-foreground">{payout.status}</span>
            </li>
          ))}
        </ul>
      )}
      <h2 className="mt-8 text-sm font-medium">Payout methods</h2>
      <ul className="mt-2 space-y-2">
        {methods.map((method) => (
          <li key={method.id} className="flex items-center justify-between rounded-xl border border-border/60 px-3 py-2 text-sm">
            <span>{method.label}</span>
            {method.isDefault && <span className="text-xs text-muted-foreground">Default</span>}
          </li>
        ))}
      </ul>
      <Button variant="outline" className="mt-3 w-full rounded-full" disabled={busy} onClick={onAddMethod}>Add payout method</Button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
