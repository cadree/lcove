import { ChevronRight, Plus } from "lucide-react";
import { PoweredByEther } from "@/components/events/guest/PoweredByEther";

export interface HostStat {
  label: string;
  value: string;
}

export function HostDashboardScreen({
  name,
  accounts,
  accountId,
  onAccount,
  instagram,
  stats,
  eventCount,
  onEvents,
  onFinances,
  onProfile,
  onDoor,
  onCreate,
}: {
  name: string;
  accounts: { id: string; label: string }[];
  accountId: string;
  onAccount: (id: string) => void;
  instagram: string | null;
  stats: HostStat[];
  eventCount: number;
  onEvents: () => void;
  onFinances: () => void;
  onProfile: () => void;
  onDoor: () => void;
  onCreate: () => void;
}) {
  return (
    <div className="min-h-screen bg-background px-4 pb-28 pt-6">
      <label className="text-xs text-muted-foreground" htmlFor="host-account">Hosting as</label>
      <select
        id="host-account"
        className="mt-1 w-full bg-transparent text-2xl font-medium outline-none"
        value={accountId}
        onChange={(event) => onAccount(event.target.value)}
      >
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>{account.label}</option>
        ))}
      </select>
      <p className="mt-1 text-sm text-muted-foreground">{name}</p>
      {instagram && (
        <a className="mt-2 inline-block text-sm text-primary" href={instagram} target="_blank" rel="noreferrer">Instagram</a>
      )}
      <div className="mt-6 grid grid-cols-2 gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-border/70 bg-card p-3">
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className="mt-1 text-xl">{stat.value}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 overflow-hidden rounded-2xl border border-border/70">
        <DashRow label="View Events" detail={`${eventCount} past and upcoming`} onClick={onEvents} />
        <DashRow label="Manage Finances" onClick={onFinances} />
        <DashRow label="Edit Profile" onClick={onProfile} />
        <DashRow label="Manage In-Person Payments" onClick={onDoor} />
      </div>
      <PoweredByEther />
      <button
        type="button"
        onClick={onCreate}
        className="fixed bottom-6 right-5 z-20 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-lg"
      >
        <Plus className="h-4 w-4" /> Create Event
      </button>
    </div>
  );
}

function DashRow({ label, detail, onClick }: { label: string; detail?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center justify-between gap-3 border-b border-border/50 px-4 py-4 text-left last:border-b-0">
      <span>
        <span className="block text-sm">{label}</span>
        {detail && <span className="text-xs text-muted-foreground">{detail}</span>}
      </span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}
