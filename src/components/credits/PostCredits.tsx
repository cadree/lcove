import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useUserSearch } from "@/hooks/useUserSearch";
import { CREDIT_ROLE_MAX, cleanCreditRole, creditRoleError, type PostCredit } from "@/lib/workCredits";
import { workCreditsApi } from "@/lib/workCreditsApi";

/** Credits under a post: who worked on it. The author can credit people. */
export function PostCredits({ postId, ownsPost, viewerId, onNavigate }: { postId: string; ownsPost: boolean; viewerId?: string; onNavigate?: () => void }) {
  const cache = useQueryClient();
  const [open, setOpen] = useState(false);
  const credits = useQuery({
    queryKey: ["post-credits", postId],
    queryFn: () => workCreditsApi.forPost(postId),
    enabled: !!postId && !!viewerId,
    staleTime: 30_000,
  });
  const remove = useMutation({
    mutationFn: (id: string) => workCreditsApi.removeFromPost(id),
    onSuccess: () => cache.invalidateQueries({ queryKey: ["post-credits", postId] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const list = (credits.data || []).filter((c) => c.status === "accepted" || ownsPost);
  if (!ownsPost && list.length === 0) return null;

  return (
    <div className="mb-4" data-testid="post-credits">
      {list.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Credits">
          {list.map((c) => (
            <li key={c.id} className="flex items-center rounded-full border border-border bg-card/60 pl-1 pr-1.5 text-xs">
              <Link to={`/profile/${c.user_id}`} onClick={onNavigate} className="flex min-h-9 items-center gap-1.5 pr-1">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={c.avatar_url || undefined} />
                  <AvatarFallback className="text-[10px]">{(c.name || "?").charAt(0)}</AvatarFallback>
                </Avatar>
                <span className="font-medium">{c.name || "Member"}</span>
                <span className="text-muted-foreground">{c.role}</span>
                {ownsPost && c.status !== "accepted" && <span className="mono-label text-[9px] text-muted-foreground">{c.status === "pending" ? "· waiting" : "· hidden"}</span>}
              </Link>
              {ownsPost && (
                <button
                  type="button"
                  className="flex h-9 w-7 items-center justify-center text-muted-foreground"
                  aria-label={`Remove ${c.name || "this"} credit`}
                  onClick={() => remove.mutate(c.id)}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {ownsPost && (
        <Button type="button" variant="outline" size="sm" className="mt-2 min-h-11 rounded-full" onClick={() => setOpen(true)}>
          <Award className="mr-1.5 h-3.5 w-3.5" /> Credit people
        </Button>
      )}
      {ownsPost && (
        <CreditPeopleSheet
          open={open}
          onOpenChange={setOpen}
          postId={postId}
          viewerId={viewerId}
          existing={credits.data || []}
          onCredited={() => cache.invalidateQueries({ queryKey: ["post-credits", postId] })}
        />
      )}
    </div>
  );
}

function CreditPeopleSheet({
  open, onOpenChange, postId, viewerId, existing, onCredited,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
  viewerId?: string;
  existing: PostCredit[];
  onCredited: () => void;
}) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<{ user_id: string; display_name: string | null; avatar_url: string | null } | null>(null);
  const [role, setRole] = useState("");
  const search = useUserSearch(query, open && !picked);
  const credit = useMutation({
    mutationFn: () => workCreditsApi.creditOnPost(postId, picked!.user_id, cleanCreditRole(role)),
    onSuccess: (result) => {
      toast.success(result.created ? `Credited ${picked?.display_name || "them"}. They'll be asked to accept.` : "Credit updated");
      setPicked(null);
      setRole("");
      setQuery("");
      onCredited();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const taken = new Set(existing.map((c) => c.user_id));
  const results = (search.data || []).filter((p) => p.user_id !== viewerId);
  const roleError = role ? creditRoleError(role) : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[88dvh] rounded-t-[28px] px-4 pb-8" style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))" }}>
        <SheetTitle className="ether-title pr-10 text-[22px]">Credit people</SheetTitle>
        <SheetDescription className="mb-4 text-sm text-muted-foreground">
          Name who worked on this and what they did. It shows on their profile once they accept.
        </SheetDescription>
        {picked ? (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (!creditRoleError(role)) credit.mutate();
            }}
          >
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={picked.avatar_url || undefined} />
                <AvatarFallback>{(picked.display_name || "?").charAt(0)}</AvatarFallback>
              </Avatar>
              <p className="flex-1 text-sm font-medium">{picked.display_name || "Member"}</p>
              <Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={() => setPicked(null)}>Change</Button>
            </div>
            <label className="block text-xs text-muted-foreground" htmlFor="credit-role">Their role</label>
            <Input
              id="credit-role"
              autoFocus
              value={role}
              maxLength={CREDIT_ROLE_MAX + 10}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Stylist, Lighting, Model…"
              className="h-11"
            />
            {roleError && <p className="text-xs text-destructive">{roleError}</p>}
            <Button type="submit" className="min-h-11 w-full rounded-full" disabled={!!creditRoleError(role) || credit.isPending}>
              {credit.isPending ? "Crediting…" : "Credit"}
            </Button>
          </form>
        ) : (
          <>
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search members by name"
              aria-label="Search members by name"
              className="h-11"
            />
            <ul className="mt-3 divide-y divide-border/60">
              {results.map((p) => (
                <li key={p.user_id}>
                  <button
                    type="button"
                    className="flex min-h-12 w-full items-center gap-3 py-2 text-left disabled:opacity-50"
                    disabled={taken.has(p.user_id)}
                    onClick={() => setPicked(p)}
                  >
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={p.avatar_url || undefined} />
                      <AvatarFallback>{(p.display_name || "?").charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="flex-1 text-sm">{p.display_name || "Member"}</span>
                    {taken.has(p.user_id) ? (
                      <span className="mono-label text-[9px] text-muted-foreground">Credited</span>
                    ) : (
                      <Plus className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
            {query.length >= 2 && !search.isFetching && results.length === 0 && (
              <p className="mt-3 text-sm text-muted-foreground">No members match “{query}”.</p>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
