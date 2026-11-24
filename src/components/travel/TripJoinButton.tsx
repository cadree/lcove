import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { discovery, type TripSummary } from "@/lib/creativeDiscovery";
import { useMyTripRequests } from "@/hooks/useMyTripRequests";
import { JOIN_LABEL, joinState, requestsUnavailable } from "@/lib/tripJoin";

/** One button for every state: open the trip, ask to join (with a note to the group), or show where the ask stands. */
export function TripJoinButton({ trip, onOpen, size }: { trip: TripSummary; onOpen: () => void; size?: "sm" | "default" }) {
  const cache = useQueryClient();
  const mine = useMyTripRequests();
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState("");
  const state = joinState(trip, mine.data);
  const done = async () => {
    await Promise.all(["my-trip-requests", "trips", "conversations"].map((key) => cache.invalidateQueries({ queryKey: [key] })));
  };
  const request = useMutation({
    mutationFn: async () => {
      try {
        return await discovery.tripRequest(trip.id, note);
      } catch (error) {
        if (!requestsUnavailable(error)) throw error;
        await discovery.tripAction("join", trip.id);
        return { status: "member" as const };
      }
    },
    onSuccess: async (result) => {
      setAsking(false);
      setNote("");
      await done();
      if (result.status === "member") onOpen();
      else if (result.status === "declined") toast("The organizer passed on this one.");
      else toast.success("Request sent. The organizer will approve or decline.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (state === "member") return <Button size={size} onClick={onOpen}>{JOIN_LABEL.member}</Button>;
  if (state !== "open") return <Button size={size} variant="outline" disabled>{JOIN_LABEL[state]}</Button>;
  return (
    <>
      <Button size={size} onClick={() => setAsking(true)}>{JOIN_LABEL.open}</Button>
      <Dialog open={asking} onOpenChange={setAsking}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ask to join {trip.title}</DialogTitle>
            <DialogDescription>
              The organizer approves new travelers. Once you're in, you join the group chat and the shared budget, and the travelers see your profile and pledges.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              request.mutate();
            }}
          >
            <Textarea
              aria-label="Message the group (optional)"
              placeholder="Message the group (optional): what you make, what you'd like to shoot, how you'd split costs."
              value={note}
              maxLength={500}
              rows={4}
              onChange={(e) => setNote(e.target.value)}
            />
            <Button type="submit" className="w-full" disabled={request.isPending}>
              {request.isPending ? "Sending…" : "Send request"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
