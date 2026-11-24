import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { discovery } from "@/lib/creativeDiscovery";
import { safeWebLink } from "@/lib/tripMoney";

/** Pending asks to join, shown to the trip. Only the organizer can approve or decline. Hidden when there are none. */
export function TripRequestsPanel({ tripId, organizer }: { tripId: string; organizer: boolean }) {
  const cache = useQueryClient();
  const requests = useQuery({
    queryKey: ["trip-requests", tripId],
    queryFn: () => discovery.tripRequests(tripId),
    retry: false,
    refetchInterval: 30_000,
  });
  const answer = useMutation({
    mutationFn: ({ user, approve }: { user: string; approve: boolean }) => discovery.tripAnswer(tripId, user, approve),
    onSuccess: async (_, { approve }) => {
      await Promise.all(["trip-requests", "trip", "trips", "conversations"].map((key) => cache.invalidateQueries({ queryKey: [key] })));
      toast.success(approve ? "Approved. They're in the group chat now." : "Declined.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const pending = (requests.data || []).filter((r) => r.status === "pending");
  if (!pending.length) return null;
  return (
    <section className="file-panel space-y-3 p-5" aria-label="Requests to join">
      <h3 className="font-medium">Asking to join ({pending.length})</h3>
      <ul className="space-y-3">
        {pending.map((r) => {
          const photo = safeWebLink(r.avatar_url);
          return (
            <li key={r.user_id} className="rounded-2xl bg-white/5 p-3">
              <div className="flex items-center gap-2">
                <span className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-white/10">{photo && <img src={photo} alt="" className="h-full w-full object-cover" />}</span>
                <a href={`/profile/${r.user_id}`} className="truncate text-sm font-medium underline-offset-2 hover:underline">{r.display_name}</a>
              </div>
              {r.note && <p className="mt-2 whitespace-pre-wrap text-sm">{r.note}</p>}
              {organizer ? (
                <div className="mt-2 flex gap-2">
                  <Button size="sm" disabled={answer.isPending} onClick={() => answer.mutate({ user: r.user_id, approve: true })}>Approve</Button>
                  <Button size="sm" variant="ghost" disabled={answer.isPending} onClick={() => answer.mutate({ user: r.user_id, approve: false })}>Decline</Button>
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">The organizer decides.</p>
              )}
            </li>
          );
        })}
      </ul>
      {organizer && <p className="text-xs text-muted-foreground">Approving resets everyone's pledges to the new shares.</p>}
    </section>
  );
}
