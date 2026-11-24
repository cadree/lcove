import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createPushTapQueue, pushTapPath } from "./pushTapRoute.mjs";
import { buildApnsAlertPayload } from "../../supabase/functions/_shared/apns.mjs";

describe("pushTapPath", () => {
  it("reads the route the APNs sender puts in the payload", () => {
    const payload = buildApnsAlertPayload({ title: "t", body: "b", url: "/calendar", notificationType: "general" });
    assert.equal(pushTapPath(payload), "/calendar");
  });
  it("routes an application push to the admin review page", () => {
    const id = "ca586fc4-4382-4ac0-890b-fcfede957d85";
    const payload = buildApnsAlertPayload({
      title: "New ETHER membership application", body: "x", url: `/admin/onboarding/${id}`,
      data: { applicant_id: id }, notificationType: "member_application",
    });
    assert.equal(pushTapPath(payload), `/admin/onboarding/${id}`);
  });
  it("keeps the sender's type-specific routes", () => {
    const payload = buildApnsAlertPayload({ title: "t", body: "b", data: { conversation_id: "c1" }, notificationType: "message" });
    assert.equal(pushTapPath(payload), "/messages?chat=c1");
  });
  it("accepts nested data and Ether links, and refuses other sites", () => {
    assert.equal(pushTapPath({ data: { url: "/feed?post=1" } }), "/feed?post=1");
    assert.equal(pushTapPath({ link: "https://etherbylcove.com/calendar?event=2" }), "/calendar?event=2");
    assert.equal(pushTapPath({ url: "https://evil.example/x" }), "/notifications");
    assert.equal(pushTapPath({ url: "//evil.example/x" }), "/notifications");
  });
  it("falls back to notifications when there is no route", () => {
    assert.equal(pushTapPath({ aps: { alert: "hi" } }), "/notifications");
    assert.equal(pushTapPath(null), null);
  });
});

describe("createPushTapQueue", () => {
  it("holds a cold-start tap until the router attaches", () => {
    const q = createPushTapQueue();
    q.deliver("/calendar");
    const seen: string[] = [];
    q.attach((p) => seen.push(p));
    assert.deepEqual(seen, ["/calendar"]);
  });
  it("navigates immediately for background and foreground taps", () => {
    const q = createPushTapQueue();
    const seen: string[] = [];
    const detach = q.attach((p) => seen.push(p));
    q.deliver("/a");
    q.deliver("/b");
    assert.deepEqual(seen, ["/a", "/b"]);
    detach();
    q.deliver("/c");
    assert.deepEqual(seen, ["/a", "/b"]);
    q.attach((p) => seen.push(p));
    assert.deepEqual(seen, ["/a", "/b", "/c"]);
  });
});
