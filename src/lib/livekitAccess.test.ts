import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LIVE_VIDEO_NOT_CONFIGURED,
  isStreamRoomName,
  liveKitRoomUpdate,
  liveKitVideoGrant,
  readLiveKitConfig,
  signLiveKitToken,
  signLiveKitWebhook,
  verifyHs256,
  verifyLiveKitWebhook,
  viewerCount,
} from "../../supabase/functions/_shared/livekit-access.mjs";
import {
  LIVE_VIDEO_NOT_CONFIGURED as CLIENT_MESSAGE,
  parseLiveKitTokenResponse,
  pickRecorderMimeType,
  replayContentType,
  replayFileExtension,
} from "./livekitSession.ts";

const STREAM_ID = "0412aaaa-0000-4000-8000-000000000041";
const HOST = "00000000-0000-4000-8000-0000000000aa";
const VIEWER = "00000000-0000-4000-8000-0000000000b1";
const KEY = "APIKeyTest";
const SECRET = "this-is-a-long-enough-livekit-secret";

describe("livekit access", () => {
  it("treats missing credentials as live video not configured", () => {
    assert.equal(readLiveKitConfig({}), null);
    assert.equal(readLiveKitConfig({ LIVEKIT_URL: "wss://example.livekit.cloud", LIVEKIT_API_KEY: KEY }), null);
    assert.equal(LIVE_VIDEO_NOT_CONFIGURED, "Live video not configured");
    assert.equal(CLIENT_MESSAGE, LIVE_VIDEO_NOT_CONFIGURED);
    assert.deepEqual(
      readLiveKitConfig({ LIVEKIT_URL: " wss://ether.livekit.cloud ", LIVEKIT_API_KEY: KEY, LIVEKIT_API_SECRET: SECRET }),
      { url: "wss://ether.livekit.cloud", apiKey: KEY, apiSecret: SECRET },
    );
  });

  it("gives publish rights only to the host and uses the stream id as the room", () => {
    const host = liveKitVideoGrant(HOST, HOST, STREAM_ID);
    const viewer = liveKitVideoGrant(VIEWER, HOST, STREAM_ID);
    assert.equal(host.room, STREAM_ID);
    assert.equal(host.canPublish, true);
    assert.equal(host.canSubscribe, true);
    assert.equal(viewer.room, STREAM_ID);
    assert.equal(viewer.canPublish, false);
    assert.equal(viewer.canSubscribe, true);
    assert.equal(viewer.canPublishData, false);
    assert.equal(liveKitVideoGrant("", HOST, STREAM_ID).canPublish, false);
  });

  it("signs a token whose video grant matches the host or the viewer", async () => {
    const hostGrant = liveKitVideoGrant(HOST, HOST, STREAM_ID);
    const hostToken = await signLiveKitToken({
      apiKey: KEY,
      apiSecret: SECRET,
      identity: HOST,
      video: hostGrant,
      now: 1_700_000_000_000,
    });
    const hostClaims = await verifyHs256(hostToken.token, SECRET, 1_700_000_000_000);
    assert.equal(hostClaims.iss, KEY);
    assert.equal(hostClaims.sub, HOST);
    assert.equal(hostClaims.video.room, STREAM_ID);
    assert.equal(hostClaims.video.canPublish, true);
    assert.equal(hostClaims.video.roomJoin, true);

    const viewerGrant = liveKitVideoGrant(VIEWER, HOST, STREAM_ID);
    const viewerToken = await signLiveKitToken({
      apiKey: KEY,
      apiSecret: SECRET,
      identity: VIEWER,
      video: viewerGrant,
      now: 1_700_000_000_000,
    });
    const viewerClaims = await verifyHs256(viewerToken.token, SECRET, 1_700_000_000_000);
    assert.equal(viewerClaims.video.canPublish, false);
    assert.equal(viewerClaims.video.canSubscribe, true);
    await assert.rejects(() => verifyHs256(viewerToken.token, "wrong-secret", 1_700_000_000_000));
  });

  it("verifies a room webhook and maps start, end, and viewer count", async () => {
    const body = JSON.stringify({
      event: "participant_joined",
      room: { name: STREAM_ID, numParticipants: 4 },
    });
    const authorization = await signLiveKitWebhook({ apiKey: KEY, apiSecret: SECRET, body });
    const event = await verifyLiveKitWebhook(body, authorization, KEY, SECRET);
    assert.deepEqual(liveKitRoomUpdate(event), {
      streamId: STREAM_ID,
      patch: { viewer_count: 3 },
    });
    assert.equal(viewerCount(1), 0);
    assert.deepEqual(liveKitRoomUpdate({ event: "room_started", room: { name: STREAM_ID, numParticipants: 1 }, createdAt: "2026-10-20T00:00:00.000Z" }), {
      streamId: STREAM_ID,
      patch: { is_live: true, started_at: "2026-10-20T00:00:00.000Z", viewer_count: 0 },
    });
    assert.deepEqual(liveKitRoomUpdate({ event: "room_finished", room: { name: STREAM_ID, numParticipants: 0 }, createdAt: "2026-10-20T01:00:00.000Z" }), {
      streamId: STREAM_ID,
      patch: { is_live: false, ended_at: "2026-10-20T01:00:00.000Z", viewer_count: 0 },
    });
    assert.equal(liveKitRoomUpdate({ event: "room_started", room: { name: "not-a-stream" } }), null);
    assert.equal(isStreamRoomName(STREAM_ID), true);
    const tampered = body.replace("4", "9");
    await assert.rejects(() => verifyLiveKitWebhook(tampered, authorization, KEY, SECRET));
  });
});

describe("live video client", () => {
  it("turns a missing LiveKit config into the not-configured state", () => {
    assert.deepEqual(parseLiveKitTokenResponse({ configured: false, error: LIVE_VIDEO_NOT_CONFIGURED }), {
      configured: false,
      error: LIVE_VIDEO_NOT_CONFIGURED,
    });
    assert.deepEqual(parseLiveKitTokenResponse({ error: LIVE_VIDEO_NOT_CONFIGURED }), {
      configured: false,
      error: LIVE_VIDEO_NOT_CONFIGURED,
    });
  });

  it("keeps a configured token response", () => {
    assert.deepEqual(parseLiveKitTokenResponse({
      configured: true,
      url: "wss://ether.livekit.cloud",
      token: "header.payload.sig",
      room: STREAM_ID,
      canPublish: false,
    }), {
      configured: true,
      url: "wss://ether.livekit.cloud",
      token: "header.payload.sig",
      room: STREAM_ID,
      canPublish: false,
    });
  });

  it("picks a recorder type the browser can store", () => {
    assert.equal(pickRecorderMimeType(() => false), null);
    assert.equal(pickRecorderMimeType((type) => type === "video/mp4"), "video/mp4");
    assert.equal(replayFileExtension("video/mp4"), "mp4");
    assert.equal(replayContentType("video/webm;codecs=vp8,opus"), "video/webm");
  });
});
