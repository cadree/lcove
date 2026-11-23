import assert from "node:assert/strict";
import test from "node:test";
import { cardFromPlaying, decodeListenCard, encodeListenCard, joinMode, linkSource, othersListening, syncStep, type ListenCard } from "./listenTogether.ts";
import { messagePreview, splitShareMessage } from "./shareCard.ts";

const ether: ListenCard = {
  kind: "listen",
  session: "0b6f6c3e-1111-4c4c-9c9c-123456789abc",
  hostId: "u-host",
  source: "ether",
  title: "Neon Dreams",
  artist: "Nova Lane",
  artwork: "https://x.supabase.co/a.jpg",
  trackId: "t1",
  href: "/profile/u-artist/music",
  hostPreview: false,
};

test("a Listen together card survives the DM round trip and reads well in the chat list", () => {
  const content = `see you there\n${encodeListenCard(ether)}`;
  const { note, listen, card } = splitShareMessage(content);
  assert.equal(note, "see you there");
  assert.equal(card, null);
  assert.deepEqual(listen, { ...ether, url: undefined });
  assert.equal(messagePreview(content), "Listen together");
});

test("streaming cards are link-only and must point at the real service", () => {
  const spotify = { ...ether, source: "spotify", trackId: undefined, url: "https://open.spotify.com/track/abc" } as ListenCard;
  const back = decodeListenCard(encodeListenCard(spotify))!;
  assert.equal(back.url, "https://open.spotify.com/track/abc");
  assert.equal(back.trackId, undefined);
  assert.equal(messagePreview(encodeListenCard(spotify)), "Shared a song");
  assert.equal(decodeListenCard(encodeListenCard({ ...spotify, url: "https://evil.example/track" })), null);
  assert.equal(decodeListenCard(encodeListenCard({ ...spotify, url: "javascript:alert(1)" })), null);
});

test("cards with unsafe links, odd sessions or missing tracks are ignored", () => {
  assert.equal(decodeListenCard(encodeListenCard({ ...ether, href: "//evil.example" })), null);
  assert.equal(decodeListenCard(encodeListenCard({ ...ether, session: "a b" })), null);
  assert.equal(decodeListenCard(encodeListenCard({ ...ether, trackId: undefined })), null);
  assert.equal(decodeListenCard(encodeListenCard({ ...ether, artwork: "http://plain/a.jpg" }))?.artwork, null);
  assert.equal(decodeListenCard("ether-card:{bad json"), null);
});

test("joining follows the access rules", () => {
  assert.equal(joinMode({ source: "spotify", hostPreviewOnly: false, fullUrl: null, previewUrl: null }), "link");
  assert.equal(joinMode({ source: "ether", hostPreviewOnly: false, fullUrl: "https://signed", previewUrl: "https://p" }), "sync-full");
  assert.equal(joinMode({ source: "ether", hostPreviewOnly: false, fullUrl: null, previewUrl: "https://p" }), "preview-only");
  assert.equal(joinMode({ source: "ether", hostPreviewOnly: false, fullUrl: null, previewUrl: null }), "buy");
  assert.equal(joinMode({ source: "ether", hostPreviewOnly: true, fullUrl: "https://signed", previewUrl: "https://p" }), "sync-preview");
});

test("the joiner seeks only past the drift limit and mirrors play/pause", () => {
  const host = { trackId: "track:t1", playing: true, position: 42, previewOnly: false };
  assert.deepEqual(syncStep({ trackId: "track:t1", playing: true, position: 41.6 }, host), { seek: null, play: null, switched: false });
  assert.deepEqual(syncStep({ trackId: "track:t1", playing: true, position: 30 }, host), { seek: 42, play: null, switched: false });
  assert.deepEqual(syncStep({ trackId: "track:t1", playing: true, position: 42 }, { ...host, playing: false }), { seek: null, play: false, switched: false });
  assert.deepEqual(syncStep({ trackId: "track:t1", playing: false, position: 42 }, host).play, true);
  assert.equal(syncStep({ trackId: "track:t1", playing: true, position: 42 }, { ...host, trackId: "track:t2" }).switched, true);
});

test("presence lists each other listener once and never me", () => {
  const state = {
    a: [{ userId: "me", name: "Rae", avatar: null }],
    b: [{ userId: "maya", name: "Maya", avatar: "https://a" }, { userId: "maya", name: "Maya", avatar: "https://a" }],
    c: [{ nope: true }],
  };
  assert.deepEqual(othersListening(state, "me"), [{ userId: "maya", name: "Maya", avatar: "https://a" }]);
});

test("only Ether tracks become sync cards; streaming platforms map to link sources", () => {
  const card = cardFromPlaying({ id: "track:t1", title: "Neon Dreams", artist: "Nova", artistUserId: "u-artist", previewOnly: true }, "u-host", "sess-123456");
  assert.equal(card?.trackId, "t1");
  assert.equal(card?.hostPreview, true);
  assert.equal(card?.href, "/profile/u-artist/music");
  assert.equal(cardFromPlaying({ id: "release:x", title: "x", artist: "y", artistUserId: "u" }, "u", "sess-123456"), null);
  assert.equal(linkSource("apple_music"), "apple_music");
  assert.equal(linkSource("tidal"), null);
});
