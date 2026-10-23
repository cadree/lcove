import assert from "node:assert/strict";
import test from "node:test";
import {
  attendanceLabel,
  attendanceSummary,
  calendarSubscribeLinks,
  campaignPerformance,
  decideRsvpStatus,
  icsUtcStamp,
  parseGuestRsvp,
  recentCampaignLabel,
  safeTrackDestination,
} from "./eventGuests.ts";

test("a full event waitlists a new RSVP and keeps the people already in", () => {
  assert.equal(decideRsvpStatus({
    requested: "going",
    capacity: 1,
    seatsTakenExcludingSelf: 1,
    alreadyGoing: false,
    ticketPurchased: false,
  }), "waitlist");
  assert.equal(decideRsvpStatus({
    requested: "going",
    capacity: 1,
    seatsTakenExcludingSelf: 2,
    alreadyGoing: true,
    ticketPurchased: false,
  }), "going");
  assert.equal(decideRsvpStatus({
    requested: "going",
    capacity: 1,
    seatsTakenExcludingSelf: 1,
    alreadyGoing: false,
    ticketPurchased: true,
  }), "going");
  assert.equal(decideRsvpStatus({
    requested: "going",
    capacity: null,
    seatsTakenExcludingSelf: 9,
    alreadyGoing: false,
    ticketPurchased: false,
  }), "going");
});

test("sold out copy never shows a negative spot count", () => {
  assert.equal(attendanceLabel(1, 2), "2 attending · capacity 1 · sold out");
  assert.equal(attendanceLabel(1, 1), "1 attending · sold out");
  assert.equal(attendanceLabel(10, 2), "2 attending · 8 spots left");
  assert.equal(attendanceLabel(null, 2), "2 attending");
  assert.equal(attendanceSummary(1, 2).spotsLeft, 0);
  assert.equal(attendanceSummary(1, 2).overCapacity, true);
});

test("guest RSVP accepts the old id and the new status payload", () => {
  assert.deepEqual(parseGuestRsvp("abc"), { id: "abc", status: "going" });
  assert.deepEqual(parseGuestRsvp({ id: "abc", status: "waitlist" }), { id: "abc", status: "waitlist" });
  assert.deepEqual(parseGuestRsvp({ id: "abc", status: "going" }), { id: "abc", status: "going" });
  assert.equal(parseGuestRsvp(null).id, null);
});

test("campaign numbers say when a measurement does not exist", () => {
  const hidden = campaignPerformance({
    people: 2,
    sent: 6,
    email_sent: 2,
    opened: 0,
    clicked: 0,
    opens_tracked: false,
    clicks_tracked: false,
    delivery_tracked: false,
    rsvped: 0,
    by_channel: { in_app: 2, push: 2, email: 2 },
  });
  assert.equal(hidden.opened, "Not tracked");
  assert.equal(hidden.clicked, "Not tracked");
  assert.equal(hidden.delivered, "Not tracked");
  assert.equal(hidden.people, 2);
  assert.equal(hidden.channelLine, "2 in-app, 2 push, 2 email");
  assert.equal(recentCampaignLabel(2, 4), "2 people · 4 channel sends");

  const tracked = campaignPerformance({ opens_tracked: true, opened: 0, clicks_tracked: true, clicked: 1 });
  assert.equal(tracked.opened, "0");
  assert.equal(tracked.clicked, "1");
});

test("calendar subscribe links stay on the feed url", () => {
  const links = calendarSubscribeLinks("https://example.supabase.co/functions/v1/host-calendar-feed?token=abc");
  assert.equal(links.apple, "webcal://example.supabase.co/functions/v1/host-calendar-feed?token=abc");
  assert.ok(links.google.startsWith("https://calendar.google.com/calendar/render?cid="));
  assert.ok(decodeURIComponent(links.google).includes(links.feed));
  assert.ok(links.outlook.includes(encodeURIComponent(links.feed)));
  assert.equal(icsUtcStamp("2026-11-02T18:30:00.000Z"), "20261102T183000Z");
});

test("click tracking only redirects to Ether", () => {
  assert.equal(
    safeTrackDestination("https://etherbylcove.com/event/1", "https://etherbylcove.com"),
    "https://etherbylcove.com/event/1",
  );
  assert.equal(
    safeTrackDestination("https://evil.example/phish", "https://etherbylcove.com"),
    "https://etherbylcove.com",
  );
});
