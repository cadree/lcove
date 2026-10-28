import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface GuestRsvpValues {
  name: string;
  email: string;
  phone: string;
  consent: boolean;
}

export function GuestRsvpDialog({
  open,
  theme,
  submitting,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  theme: "light" | "dark";
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: GuestRsvpValues) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = () => {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "Add your name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = "Add a valid email.";
    if (phone.trim().length > 40) next.phone = "That phone number is too long.";
    setErrors(next);
    if (Object.keys(next).length) return;
    onSubmit({ name: name.trim(), email: email.trim(), phone: phone.trim(), consent });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={theme === "light" ? "light" : undefined}>
        <DialogHeader>
          <DialogTitle>RSVP</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Name" error={errors.name}>
            <Input value={name} autoComplete="name" onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field label="Email" error={errors.email}>
            <Input type="email" value={email} autoComplete="email" onChange={(event) => setEmail(event.target.value)} />
          </Field>
          <Field label="Phone (optional)" error={errors.phone}>
            <Input type="tel" value={phone} autoComplete="tel" onChange={(event) => setPhone(event.target.value)} />
          </Field>
          <label className="flex items-start gap-3 text-sm">
            <Checkbox checked={consent} onCheckedChange={(value) => setConsent(value === true)} />
            <span>Keep me posted on events like this near me. Unsubscribe anytime.</span>
          </label>
          <Button className="h-12 w-full rounded-full" disabled={submitting} onClick={submit}>
            {submitting ? "Saving…" : "RSVP"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
