import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  APNS_PRODUCTION_HOST,
  IOS_APP_TOPIC,
  apnsTokenShouldDrop,
  buildApnsAlertPayload,
  classifyPushSubscription,
  sendApnsAlert,
} from "../../supabase/functions/_shared/apns.mjs";

const TOKEN = "a".repeat(64);

function fakeFetch(status: number, body = "") {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(body, { status });
  };
  return { calls, fetchImpl };
}

describe("APNs alert payload", () => {
  it("sends a production alert with the same open path as web push", async () => {
    const { calls, fetchImpl } = fakeFetch(200);
    const result = await sendApnsAlert({
      jwt: "signed-jwt",
      deviceToken: TOKEN,
      title: "New message",
      body: "Meet me at the studio",
      url: "/notifications",
      notificationType: "message",
      data: { conversation_id: "chat-1" },
      fetchImpl,
    });

    assert.equal(result.ok, true);
    assert.equal(result.drop, false);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, `${APNS_PRODUCTION_HOST}/3/device/${TOKEN}`);
    const headers = calls[0].init.headers as Record<string, string>;
    assert.equal(headers.authorization, "bearer signed-jwt");
    assert.equal(headers["apns-topic"], IOS_APP_TOPIC);
    assert.equal(headers["apns-push-type"], "alert");
    assert.equal(headers["apns-priority"], "10");
    const payload = JSON.parse(String(calls[0].init.body));
    assert.deepEqual(payload, buildApnsAlertPayload({
      title: "New message",
      body: "Meet me at the studio",
      url: "/notifications",
      notificationType: "message",
      data: { conversation_id: "chat-1" },
    }));
    assert.equal(payload.aps.alert.title, "New message");
    assert.equal(payload.aps.alert.body, "Meet me at the studio");
    assert.equal(payload.aps.sound, "default");
    assert.equal(payload.url, "/messages?chat=chat-1");
    assert.equal(payload.type, "message");
    assert.equal(payload.conversation_id, "chat-1");
    assert.equal(JSON.stringify(payload).includes(TOKEN), false);
    assert.equal(JSON.stringify(payload).includes("signed-jwt"), false);
  });

  it("keeps a caller url when the type has no deeper path", () => {
    const payload = buildApnsAlertPayload({
      title: "Hello",
      body: "",
      url: "/calendar",
      notificationType: "general",
    });
    assert.equal(payload.url, "/calendar");
    assert.equal(payload.aps.alert.body, "");
  });
});

describe("APNs token removal", () => {
  it("drops a subscription when Apple answers 410", async () => {
    const { fetchImpl } = fakeFetch(410, JSON.stringify({ reason: "Unregistered", timestamp: 1 }));
    const result = await sendApnsAlert({
      jwt: "signed-jwt",
      deviceToken: TOKEN,
      title: "Hello",
      body: "There",
      fetchImpl,
    });
    assert.equal(result.status, 410);
    assert.equal(result.reason, "Unregistered");
    assert.equal(result.drop, true);
    assert.equal(apnsTokenShouldDrop(410, ""), true);
  });

  it("drops BadDeviceToken and Unregistered and keeps other failures", () => {
    assert.equal(apnsTokenShouldDrop(400, JSON.stringify({ reason: "BadDeviceToken" })), true);
    assert.equal(apnsTokenShouldDrop(400, JSON.stringify({ reason: "Unregistered" })), true);
    assert.equal(apnsTokenShouldDrop(400, JSON.stringify({ reason: "BadTopic" })), false);
    assert.equal(apnsTokenShouldDrop(403, "not-json"), false);
    assert.equal(apnsTokenShouldDrop(200, ""), false);
  });

  it("treats a non-hex apns endpoint as invalid and leaves web rows alone", () => {
    assert.deepEqual(classifyPushSubscription("apns", "apns:not a token"), { channel: "apns", action: "drop" });
    assert.deepEqual(classifyPushSubscription("apns", `apns:${TOKEN}`), {
      channel: "apns",
      action: "send",
      token: TOKEN,
    });
    assert.deepEqual(classifyPushSubscription("web", "https://push.example/sub"), { channel: "web", action: "send" });
    assert.deepEqual(classifyPushSubscription("web", "mailto:someone"), { channel: "web", action: "skip" });
  });
});
