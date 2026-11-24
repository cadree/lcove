/** Joining a trip: ask the organizer when the server supports requests, otherwise the older direct join. */
export type JoinState = "member" | "pending" | "declined" | "full" | "open";

export function joinState(
  trip: { id: string; joined: boolean; member_count: number; capacity: number },
  mine: { trip_id: string; status: string }[] | undefined
): JoinState {
  if (trip.joined) return "member";
  const request = mine?.find((r) => r.trip_id === trip.id);
  if (request?.status === "pending") return "pending";
  if (request?.status === "declined") return "declined";
  if (trip.member_count >= trip.capacity) return "full";
  return "open";
}

/** True when the database has not been migrated to join requests yet (function missing). */
export function requestsUnavailable(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  return e?.code === "PGRST202" || /creative_trip_request/.test(e?.message || "") && /function|schema cache/i.test(e?.message || "");
}

export const JOIN_LABEL: Record<JoinState, string> = {
  member: "Open trip & budget",
  pending: "Requested · waiting for the organizer",
  declined: "Not this time",
  full: "Trip is full",
  open: "Request to join",
};
