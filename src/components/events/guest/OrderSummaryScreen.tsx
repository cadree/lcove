import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PoweredByEther } from "./PoweredByEther";

export interface SummaryLine {
  id: string;
  name: string;
  quantity: number;
  priceLabel: string;
}

export function OrderSummaryScreen({
  hostName,
  hostAvatar,
  theme = "dark",
  lines,
  totalLabel,
  free,
  name,
  email,
  passwordRequired,
  password,
  consent,
  consentLabel,
  phone,
  onPhone,
  errors,
  submitting,
  onName,
  onEmail,
  onPassword,
  onConsent,
  onBack,
  onCheckout,
}: {
  hostName: string;
  hostAvatar?: string | null;
  theme?: "light" | "dark";
  lines: SummaryLine[];
  totalLabel: string;
  free: boolean;
  name: string;
  email: string;
  passwordRequired: boolean;
  password: string;
  consent: boolean;
  consentLabel?: string;
  phone?: string;
  onPhone?: (value: string) => void;
  errors: Record<string, string>;
  submitting: boolean;
  onName: (value: string) => void;
  onEmail: (value: string) => void;
  onPassword: (value: string) => void;
  onConsent: (value: boolean) => void;
  onBack: () => void;
  onCheckout: () => void;
}) {
  return (
    <div className={`${theme === "light" ? "light " : ""}min-h-screen bg-background px-4 pb-28 pt-4 text-foreground`}>
      <button type="button" onClick={onBack} className="text-sm text-muted-foreground">Back</button>
      <div className="mt-4 flex items-center gap-3">
        {hostAvatar && <img src={hostAvatar} alt="" className="h-10 w-10 rounded-full object-cover" />}
        <p className="text-base font-medium">{hostName}</p>
      </div>
      <h1 className="ether-title mt-1 text-3xl">Order summary</h1>
      <div className="mt-6 space-y-3 rounded-2xl border border-border/70 bg-card p-4">
        {lines.map((line) => (
          <div key={line.id} className="flex items-center justify-between gap-3 text-sm">
            <span>{line.quantity} × {line.name}</span>
            <span>{line.priceLabel}</span>
          </div>
        ))}
        <div className="flex items-center justify-between border-t border-border/60 pt-3 font-medium">
          <span>Total due</span>
          <span>{totalLabel}</span>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        <Field label="Name" error={errors.name}>
          <Input value={name} onChange={(event) => onName(event.target.value)} autoComplete="name" />
        </Field>
        <Field label="Email" error={errors.email}>
          <Input type="email" value={email} onChange={(event) => onEmail(event.target.value)} autoComplete="email" />
        </Field>
        {passwordRequired && (
          <Field label="Event password" error={errors.password}>
            <Input type="password" value={password} onChange={(event) => onPassword(event.target.value)} />
          </Field>
        )}
        {onPhone && (
          <Field label="Phone (optional)" error={errors.phone}>
            <Input type="tel" value={phone || ""} autoComplete="tel" onChange={(event) => onPhone(event.target.value)} />
          </Field>
        )}
        <label className="flex items-start gap-3 text-sm">
          <Checkbox checked={consent} onCheckedChange={(value) => onConsent(value === true)} />
          <span>{consentLabel || `Text me updates from ${hostName}. Optional, and off unless you check this.`}</span>
        </label>
        <p className="text-xs text-muted-foreground">
          By continuing you agree to the <a className="underline" href="/terms">Terms</a> and <a className="underline" href="/privacy">Privacy</a>.
          {free ? " This RSVP is free. No card." : " Card checkout uses Stripe test mode."}
        </p>
      </div>
      <PoweredByEther />
      <div className="fixed inset-x-0 bottom-0 border-t border-border/50 bg-background/95 px-4 py-3 pb-[max(env(safe-area-inset-bottom),12px)]">
        <Button className="h-12 w-full rounded-full" disabled={submitting} onClick={onCheckout}>
          {submitting ? "Working…" : free ? "RSVP" : "Checkout"}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
