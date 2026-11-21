import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  HOST_DISPLAY_NAME_MAX,
  HOST_EVENT_FROM_ADDRESS,
  PLATFORM_FALLBACK_REPLY_TO,
  PLATFORM_QUEUE_FROM,
  eventReplyTo,
  hostFromHeader,
  hostViaEtherName,
  isVerifiedSender,
  sanitizeDisplayName,
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
    assert.equal(
      sanitizeDisplayName('Ada <guest@example.com>, "Name";\r\n'),
      "Ada guest example.com Name",
    );
    assert.equal(sanitizeDisplayName("A".repeat(200)).length, HOST_DISPLAY_NAME_MAX);
    const spoofed = hostFromHeader('Ada <guest@example.com>, "Name";');
    assert.equal(spoofed, "Ada guest example.com Name <events@etherbylcove.com>");
    assert.equal((spoofed.match(/@/g) || []).length, 1);
    assert.equal(isVerifiedSender(hostFromHeader("Ada via Ether")), true);
    assert.equal(hostViaEtherName("Ada"), "Ada via Ether");
    assert.equal(hostViaEtherName("Ada via Ether"), "Ada via Ether");
    assert.equal(hostViaEtherName('Ada <guest@example.com>'), "Ada guest example.com via Ether");
    assert.equal(hostViaEtherName("A".repeat(200)).length, HOST_DISPLAY_NAME_MAX);
    assert.match(hostViaEtherName("A".repeat(200)), / via Ether$/);
    assert.equal(HOST_EVENT_FROM_ADDRESS.endsWith("@etherbylcove.com"), true);
    assert.equal(HOST_EVENT_FROM_ADDRESS.includes("notifications.etherbylcove.com"), false);
  });

  it("sends no reply-to until a host address is verified", () => {
    assert.equal(PLATFORM_FALLBACK_REPLY_TO, null);
    assert.equal(eventReplyTo(null), null);
    assert.equal(eventReplyTo(""), null);
    assert.equal(eventReplyTo("  host@example.com  "), "host@example.com");
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
