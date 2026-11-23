import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getPlayerState, pausePlayer, playTrack, seekPlayer, subscribePlayer, type PlayerState, type PlayerTrack } from "@/lib/musicPlayer";
import { othersListening, syncStep, type HostState, type ListenCard, type Listener } from "@/lib/listenTogether";

/**
 * Live rooms for Listen together. One Realtime channel per session, shared by
 * the DM card (which only watches who is in it) and the person listening.
 * The host broadcasts position and play/pause; joiners follow. No database rows.
 */
interface Room {
  session: string;
  channel: RealtimeChannel;
  ready: boolean;
  others: Listener[];
  watchers: Set<(others: Listener[]) => void>;
  refs: number;
  onState?: (state: HostState) => void;
  onHello?: () => void;
}

export interface ListenState {
  card: ListenCard;
  role: "host" | "guest";
  others: Listener[];
  /** Joiner only: the host moved to another song or stopped. */
  waiting: boolean;
}

const rooms = new Map<string, Room>();
let active: { card: ListenCard; role: "host" | "guest"; me: Listener; stop: () => void; waiting: boolean } | null = null;
let snapshot: ListenState | null = null;
const stateListeners = new Set<(s: ListenState | null) => void>();

function publish() {
  const room = active ? rooms.get(active.card.session) : null;
  snapshot = active ? { card: active.card, role: active.role, others: room?.others ?? [], waiting: active.waiting } : null;
  for (const fn of stateListeners) fn(snapshot);
}

export function getListenState() {
  return snapshot;
}

export function subscribeListen(fn: (s: ListenState | null) => void) {
  stateListeners.add(fn);
  return () => stateListeners.delete(fn);
}

function openRoom(session: string, presenceKey: string): Room {
  const existing = rooms.get(session);
  if (existing) {
    existing.refs++;
    return existing;
  }
  const channel = supabase.channel(`listen:${session}`, {
    config: { broadcast: { self: false, ack: false }, presence: { key: presenceKey } },
  });
  const room: Room = { session, channel, ready: false, others: [], watchers: new Set(), refs: 1 };
  channel
    .on("presence", { event: "sync" }, () => {
      room.others = othersListening(channel.presenceState() as Record<string, unknown[]>, active?.me.userId ?? presenceKey);
      for (const fn of room.watchers) fn(room.others);
      if (active?.card.session === session) publish();
    })
    .on("broadcast", { event: "state" }, ({ payload }) => room.onState?.(payload as HostState))
    .on("broadcast", { event: "hello" }, () => room.onHello?.())
    .subscribe((status) => {
      room.ready = status === "SUBSCRIBED";
      if (room.ready && active?.card.session === session) {
        void channel.track(active.me);
        if (active.role === "guest") void channel.send({ type: "broadcast", event: "hello", payload: {} });
        else room.onHello?.();
      }
    });
  rooms.set(session, room);
  return room;
}

function closeRoom(session: string) {
  const room = rooms.get(session);
  if (!room) return;
  room.refs--;
  if (room.refs > 0) return;
  rooms.delete(session);
  void supabase.removeChannel(room.channel);
}

/** Watch who is listening in a session, for the DM card. */
export function watchRoom(session: string, me: string, fn: (others: Listener[]) => void) {
  const room = openRoom(session, me);
  room.watchers.add(fn);
  fn(room.others);
  return () => {
    room.watchers.delete(fn);
    closeRoom(session);
  };
}

export function leaveListening() {
  if (!active) return;
  const prev = active;
  active = null;
  prev.stop();
  const room = rooms.get(prev.card.session);
  if (room?.ready) void room.channel.untrack();
  closeRoom(prev.card.session);
  publish();
}

function hostPayload(s: PlayerState, trackId: string): HostState {
  return { trackId: s.track?.id === trackId ? trackId : "", playing: s.track?.id === trackId && s.playing, position: s.position, previewOnly: !!s.track?.previewOnly };
}

/** The sharer: keep broadcasting what the shared player is doing with this track. */
export function startHosting(card: ListenCard, me: Listener) {
  leaveListening();
  const trackId = `track:${card.trackId}`;
  const room = openRoom(card.session, me.userId);
  const send = () => {
    if (room.ready) void room.channel.send({ type: "broadcast", event: "state", payload: hostPayload(getPlayerState(), trackId) });
  };
  room.onHello = send;
  let last = getPlayerState();
  const stopFollowing = subscribePlayer((s) => {
    const jumped = Math.abs(s.position - last.position) > 1.5;
    if (s.playing !== last.playing || s.track?.id !== last.track?.id || jumped) send();
    last = s;
  });
  const beat = setInterval(() => {
    if (getPlayerState().playing) send();
  }, 2000);
  active = {
    card,
    role: "host",
    me,
    waiting: false,
    stop: () => {
      stopFollowing();
      clearInterval(beat);
      room.onHello = undefined;
    },
  };
  if (room.ready) {
    void room.channel.track(me);
    send();
  }
  publish();
}

/**
 * The friend: start the track inside the tap (so the browser allows sound),
 * then follow the host. Pausing or playing something else leaves the session.
 */
export function joinListening(card: ListenCard, me: Listener, track: PlayerTrack) {
  leaveListening();
  void playTrack(track);
  const room = openRoom(card.session, me.userId);
  let applying = false;
  let hostPlaying = true;
  room.onState = (host) => {
    if (!active || active.role !== "guest") return;
    const s = getPlayerState();
    const step = syncStep({ playing: s.playing, position: s.position, trackId: s.track?.id ?? null }, host.trackId ? host : { ...host, trackId: "\u0000" });
    hostPlaying = host.playing;
    const waiting = step.switched || !host.trackId;
    if (active.waiting !== waiting) {
      active.waiting = waiting;
      publish();
    }
    applying = true;
    try {
      if (waiting) {
        pausePlayer();
        return;
      }
      if (step.seek !== null) seekPlayer(step.seek);
      if (step.play === true) void playTrack(track);
      if (step.play === false) pausePlayer();
    } finally {
      queueMicrotask(() => {
        applying = false;
      });
    }
  };
  let last = getPlayerState();
  const stopFollowing = subscribePlayer((s) => {
    const steppedAway = s.track?.id !== track.id || (last.playing && !s.playing && !applying && hostPlaying && !active?.waiting);
    last = s;
    if (steppedAway && active?.role === "guest") leaveListening();
  });
  active = {
    card,
    role: "guest",
    me,
    waiting: false,
    stop: () => {
      stopFollowing();
      room.onState = undefined;
    },
  };
  if (room.ready) {
    void room.channel.track(me);
    void room.channel.send({ type: "broadcast", event: "hello", payload: {} });
  }
  publish();
}
