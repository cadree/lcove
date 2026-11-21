import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, Check, EyeOff, FolderKanban, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { creditByline, creditHref, groupCredits, type WorkCredit } from "@/lib/workCredits";
import { workCreditsApi } from "@/lib/workCreditsApi";

function CreditRow({ credit, profileUserId, children, stacked = false }: { credit: WorkCredit; profileUserId: string; children?: React.ReactNode; stacked?: boolean }) {
  const href = creditHref(credit);
  const byline = creditByline(credit, profileUserId);
  const Fallback = credit.source === "project" ? FolderKanban : ImageIcon;
  const body = (
    <>
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-[10px] border border-border bg-muted">
        {credit.cover ? (
          <img src={credit.cover} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground"><Fallback className="h-5 w-5" /></div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{credit.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          <span className="text-foreground/80">{credit.role}</span>
          {byline ? ` · ${byline}` : ""}
        </p>
      </div>
    </>
  );
  return (
    <li className={stacked ? "flex flex-col gap-2 py-2.5" : "flex items-center gap-3 py-2.5"} data-testid="credit-row">
      {href ? (
        <Link to={href} className="flex min-h-11 min-w-0 flex-1 items-center gap-3 self-stretch">{body}</Link>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3">{body}</div>
      )}
      {children}
    </li>
  );
}

/** Credits section on a profile: finished projects and posts this person is credited on. */
export function ProfileCredits({ userId, isOwner }: { userId: string; isOwner: boolean }) {
  const cache = useQueryClient();
  const [showHidden, setShowHidden] = useState(false);
  const credits = useQuery({
    queryKey: ["profile-credits", userId],
    queryFn: () => workCreditsApi.forProfile(userId),
    enabled: !!userId,
    staleTime: 30_000,
  });
  const respond = useMutation({
    mutationFn: ({ id, show }: { id: string; show: boolean }) => workCreditsApi.respond(id, show),
    onSuccess: (status) => {
      toast.success(status === "accepted" ? "Credit added to your profile" : "Credit hidden");
      void cache.invalidateQueries({ queryKey: ["profile-credits", userId] });
      void cache.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { pending, shown, hidden } = groupCredits(credits.data || [], isOwner);
  if (credits.isPending || credits.isError) return null;
  if (!isOwner && shown.length === 0) return null;

  return (
    <section id="profile-section-credits" className="scroll-mt-20 px-5 py-4" aria-labelledby="credits-title">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 id="credits-title" className="ether-title flex items-center gap-2 text-[22px]">
          <Award className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Credits
        </h2>
        {shown.length > 0 && <span className="mono-label text-[10px] text-muted-foreground">{shown.length}</span>}
      </div>

      {pending.length > 0 && (
        <div className="file-panel mb-3 p-3" data-testid="credits-pending">
          <p className="mono-label mb-1 text-[10px] text-muted-foreground">Waiting on you</p>
          <ul className="divide-y divide-border/60">
            {pending.map((c) => (
              <CreditRow key={c.id} credit={c} profileUserId={userId} stacked>
                <div className="flex gap-2 pl-[60px]">
                  <Button size="sm" className="min-h-11 rounded-full px-3" disabled={respond.isPending} onClick={() => respond.mutate({ id: c.id, show: true })}>
                    <Check className="mr-1 h-3.5 w-3.5" /> Accept
                  </Button>
                  <Button size="sm" variant="ghost" className="min-h-11 rounded-full px-3" disabled={respond.isPending} onClick={() => respond.mutate({ id: c.id, show: false })}>
                    Hide
                  </Button>
                </div>
              </CreditRow>
            ))}
          </ul>
          <p className="mt-1 text-[11px] text-muted-foreground">Accepted credits show on your profile. Hidden ones stay private.</p>
        </div>
      )}

      {shown.length > 0 ? (
        <ul className="divide-y divide-border/60">
          {shown.map((c) => (
            <CreditRow key={c.id} credit={c} profileUserId={userId}>
              {isOwner && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-11 w-11 shrink-0 text-muted-foreground"
                  aria-label={`Hide ${c.title} from your profile`}
                  disabled={respond.isPending}
                  onClick={() => respond.mutate({ id: c.id, show: false })}
                >
                  <EyeOff className="h-4 w-4" />
                </Button>
              )}
            </CreditRow>
          ))}
        </ul>
      ) : (
        isOwner && pending.length === 0 && (
          <p className="text-sm text-muted-foreground">
            When a project you worked on is marked complete, or someone credits you on a post, it shows up here.
          </p>
        )
      )}

      {hidden.length > 0 && (
        <div className="mt-2">
          <button type="button" className="mono-label min-h-11 text-[10px] text-muted-foreground" onClick={() => setShowHidden((v) => !v)} aria-expanded={showHidden}>
            {showHidden ? "Hide" : "Show"} hidden credits ({hidden.length})
          </button>
          {showHidden && (
            <ul className="divide-y divide-border/60 opacity-70">
              {hidden.map((c) => (
                <CreditRow key={c.id} credit={c} profileUserId={userId}>
                  <Button size="sm" variant="outline" className="min-h-11 rounded-full px-3" disabled={respond.isPending} onClick={() => respond.mutate({ id: c.id, show: true })}>
                    Show
                  </Button>
                </CreditRow>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
