import { ApplicationVouches } from "./ApplicationVouches";
import { useEffect, useState } from "react";
import { HandHeart } from "lucide-react";
import { callRpc } from "@/lib/rpc";

type Review = {
  sponsor_user_id: string;
  sponsor_name: string;
  kind: "vouch" | "referral";
  introduced_at: string;
};

/** Server checks admin role again; reviewers never fetch referral data directly. */
export function MemberReferralReview({ applicantId }: { applicantId: string }) {
  const [review, setReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    callRpc<Review | null>("get_member_referral_for_review", { p_applicant: applicantId })
      .then((result) => { if (!cancelled) setReview(result); })
      .catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [applicantId]);

  return (
    <section className="file-panel p-5" aria-label="Membership introduction">
      <div className="flex items-center gap-2">
        <HandHeart className="h-5 w-5 text-primary" aria-hidden="true" />
        <h3 className="font-display text-lg text-foreground">Member introduction</h3>
      </div>
      {loading ? (
        <p className="mt-2 text-sm text-muted-foreground">Checking introduction…</p>
      ) : failed ? (
        <p className="mt-2 text-sm text-muted-foreground">Introduction details are unavailable.</p>
      ) : review ? (
        <>
          <p className="mt-2 text-sm text-foreground">
            <strong>{review.sponsor_name}</strong> {review.kind === "vouch" ? "vouched for" : "referred"} this creative.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {review.kind === "vouch" ? "Vouched by an active member" : "Referred by someone awaiting approval"}.
            A human review is still required before entry.
          </p>
        </>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">Direct application — no member introduction recorded.</p>
      )}
      <ApplicationVouches applicantId={applicantId} />
    </section>
  );
}
