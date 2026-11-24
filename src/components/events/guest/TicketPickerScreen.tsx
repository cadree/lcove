import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PoweredByEther } from "./PoweredByEther";

export interface PickerTier {
  id: string;
  name: string;
  priceLabel: string;
  description: string | null;
  soldOut: boolean;
  quantity: number;
  max: number;
}

export function TicketPickerScreen({
  title,
  hostName,
  hostAvatar,
  theme = "dark",
  tiers,
  onChange,
  onContinue,
  onBack,
}: {
  title: string;
  hostName: string;
  hostAvatar?: string | null;
  theme?: "light" | "dark";
  tiers: PickerTier[];
  onChange: (id: string, quantity: number) => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  const selected = tiers.reduce((sum, tier) => sum + tier.quantity, 0);
  return (
    <div className={`${theme === "light" ? "light " : ""}min-h-screen bg-background px-4 pb-28 pt-4 text-foreground`}>
      <button type="button" onClick={onBack} className="text-sm text-muted-foreground">Back</button>
      <div className="mt-4 flex items-center gap-3">
        {hostAvatar && <img src={hostAvatar} alt="" className="h-10 w-10 rounded-full object-cover" />}
        <p className="text-base font-medium">{hostName}</p>
      </div>
      <h1 className="ether-title mt-1 text-3xl">{title}</h1>
      <div className="mt-6 space-y-3">
        {tiers.map((tier) => (
          <div key={tier.id} className="rounded-2xl border border-border/70 bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{tier.name}</p>
                <p className="text-sm">{tier.priceLabel}</p>
                {tier.description && <p className="mt-1 text-xs text-muted-foreground">{tier.description}</p>}
              </div>
              {tier.soldOut ? (
                <span className="text-sm text-muted-foreground">Sold out</span>
              ) : (
                <div className="flex items-center gap-2">
                  <button type="button" aria-label={`Fewer ${tier.name}`} className="flex h-8 w-8 items-center justify-center rounded-full border" disabled={tier.quantity <= 0} onClick={() => onChange(tier.id, tier.quantity - 1)}>
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-5 text-center text-sm">{tier.quantity}</span>
                  <button type="button" aria-label={`More ${tier.name}`} className="flex h-8 w-8 items-center justify-center rounded-full border" disabled={tier.quantity >= tier.max} onClick={() => onChange(tier.id, tier.quantity + 1)}>
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {tiers.length === 0 && <p className="text-sm text-muted-foreground">No tickets are on sale.</p>}
      </div>
      <PoweredByEther />
      <div className="fixed inset-x-0 bottom-0 border-t border-border/50 bg-background/95 px-4 py-3 pb-[max(env(safe-area-inset-bottom),12px)]">
        <Button className="h-12 w-full rounded-full" disabled={selected < 1} onClick={onContinue}>Select tickets</Button>
      </div>
    </div>
  );
}
