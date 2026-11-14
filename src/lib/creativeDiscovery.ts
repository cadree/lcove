import { callRpc } from "@/lib/rpc";
import type { DiscoverySignal } from "@/lib/peopleDiscovery";

export interface DiscoveryCity {
  city_key: string;
  label: string;
  count: number;
  image: string | null;
}
export interface CreativePerson {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  city: string | null;
  city_key: string | null;
  liked: boolean | null;
}
export interface DiscoverySettings {
  discoverable: boolean;
  matches_only: boolean;
  /** Opt-in live city, city level only. Null when off or expired. */
  live_city_key?: string | null;
  live_until?: string | null;
}
export interface CreativeMatch {
  user_id: string;
  display_name: string | null;
  conversation_id: string;
}
export interface TripSummary {
  id: string;
  organizer_id: string;
  city_key: string;
  city_label: string;
  title: string;
  starts_on: string;
  ends_on: string;
  capacity: number;
  notes: string;
  status: "planning" | "booked" | "completed" | "cancelled";
  conversation_id: string;
  joined: boolean;
  member_count: number;
  roster: { user_id: string; display_name: string }[];
}
export interface TripJoinRequest {
  trip_id: string;
  user_id: string;
  note: string;
  status: "pending" | "approved" | "declined";
  created_at: string;
  display_name: string;
  avatar_url: string | null;
}
export interface TripMember {
  user_id: string;
  display_name: string;
  share_cents: number;
  pledge_cents: number;
  reported_paid_cents: number;
  approved_revision: number | null;
}
export interface TripItem {
  id: string;
  label: string;
  estimate_cents: number;
  quote_url: string;
  receipt_url: string | null;
  actual_cents: number | null;
  purchased_by: string | null;
  votes: { user_id: string; approved: boolean }[];
}
export interface Trip extends TripSummary {
  revision: number;
  total_cents: number;
  members: TripMember[];
  items: TripItem[];
  audit: {
    id: number;
    action: string;
    details?: { cents?: number; actual_cents?: number; approved?: boolean };
    actor_id: string;
    revision: number;
    created_at: string;
  }[];
}
export interface MessageRequest {
  id: string;
  user_id: string;
  body: string;
  sent_at: string;
  display_name?: string;
  avatar_url?: string | null;
  city?: string | null;
}
export interface MessageRequestInbox {
  incoming: MessageRequest[];
  outgoing: MessageRequest[];
}
export const discovery = {
  settings: (
    values: { p_discoverable?: boolean; p_matches_only?: boolean } = {}
  ) => callRpc<DiscoverySettings>("discovery_settings", values),
  people: (city: string | null, query: string, offset = 0) =>
    callRpc<{ cities: DiscoveryCity[]; people: CreativePerson[] }>(
      "discovery_people",
      { p_city: city, p_query: query, p_offset: offset }
    ),
  /** Everyone the viewer can discover, with likes, live cities and travel badges. */
  globe: () => callRpc<DiscoverySignal[]>("discovery_globe"),
  /** Share a live city for 1-168 hours, or pass null to turn it off. */
  liveCity: (cityKey: string | null, hours: number | null) =>
    callRpc<DiscoverySettings>("discovery_live_city", { p_city_key: cityKey, p_hours: hours }),
  swipe: (target: string, liked: boolean) =>
    callRpc<{ matched: boolean; conversation_id: string | null }>(
      "creative_swipe",
      { p_target: target, p_liked: liked }
    ),
  matches: () => callRpc<CreativeMatch[]>("creative_match_list"),
  /** Write to someone you have not matched with: it waits quietly in their Requests. */
  requestMessage: (recipient: string, body: string) =>
    callRpc<{ status: "sent" | "matched"; conversation_id: string | null }>("send_message_request", { p_recipient: recipient, p_body: body }),
  requests: () => callRpc<MessageRequestInbox>("message_request_inbox"),
  ignoreRequest: (id: string) => callRpc<void>("ignore_message_request", { p_id: id }),
  unmatch: (target: string) =>
    callRpc<void>("creative_unmatch", { p_target: target }),
  trips: (
    city: string | null = null,
    start: string | null = null,
    end: string | null = null
  ) =>
    callRpc<TripSummary[]>("creative_trip_list", {
      p_city: city,
      p_start: start,
      p_end: end,
    }),
  trip: (id: string) => callRpc<Trip>("creative_trip_snapshot", { p_trip: id }),
  /** Ask to join a trip, with an optional note the group sees. The organizer approves. */
  tripRequest: (trip: string, note: string) =>
    callRpc<{ status: "pending" | "declined" | "member" }>("creative_trip_request", { p_trip: trip, p_note: note }),
  tripAnswer: (trip: string, user: string, approve: boolean) =>
    callRpc<Trip>("creative_trip_answer", { p_trip: trip, p_user: user, p_approve: approve }),
  /** My requests everywhere (no trip), or a trip's pending requests for its members. */
  tripRequests: (trip: string | null = null) => callRpc<TripJoinRequest[]>("creative_trip_requests", { p_trip: trip }),
  tripAction: (
    action: string,
    trip: string | null,
    data: Record<string, unknown> = {}
  ) =>
    callRpc<Trip>("creative_trip_action", {
      p_action: action,
      p_trip: trip,
      p_data: data,
    }),
};
