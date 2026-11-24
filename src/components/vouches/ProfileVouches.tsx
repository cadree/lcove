import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Flag, HandHeart, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ReportDialog } from "@/components/safety/ReportDialog";
import { vouchCountLabel } from "@/lib/vouches";
import { vouchesApi } from "@/lib/vouchesApi";

const DAY = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" });

/** Vouches section on a profile: count, who vouched, on what, and their notes. */
export function ProfileVouches({ userId, viewerId, isOwner }: { userId: string; viewerId?: string; isOwner: boolean }) {
  const cache = useQueryClient();
  const [reporting, setReporting] = useState<string | null>(null);
  const vouches = useQuery({
    queryKey: ["profile-vouches", userId],
    queryFn: () => vouchesApi.forProfile(userId),
    enabled: !!userId,
    staleTime: 30_000,
  });
  const remove = useMutation({
    mutationFn: (id: string) => vouchesApi.remove(id),
    onSuccess: () => {
      toast.success("Vouch removed");
      void cache.invalidateQueries({ queryKey: ["profile-vouches", userId] });
      void cache.invalidateQueries({ queryKey: ["project-wrap-up"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (vouches.isPending || vouches.isError) return null;
  const { count, items } = vouches.data || { count: 0, items: [] };
  if (!isOwner && count === 0) return null;
  return (
    <section id="profile-section-vouches" className="scroll-mt-20 px-5 py-4" aria-labelledby="vouches-title">
      <div className="mb-1 flex items-baseline justify-between">
        <h2 id="vouches-title" className="ether-title flex items-center gap-2 text-[22px]">
          <HandHeart className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Vouches
        </h2>
        {count > 0 && <span className="mono-label text-[10px] text-muted-foreground" data-testid="vouch-count">{vouchCountLabel(count)}</span>}
      </div>
      {count > 0 ? (
        <>
          <p className="mb-2 text-xs text-muted-foreground">People they made things with say they showed up and delivered.</p>
          <ul className="divide-y divide-border/60">
            {items.map((v) => (
              <li key={v.id} className="flex gap-3 py-3" data-testid="vouch-row">
                <Link to={`/profile/${v.author_id}`} className="shrink-0" aria-label={v.author_name || "Member"}>
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={v.author_avatar || undefined} />
                    <AvatarFallback>{(v.author_name || "?").charAt(0)}</AvatarFallback>
                  </Avatar>
                </Link>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <Link to={`/profile/${v.author_id}`} className="font-medium">{v.author_name || "Member"}</Link>
                    <span className="text-muted-foreground"> vouched</span>
                    {v.project_title && v.project_id && (
                      <>
                        <span className="text-muted-foreground"> on </span>
                        <Link to={`/project/${v.project_id}`} className="font-medium">{v.project_title}</Link>
                      </>
                    )}
                  </p>
                  {v.note && <p className="mt-1 whitespace-pre-line break-words text-sm text-foreground/90">“{v.note}”</p>}
                  <p className="mt-1 text-[11px] text-muted-foreground">{DAY.format(new Date(v.created_at))}</p>
                </div>
                {viewerId === v.author_id ? (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-11 w-11 shrink-0 text-muted-foreground"
                    aria-label="Delete your vouch"
                    disabled={remove.isPending}
                    onClick={() => {
                      if (window.confirm("Delete your vouch?")) remove.mutate(v.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : viewerId ? (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-11 w-11 shrink-0 text-muted-foreground"
                    aria-label={`Report vouch from ${v.author_name || "this member"}`}
                    onClick={() => setReporting(v.id)}
                  >
                    <Flag className="h-4 w-4" />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          When a project you worked on is marked complete, teammates can vouch for you. Vouches show here.
        </p>
      )}
      <ReportDialog open={!!reporting} onOpenChange={(open) => !open && setReporting(null)} targetType="vouch" targetId={reporting || ""} />
    </section>
  );
}
