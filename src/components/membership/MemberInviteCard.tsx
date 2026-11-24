import { type FormEvent, useEffect, useId, useState } from "react";
import { Copy, Link2, Mail, Send, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { callRpc } from "@/lib/rpc";
import { memberInviteUrl } from "@/lib/memberReferrals";

type Props = { mode: "vouch" | "referral" };

/** Both active members and verified pending applicants may introduce others.
 * Every invitee creates an account and completes independent human review. */
export function MemberInviteCard({ mode }: Props) {
  const { user } = useAuth();
  const id = useId();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(true);
  const [failure, setFailure] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState("");

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    setBusy(true);
    setFailure("");
    callRpc<string>("get_my_member_referral_code")
      .then((value) => { if (!cancelled) setCode(value); })
      .catch((error: unknown) => {
        if (!cancelled) setFailure(error instanceof Error ? error.message : "Your invitation link is unavailable.");
      })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [user?.id]);

  const link = memberInviteUrl(code);
  const isVouch = mode === "vouch";
  const title = isVouch ? "Vouch for a Creative" : "Bring a Creative with You";
  const description = isVouch
    ? "Invite a creative you believe in. They'll apply and be reviewed before joining."
    : "You can invite other creatives while your own application is under review.";

  const sendEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sending || !link) return;
    const recipient = email.trim();
    setSending(true);
    setFailure("");
    setResult("");
    try {
      await callRpc<{ queued: boolean }>("send_member_referral_invite", {
        p_name: name.trim(),
        p_email: recipient,
      });
      setName("");
      setEmail("");
      setResult(`Invitation queued for ${recipient}. You can invite another creative.`);
      toast.success("ETHER invitation queued");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not send your invitation.";
      setFailure(message);
      toast.error("Could not queue invitation");
    } finally {
      setSending(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Invite link copied");
    } catch {
      toast.info("Select and copy your personal invite link below.");
    }
  };

  const share = async () => {
    if (!navigator.share) { await copy(); return; }
    try {
      await navigator.share({
        title: "Join the ETHER Familcy",
        text: isVouch ? "I'm vouching for you to join ETHER." : "Come apply to ETHER with me.",
        url: link,
      });
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        toast.error("Could not open sharing. Copy the link instead.");
      }
    }
  };

  return (
    <section aria-label={title} className="file-panel w-full rounded-2xl p-5 text-left">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          {isVouch ? <Users className="h-5 w-5" aria-hidden="true" /> : <Link2 className="h-5 w-5" aria-hidden="true" />}
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-xl text-foreground">{title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>

      {busy && <p role="status" className="mt-5 text-sm text-muted-foreground">Preparing your invitation…</p>}
      {failure && <p role="alert" className="mt-4 text-sm text-destructive">{failure}</p>}
      {result && <p role="status" className="mt-4 text-sm text-primary">{result}</p>}

      {!busy && link && (
        <>
          <form onSubmit={(event) => void sendEmail(event)} className="mt-5 space-y-3">
            <div className="space-y-1">
              <label htmlFor={`${id}-creative-name`} className="text-xs font-medium text-foreground">
                Creative's name
              </label>
              <Input id={`${id}-creative-name`} type="text" value={name} required maxLength={80}
                onChange={(event) => setName(event.target.value)} placeholder="Their name"
                autoComplete="off" className="h-12 w-full" disabled={sending} />
            </div>
            <div className="space-y-1">
              <label htmlFor={`${id}-creative-email`} className="text-xs font-medium text-foreground">
                Email address
              </label>
              <Input id={`${id}-creative-email`} type="email" value={email} required maxLength={254}
                onChange={(event) => setEmail(event.target.value)} placeholder="creative@example.com"
                autoComplete="off" autoCapitalize="none" className="h-12 w-full" disabled={sending} />
            </div>
            <Button type="submit" className="min-h-12 w-full" disabled={sending || !name.trim() || !email.trim()}>
              <Mail className="mr-2 h-4 w-4" aria-hidden="true" />
              {sending ? "Sending invitation…" : "Send ETHER invitation"}
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" aria-hidden="true" />
            Or share your personal link
            <span className="h-px flex-1 bg-border" aria-hidden="true" />
          </div>
          <Input value={link} readOnly onFocus={(event) => event.currentTarget.select()}
            className="h-11 w-full text-xs" aria-label="Your ETHER invitation link" />
          <div className="mt-3 flex gap-2">
            <Button type="button" variant="outline" className="min-h-11 flex-1" onClick={() => void copy()}>
              <Copy className="mr-2 h-4 w-4" aria-hidden="true" /> Copy
            </Button>
            <Button type="button" variant="outline" className="min-h-11 flex-1" onClick={() => void share()}>
              <Send className="mr-2 h-4 w-4" aria-hidden="true" /> Share
            </Button>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            Invitations are limited to 10 per day. Each person must complete an application and be approved.
          </p>
        </>
      )}
      {!busy && !link && (
        <Button type="button" variant="outline" className="mt-4 min-h-11"
          onClick={() => { setFailure(""); setBusy(true);
            callRpc<string>("get_my_member_referral_code")
              .then(setCode).catch((error: unknown) => setFailure(error instanceof Error ? error.message : "Could not load invites"))
              .finally(() => setBusy(false)); }}>
          Retry invitations
        </Button>
      )}
    </section>
  );
}
