/**
 * One audio element for the whole app. It lives outside React, so playback keeps
 * going across route changes; screens subscribe to its state.
 */
export interface PlayerTrack {
  /** Stable id, for example "track:<uuid>". */
  id: string;
  title: string;
  artist: string;
  artwork?: string | null;
  src: string;
  artistUserId?: string;
  /** True when only the public preview clip is playing. */
  previewOnly?: boolean;
}

export interface PlayerState {
  track: PlayerTrack | null;
  queue: PlayerTrack[];
  index: number;
  playing: boolean;
  position: number;
  duration: number;
}

type Listener = (state: PlayerState) => void;

let audio: HTMLAudioElement | null = null;
let state: PlayerState = { track: null, queue: [], index: -1, playing: false, position: 0, duration: 0 };
const listeners = new Set<Listener>();

function emit(patch: Partial<PlayerState>) {
  state = { ...state, ...patch };
  for (const fn of listeners) fn(state);
}

/** The shared element, created on first use and kept in the document so iOS treats it as media. */
export function playerElement(): HTMLAudioElement | null {
  if (typeof window === "undefined" || typeof Audio === "undefined") return null;
  if (audio) return audio;
  audio = new Audio();
  audio.preload = "metadata";
  audio.setAttribute("playsinline", "");
  audio.setAttribute("data-ether-player", "");
  audio.style.display = "none";
  document.body?.appendChild(audio);
  audio.addEventListener("play", () => emit({ playing: true }));
  audio.addEventListener("pause", () => emit({ playing: false }));
  audio.addEventListener("timeupdate", () => emit({ position: audio!.currentTime }));
  audio.addEventListener("durationchange", () => emit({ duration: Number.isFinite(audio!.duration) ? audio!.duration : 0 }));
  audio.addEventListener("ended", () => {
    if (state.index + 1 < state.queue.length) void playAt(state.index + 1);
    else emit({ playing: false });
  });
  return audio;
}

export function getPlayerState(): PlayerState {
  return state;
}

export function subscribePlayer(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

async function playAt(index: number) {
  const el = playerElement();
  const track = state.queue[index];
  if (!el || !track) return;
  if (el.src !== track.src) el.src = track.src;
  emit({ track, index, position: 0, duration: 0 });
  await el.play().catch(() => emit({ playing: false }));
}

/** Play a track, optionally inside a queue (for next and previous). */
export async function playTrack(track: PlayerTrack, queue: PlayerTrack[] = [track]) {
  const list = queue.some((t) => t.id === track.id) ? queue : [track, ...queue];
  emit({ queue: list });
  if (state.track?.id === track.id && state.track.src === track.src) {
    await playerElement()?.play().catch(() => undefined);
    return;
  }
  await playAt(list.findIndex((t) => t.id === track.id));
}

export function pausePlayer() {
  playerElement()?.pause();
}

export function togglePlayer() {
  const el = playerElement();
  if (!el || !state.track) return;
  if (el.paused) void el.play().catch(() => undefined);
  else el.pause();
}

export function seekPlayer(seconds: number) {
  const el = playerElement();
  if (!el || !state.track) return;
  el.currentTime = Math.max(0, Math.min(seconds, state.duration || seconds));
  emit({ position: el.currentTime });
}

export function nextTrack() {
  if (state.index + 1 < state.queue.length) void playAt(state.index + 1);
}

/** Restart a track that has played a few seconds; otherwise go back one. */
export function previousTrack() {
  if (state.position > 3 || state.index <= 0) seekPlayer(0);
  else void playAt(state.index - 1);
}

export function stopPlayer() {
  const el = playerElement();
  if (el) {
    el.pause();
    el.removeAttribute("src");
    el.load();
  }
  emit({ track: null, queue: [], index: -1, playing: false, position: 0, duration: 0 });
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
