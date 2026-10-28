import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  goingCountLabel,
  eventIsFree,
  generalAreaLabel,
  guestlistLine,
  publicTicketBadge,
  stickyCtaLabel,
  validateEventDraft,
} from "./guestEvent.ts";

const base = {
  title: "Listening night",
  start: "2026-11-01T19:00",
  end: "2026-11-01T22:00",
  venue: "The loft",
  summary: "",
  address: "",
  price: "20",
  capacity: "",
  mode: "tickets" as const,
};

describe("event draft validation", () => {
  it("requires an end after the start and a title and venue", () => {
    assert.deepEqual(validateEventDraft(base), {});
    const errors = validateEventDraft({ ...base, title: "  ", end: "2026-11-01T18:00", venue: "" });
    assert.equal(errors.title, "Add a title.");
    assert.equal(errors.end, "End must be after the start.");
    assert.equal(errors.venue, "Add a venue name.");
  });

  it("requires a price only when selling tickets", () => {
    assert.equal(validateEventDraft({ ...base, mode: "rsvp", price: "" }).price, undefined);
    assert.match(validateEventDraft({ ...base, price: "-1" }).price || "", /price/);
  });
});

describe("guest list copy", () => {
  it("names the first guest and the rest", () => {
    assert.equal(guestlistLine([], 0), "Be the first to go");
    assert.equal(guestlistLine(["Ada"], 1), "Ada is going");
    assert.equal(guestlistLine(["Ada", "Nico"], 4), "Ada and 3 others going");
    assert.equal(goingCountLabel(120), "99+ going");
    assert.equal(stickyCtaLabel(2091, false), "Buy tickets from $20.91");
    assert.equal(stickyCtaLabel(0, false), "RSVP");
    assert.equal(stickyCtaLabel(null, false), "Sold out");
  });
});

describe("public event labels", () => {
  it("shows the city and state and leaves the street off", () => {
    assert.equal(generalAreaLabel("Brooklyn", "NY"), "Brooklyn, NY");
    assert.equal(generalAreaLabel("TBA", "  "), null);
    assert.equal(generalAreaLabel(null, null), null);
  });

  it("badges a free event and a paid event from the lowest price", () => {
    assert.equal(eventIsFree("free", false), true);
    assert.equal(eventIsFree(null, false), true);
    assert.equal(eventIsFree("free", true), false);
    assert.equal(eventIsFree("paid", false), false);
    assert.equal(publicTicketBadge({ ticketType: "free", free: true, fromCents: null }), "Free Event");
    assert.equal(publicTicketBadge({ ticketType: "paid", free: false, fromCents: 2000 }), "Tickets from $20.00");
    assert.equal(publicTicketBadge({ ticketType: "credits", free: false, fromCents: null, creditsPrice: 12 }), "12 Credits");
  });
});
