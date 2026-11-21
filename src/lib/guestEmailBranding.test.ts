import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const guestTemplates = [
  "supabase/functions/_shared/guest-event-email.mjs",
  "supabase/functions/_shared/host-event-email-template.ts",
  "supabase/functions/_shared/transactional-email-templates/event-invite.tsx",
  "supabase/functions/_shared/transactional-email-templates/event-reminder.tsx",
  "supabase/functions/_shared/transactional-email-templates/event-bulk-attendee-reminder.tsx",
];

describe("guest email host branding", () => {
  for (const file of guestTemplates) {
    it(`${file} keeps Ether as the footer`, () => {
      const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
      assert.match(source, /Powered by Ether/);
      assert.doesNotMatch(source, /ETHER by lcove/i);
      assert.doesNotMatch(source, /Sent via ETHER/);
    });
  }

  it("does not attach a reply-to until the host address is verified", () => {
    const senders = [
      "supabase/functions/send-rsvp-confirmation/index.ts",
      "supabase/functions/send-individual-reminder/index.ts",
    ];
    for (const file of senders) {
      const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
      assert.match(source, /if \(identity\.replyTo\)/);
      assert.match(source, /identity\.fromHeader/);
    }
  });

  it("attendee reminders lead with the host and keep Ether in the footer", () => {
    const source = readFileSync(
      new URL("../../supabase/migrations/20261024201000_attendee_event_reminders.sql", import.meta.url),
      "utf8",
    );
    assert.match(source, /Powered by Ether/);
    assert.match(source, /via Ether/);
    assert.match(source, /reply_to_verified_at/);
    assert.doesNotMatch(source, /ETHER by lcove/i);
    assert.doesNotMatch(source, /Sent via ETHER/);
  });
});
