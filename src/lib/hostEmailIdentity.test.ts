import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  HOST_EVENT_FROM_ADDRESS,
  PLATFORM_FALLBACK_REPLY_TO,
  PLATFORM_QUEUE_FROM,
  hostFromHeader,
  isVerifiedSender,
} from "../../supabase/functions/_shared/host-email-address.mjs";
import { DEFAULT_EMAIL_FROM, resolveQueueFrom } from "../../supabase/functions/_shared/email-queue-dispatch.mjs";

describe("host email sender", () => {
  it("sends event mail from the verified domain and keeps the host display name", () => {
    assert.equal(HOST_EVENT_FROM_ADDRESS, "events@etherbylcove.com");
    assert.equal(PLATFORM_QUEUE_FROM, "notifications@etherbylcove.com");
    assert.equal(DEFAULT_EMAIL_FROM, PLATFORM_QUEUE_FROM);
    assert.equal(
      hostFromHeader('Ada "Lane"\r\nvia Ether'),
      "Ada Lane via Ether <events@etherbylcove.com>",
    );
    assert.equal(isVerifiedSender(hostFromHeader("Ada via Ether")), true);
    assert.equal(HOST_EVENT_FROM_ADDRESS.endsWith("@etherbylcove.com"), true);
    assert.equal(HOST_EVENT_FROM_ADDRESS.includes("notifications.etherbylcove.com"), false);
  });

  it("keeps the reply-to fallback and rewrites a queued notifications-subdomain sender", () => {
    assert.equal(PLATFORM_FALLBACK_REPLY_TO, "support@notify.etherbylcove.com");
    assert.equal(
      resolveQueueFrom(
        "notifications@notifications.etherbylcove.com",
        "Ada via Ether <events@notifications.etherbylcove.com>",
      ),
      "Ada via Ether <events@etherbylcove.com>",
    );
    assert.equal(
      resolveQueueFrom(DEFAULT_EMAIL_FROM, "Ether <notifications@etherbylcove.com>"),
      "Ether <notifications@etherbylcove.com>",
    );
    assert.equal(
      resolveQueueFrom("notifications@notifications.etherbylcove.com", "Evil <notifications@evil.example>"),
      "notifications@etherbylcove.com",
    );
  });
});
