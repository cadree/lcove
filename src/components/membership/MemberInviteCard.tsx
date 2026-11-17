import { useEffect, useState } from "react";
import { Copy, Link2, Send, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { callRpc } from "@/lib/rpc";
import { memberInviteUrl } from "@/lib/memberReferrals";

type Props = { mode: "vouch" | "referral" };

/** Both admitted members and applicants awaiting review can invite others.
 * An invitation never grants access: every invitee must still apply. */
export function MemberInviteCard({ mode }: Props) {
  const { user } = useAuth();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(true);
  const [failure, setFailure] = useState("");

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    setBusy(true);
    callRpc<string>("get_my_member_referral_code")
      .then((result) => { if (!cancelled) setCode(result); })
      .catch((error: unknown) => {
        if (!cancelled) setFailure(error instanceof Error ? error.message : "Your invite link is unavailable.");
      })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [user?.id]);

  const link = memberInviteUrl(code);
  const isVouch = mode === "vouch";
  const title = isVouch ? "Vouch for a Creative" : "Bring a Creative with You";
  const description = isVouch
    ? "Know someone who belongs in ETHER? Share your personal vouch link. Your creative will still complete the application and be reviewed."
    : "You can invite other creatives while your own application is under review. They'll apply and wait for approval, just like you.";

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
        text: isVouch
          ? "I'm vouching for you to join ETHER. Every creative belongs somewhere."
          : "Come apply to ETHER with me.",
        url: link,
      });
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        toast.error("Could not open sharing. You can copy the link instead.");
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
      {failure ? <p role="status" className="mt-4 text-sm text-muted-foreground">{failure}</p> : null}
      {!failure && (
        <div className="mt-5 space-y-3">
          <label htmlFor={isVouch ? "vouch-url" : "referral-url"} className="text-xs text-muted-foreground">
            Your personal ETHER invite
          </label>
          <Input
            id={isVouch ? "vouch-url" : "referral-url"}
            value={link || ""}
            readOnly
            disabled={busy || !link}
            onFocus={(event) => event.currentTarget.select()}
            className="h-12 w-full text-xs"
            aria-label="Your ETHER invitation link"
          />
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="h-12 flex-1" onClick={() => void copy()} disabled={busy || !link}>
              <Copy className="mr-2 h-4 w-4" /> Copy link
            </Button>
            <Button type="button" className="h-12 flex-1" onClick={() => void share()} disabled={busy || !link}>
              <Send className="mr-2 h-4 w-4" /> Share invite
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            A real person reviews every application. A vouch is an introduction, not automatic admission.
          </p>
        </div>
      )}
    </section>
  );
}
