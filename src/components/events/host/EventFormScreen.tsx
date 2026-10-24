import { useState, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { FLYER_FONTS, guestlistLine, type EventDraftInput } from "@/lib/guestEvent";
import { tierPriceLabel } from "@/lib/ticketFees";

export interface EventFormValues extends EventDraftInput {
  hideAddress: boolean;
  showOnExplore: boolean;
  passwordProtected: boolean;
  password: string;
  requireApproval: boolean;
  allowTransfers: boolean;
  absorbFees: boolean;
  repeats: string;
  fontId: string;
  theme: "light" | "dark";
  videoUrl: string;
  features: string;
  city: string;
  timezone: string;
}

export function EventFormScreen({
  values,
  errors,
  guestNames,
  going,
  saving,
  flyerUrl,
  onChange,
  onFlyer,
  onBack,
  onSave,
}: {
  values: EventFormValues;
  errors: Record<string, string>;
  guestNames: string[];
  going: number;
  saving: boolean;
  flyerUrl?: string | null;
  onChange: (patch: Partial<EventFormValues>) => void;
  onFlyer: (file: File) => void;
  onBack: () => void;
  onSave: () => void;
}) {
  const [tab, setTab] = useState<"flyer" | "video" | "font" | "theme">("flyer");
  const [advanced, setAdvanced] = useState(false);
  const cents = Math.round(Number(values.price || 0) * 100);
  return (
    <div className="min-h-screen bg-background px-4 pb-28 pt-4">
      <div className="rounded-3xl border border-border/70 bg-card p-4">
        <div className="grid grid-cols-4 gap-1 rounded-full bg-muted p-1 text-xs">
          {(["flyer", "video", "font", "theme"] as const).map((item) => (
            <button key={item} type="button" className={`rounded-full py-2 capitalize ${tab === item ? "bg-background" : ""}`} onClick={() => setTab(item)}>{item}</button>
          ))}
        </div>
        <div className="mt-4">
          {tab === "flyer" && (
            <label className="flex h-40 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border text-sm text-muted-foreground">
              {flyerUrl ? <img src={flyerUrl} alt="" className="h-full w-full object-cover" /> : "Add flyer"}
              <input className="hidden" type="file" accept="image/*" onChange={(event) => event.target.files?.[0] && onFlyer(event.target.files[0])} />
            </label>
          )}
          {tab === "video" && (
            <Field label="Video link" error="">
              <Input value={values.videoUrl} placeholder="Add video" onChange={(event) => onChange({ videoUrl: event.target.value })} />
            </Field>
          )}
          {tab === "font" && (
            <div className="grid grid-cols-2 gap-2">
              {FLYER_FONTS.map((font) => (
                <button key={font.id} type="button" className={`rounded-xl border px-3 py-3 text-left ${values.fontId === font.id ? "border-primary" : "border-border"}`} style={{ fontFamily: font.family }} onClick={() => onChange({ fontId: font.id })}>
                  {font.label}
                </button>
              ))}
            </div>
          )}
          {tab === "theme" && (
            <div className="grid grid-cols-2 gap-2">
              {(["light", "dark"] as const).map((theme) => (
                <button key={theme} type="button" className={`rounded-xl border px-3 py-4 capitalize ${values.theme === theme ? "border-primary" : "border-border"} ${theme === "light" ? "bg-white text-black" : "bg-black text-white"}`} onClick={() => onChange({ theme })}>
                  {theme}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-5 space-y-3">
          <Field label="Title" error={errors.title}>
            <Input value={values.title} onChange={(event) => onChange({ title: event.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Start" error={errors.start}>
              <Input type="datetime-local" value={values.start} onChange={(event) => onChange({ start: event.target.value })} />
            </Field>
            <Field label="End" error={errors.end}>
              <Input type="datetime-local" value={values.end} onChange={(event) => onChange({ end: event.target.value })} />
            </Field>
          </div>
          <Field label="Repeats" error="">
            <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={values.repeats} onChange={(event) => onChange({ repeats: event.target.value })}>
              <option value="none">Does not repeat</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </Field>
          <Field label="Venue name" error={errors.venue}>
            <Input value={values.venue} onChange={(event) => onChange({ venue: event.target.value })} />
          </Field>
          <Field label="Address" error="">
            <div className="flex gap-2">
              <Input value={values.address} onChange={(event) => onChange({ address: event.target.value })} />
              <button type="button" aria-label={values.hideAddress ? "Address hidden until RSVP" : "Address visible"} className="flex h-10 w-10 items-center justify-center rounded-md border" onClick={() => onChange({ hideAddress: !values.hideAddress })}>
                {values.hideAddress ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {values.hideAddress && <p className="text-xs text-muted-foreground">Hidden until someone RSVPs.</p>}
          </Field>
          <Field label="Event summary" error="">
            <Textarea value={values.summary} onChange={(event) => onChange({ summary: event.target.value })} />
          </Field>
          <Toggle label="Show on Explore" checked={values.showOnExplore} onChange={(showOnExplore) => onChange({ showOnExplore })} />
          <Toggle label="Password protected" checked={values.passwordProtected} onChange={(passwordProtected) => onChange({ passwordProtected })} />
          {values.passwordProtected && (
            <Field label="Password" error={errors.password}>
              <Input type="password" value={values.password} onChange={(event) => onChange({ password: event.target.value })} />
            </Field>
          )}
          <p className="pt-2 text-xs uppercase tracking-wide text-muted-foreground">RSVP settings</p>
          <Toggle label="Require approval" checked={values.requireApproval} onChange={(requireApproval) => onChange({ requireApproval })} />
          <Toggle label="Allow ticket transfers" checked={values.allowTransfers} onChange={(allowTransfers) => onChange({ allowTransfers })} />
          <Field label="Limit capacity" error={errors.capacity}>
            <Input inputMode="numeric" placeholder="No limit" value={values.capacity} onChange={(event) => onChange({ capacity: event.target.value })} />
          </Field>
          {values.mode === "tickets" && (
            <Field label="Ticket price" error={errors.price}>
              <Input inputMode="decimal" value={values.price} onChange={(event) => onChange({ price: event.target.value })} />
              <p className="text-xs text-muted-foreground">
                Buyers see {Number.isFinite(cents) && cents >= 0 ? tierPriceLabel(cents, values.absorbFees) : "—"}. Ether takes a 0% platform fee.
              </p>
            </Field>
          )}
          <Toggle
            label="Absorb card fees"
            checked={values.absorbFees}
            onChange={(absorbFees) => onChange({ absorbFees })}
          />
          <p className="text-xs text-muted-foreground">
            {values.absorbFees
              ? "You absorb card processing. Buyers pay the ticket price. Ether still takes 0%."
              : "Card processing is shown to the buyer as incl. fees. You keep the ticket price."}
          </p>
          <div className="rounded-2xl border border-border/60 p-3 text-sm">
            <p>{guestlistLine(guestNames, going)}</p>
            <p className="text-xs text-primary">View guestlist</p>
          </div>
          <Field label="Add features" error="">
            <Input placeholder="21+, dinner, live set" value={values.features} onChange={(event) => onChange({ features: event.target.value })} />
          </Field>
          <button type="button" className="text-sm text-primary" onClick={() => setAdvanced((open) => !open)}>
            {advanced ? "Hide advanced settings" : "Show advanced settings"}
          </button>
          {advanced && (
            <div className="space-y-3">
              <Field label="City" error="">
                <Input value={values.city} onChange={(event) => onChange({ city: event.target.value })} />
              </Field>
              <Field label="Timezone" error="">
                <Input value={values.timezone} onChange={(event) => onChange({ timezone: event.target.value })} />
              </Field>
            </div>
          )}
        </div>
      </div>
      <div className="fixed inset-x-0 bottom-0 flex gap-2 border-t border-border/50 bg-background/95 px-4 py-3 pb-[max(env(safe-area-inset-bottom),12px)]">
        <Button variant="outline" className="flex-1 rounded-full" onClick={onBack}>Back</Button>
        <Button className="flex-1 rounded-full" disabled={saving} onClick={onSave}>{saving ? "Saving…" : "Save"}</Button>
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

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
