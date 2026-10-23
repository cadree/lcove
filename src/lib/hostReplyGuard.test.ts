import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  HOST_VERIFY_HOURLY_LIMIT,
  callerMaySetEventReplyTo,
  verificationSendLimited,
} from "../../supabase/functions/_shared/host-reply-guard.mjs";

const host = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const org = "33333333-3333-4333-8333-333333333333";

describe("event reply-to guard", () => {
  it("allows the host, and an organizer only when the event has an organization", () => {
    assert.equal(callerMaySetEventReplyTo({
      callerId: host,
      creatorId: host,
      organizationId: null,
      organizerRole: null,
    }), true);
    assert.equal(callerMaySetEventReplyTo({
      callerId: other,
      creatorId: host,
      organizationId: null,
      organizerRole: null,
    }), false);
    assert.equal(callerMaySetEventReplyTo({
      callerId: other,
      creatorId: host,
      organizationId: org,
      organizerRole: "member",
    }), false);
    assert.equal(callerMaySetEventReplyTo({
      callerId: other,
      creatorId: host,
      organizationId: org,
      organizerRole: "admin",
    }), true);
    assert.equal(callerMaySetEventReplyTo({
      callerId: other,
      creatorId: host,
      organizationId: null,
      organizerRole: "owner",
    }), false);
  });

  it("refuses the fourth verification send in an hour for the user or the address", () => {
    assert.equal(HOST_VERIFY_HOURLY_LIMIT, 3);
    assert.equal(verificationSendLimited(2, 2), false);
    assert.equal(verificationSendLimited(3, 0), true);
    assert.equal(verificationSendLimited(0, 3), true);
    assert.equal(verificationSendLimited(1, 4), true);
  });
});
