import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { LandingNav } from "@/components/landing/LandingNav";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { WAITLIST_CONFIRMATION } from "@/content/copy";
import { SITE_ORIGIN } from "@/config/launch";
import { captureSignupAttribution } from "@/lib/signupAttribution";
import { waitlistInvitePath } from "@/lib/waitlist";
import { PageMeta } from "@/components/seo/PageMeta";

const FIELD_ERRORS: Record<string, string> = {
  "name required": "Name is required.",
  "email required": "Email is required.",
  "invalid email": "Enter a valid email.",
  "email_me required": "Check the box to be emailed when it opens.",
  "invalid ig": "Use only letters, numbers, dots, and underscores in the IG handle.",
  "what do you make is too long": "Keep that note under 280 characters.",
};

export default function Waitlist() {
  const [searchParams] = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [ig, setIg] = useState("");
  const [makes, setMakes] = useState("");
  const [emailMe, setEmailMe] = useState(false);
  const [company, setCompany] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [refCode, setRefCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    captureSignupAttribution(window.location.search, window.location.pathname, window.localStorage);
  }, []);

  const inviteUrl = refCode ? `${SITE_ORIGIN}${waitlistInvitePath(refCode)}` : "";

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (!email.trim()) {
      setError("Email is required.");
      return;
    }
    if (!emailMe) {
      setError("Check the box to be emailed when it opens.");
      return;
    }
    setPending(true);
    const { data, error: rpcError } = await supabase.rpc("join_waitlist", {
      p_name: name.trim(),
      p_email: email.trim(),
      p_email_me: true,
      p_ig_handle: ig.trim() || undefined,
      p_what_do_you_make: makes.trim() || undefined,
      p_src: searchParams.get("src") ?? undefined,
      p_ref: searchParams.get("ref") ?? undefined,
      p_company: company,
    });
    setPending(false);
    if (rpcError || !data) {
      const message = rpcError?.message?.toLowerCase() ?? "";
      const known = Object.keys(FIELD_ERRORS).find((key) => message.includes(key));
      setError(known ? FIELD_ERRORS[known] : "Something went wrong. Please try again.");
      return;
    }
    setRefCode(data);
  };

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <PageMeta title="Waitlist · Ether" description={WAITLIST_CONFIRMATION} />
      <LandingNav />
      <main className="px-4 pb-16 pt-28 sm:px-6">
        <div className="mx-auto w-full max-w-md lg:max-w-lg">
          {refCode ? (
            <div className="file-panel px-4 py-6 text-center sm:px-6">
              <h1 className="ether-title text-3xl text-foreground">{WAITLIST_CONFIRMATION}</h1>
              <label htmlFor="invite-link" className="mt-6 block text-left text-sm text-muted-foreground">
                Invite link
              </label>
              <Input id="invite-link" readOnly value={inviteUrl} className="mt-2" />
              <Button type="button" className="mt-4 w-full" onClick={() => void copyInvite()}>
                {copied ? "Copied" : "Copy invite link"}
              </Button>
            </div>
          ) : (
            <form className="file-panel space-y-4 px-4 py-6 sm:px-6" onSubmit={(event) => void submit(event)}>
              <h1 className="ether-title text-3xl text-foreground">Join the waitlist</h1>
              <div className="space-y-2">
                <Label htmlFor="waitlist-name">Name</Label>
                <Input
                  id="waitlist-name"
                  name="name"
                  autoComplete="name"
                  required
                  maxLength={100}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="waitlist-email">Email</Label>
                <Input
                  id="waitlist-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={255}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="waitlist-ig">IG handle</Label>
                <Input
                  id="waitlist-ig"
                  name="ig"
                  autoComplete="off"
                  maxLength={31}
                  value={ig}
                  onChange={(event) => setIg(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="waitlist-makes">What do you make?</Label>
                <Textarea
                  id="waitlist-makes"
                  name="makes"
                  maxLength={280}
                  value={makes}
                  onChange={(event) => setMakes(event.target.value)}
                />
              </div>
              <label className="flex items-start gap-3 text-sm text-foreground">
                <Checkbox
                  checked={emailMe}
                  onCheckedChange={(checked) => setEmailMe(checked === true)}
                  aria-required="true"
                />
                <span>email me when it opens</span>
              </label>
              <div className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden="true">
                <label htmlFor="company">Company</label>
                <input
                  id="company"
                  name="company"
                  tabIndex={-1}
                  autoComplete="off"
                  value={company}
                  onChange={(event) => setCompany(event.target.value)}
                />
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "Sending" : "Join"}
              </Button>
            </form>
          )}
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
