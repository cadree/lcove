import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { guestRsvpErrorMessage } from "./guestRsvp.ts";

describe("guest RSVP errors", () => {
  it("turns database errors into short messages", () => {
    assert.equal(guestRsvpErrorMessage(new Error("already rsvped")), "You're already on the list for this event.");
    assert.equal(guestRsvpErrorMessage({ message: "limit reached" }), "Too many tries right now. Please wait and try again.");
    assert.equal(guestRsvpErrorMessage(new Error("tickets required")), "This event uses tickets. Pick one to continue.");
    assert.match(guestRsvpErrorMessage(new Error("something else")), /Could not save/);
  });
});
