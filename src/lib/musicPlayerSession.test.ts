import assert from "node:assert/strict";
import test from "node:test";

// A tiny fake browser: one audio element class, a media session and MediaMetadata.
class FakeAudio extends EventTarget {
  src = "";
  paused = true;
  currentTime = 0;
  duration = NaN;
  preload = "";
  style: Record<string, string> = {};
  setAttribute() {}
  removeAttribute(name: string) {
    if (name === "src") this.src = "";
  }
  load() {}
  play() {
    this.paused = false;
    this.dispatchEvent(new Event("play"));
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
    this.dispatchEvent(new Event("pause"));
  }
}
const handlers = new Map<string, (details: { seekTime?: number }) => void>();
const session: { metadata: unknown; playbackState: string; setActionHandler: (a: string, h: never) => void; setPositionState: (s: unknown) => void; position?: unknown } = {
  metadata: null,
  playbackState: "none",
  setActionHandler: (action, handler) => handlers.set(action, handler),
  setPositionState: (s) => {
    session.position = s;
  },
};
Object.assign(globalThis, {
  window: globalThis,
  Audio: FakeAudio,
  MediaMetadata: class {
    constructor(init: object) {
      Object.assign(this, init);
    }
  },
  document: { body: { appendChild() {} } },
});
Object.defineProperty(globalThis, "navigator", { value: { mediaSession: session }, configurable: true });

const player = await import("./musicPlayer.ts");

const a = { id: "track:a", title: "Neon Dreams", artist: "Nova Lane", artwork: "https://x/a.jpg", src: "https://x/a.mp3" };
const b = { id: "track:b", title: "Rose Room", artist: "Nova Lane", src: "https://x/b.mp3", previewOnly: true };

test("playing a track fills the lock screen and binds transport buttons", async () => {
  await player.playTrack(a, [a, b]);
  const meta = session.metadata as { title: string; artist: string; artwork: { src: string }[] };
  assert.equal(meta.title, "Neon Dreams");
  assert.equal(meta.artist, "Nova Lane");
  assert.equal(meta.artwork[0].src, "https://x/a.jpg");
  assert.equal(session.playbackState, "playing");
  for (const action of ["play", "pause", "previoustrack", "nexttrack", "seekto"]) assert.ok(handlers.has(action), action);
});

test("lock-screen next, pause and seek drive the shared player", async () => {
  handlers.get("nexttrack")!({});
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(player.getPlayerState().track?.id, "track:b");
  assert.equal((session.metadata as { album: string }).album, "Preview on Ether");
  handlers.get("pause")!({});
  assert.equal(player.getPlayerState().playing, false);
  assert.equal(session.playbackState, "paused");
  handlers.get("seekto")!({ seekTime: 12 });
  assert.equal(player.getPlayerState().position, 12);
});

test("other players hear when shared playback starts, and stop clears the lock screen", async () => {
  let heard = 0;
  const off = player.onSharedPlay(() => heard++);
  player.togglePlayer();
  assert.equal(heard, 1);
  off();
  player.stopPlayer();
  assert.equal(session.metadata, null);
  assert.equal(session.playbackState, "none");
});

test("a full-file track replaces its preview copy in the queue", async () => {
  const preview = { ...a, src: "https://x/a-preview.mp3", previewOnly: true };
  await player.playTrack(a, [preview, b]);
  assert.equal(player.getPlayerState().track?.src, "https://x/a.mp3");
  assert.equal(player.getPlayerState().queue.length, 2);
  player.stopPlayer();
});
