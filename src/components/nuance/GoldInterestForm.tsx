import { FormEvent, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { NuanceInterestError, useJoinNuanceInterest } from "@/hooks/useNuanceInterest";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function GoldInterestForm() {
  const { user } = useAuth();
  const join = useJoinNuanceInterest();
  const [email, setEmail] = useState("");
  const [joined, setJoined] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (user?.email) {
      setEmail(user.email);
    }
  }, [user?.email]);

  const accountEmail = user?.email?.trim().toLowerCase() ?? "";
  const lockedToAccount = accountEmail.length > 0;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const normalized = email.trim().toLowerCase();

    if (!EMAIL_PATTERN.test(normalized)) {
      setStatus("Enter a valid email.");
      toast.error("Enter a valid email.");
      return;
    }

    if (lockedToAccount && normalized !== accountEmail) {
      setStatus("Use the email on your Ether account.");
      toast.error("Use the email on your Ether account.");
      return;
    }

    join.mutate(normalized, {
      onSuccess: () => {
        setJoined(true);
        setStatus("You're on the list.");
        toast.success("You're on the list.");
      },
      onError: (error) => {
        if (error instanceof NuanceInterestError && error.alreadyJoined) {
          setJoined(true);
        }
        const message = error instanceof NuanceInterestError
          ? error.message
          : "Could not join the list. Try again in a moment.";
        setStatus(message);
        toast.error(message);
      },
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="nuance-gold-email">Email</Label>
        <Input
          id="nuance-gold-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          readOnly={lockedToAccount}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          aria-describedby="nuance-gold-note"
        />
      </div>
      <p id="nuance-gold-note" className="text-xs text-muted-foreground leading-relaxed">
        {lockedToAccount
          ? "Signed in with your Ether email."
          : "This email is saved on the interest list."}
      </p>
      <Button type="submit" className="w-full" disabled={join.isPending || joined}>
        {join.isPending ? <Loader2 className="animate-spin" /> : null}
        {joined ? "On the list" : "Join the interest list"}
      </Button>
      {status ? (
        <p role="status" className="text-sm text-foreground">
          {status}
        </p>
      ) : null}
    </form>
  );
}
