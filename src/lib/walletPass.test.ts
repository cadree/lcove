import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { issueWalletPass, resolveWalletTicket } from "../../supabase/functions/_shared/wallet-pass.mjs";

const owner = "11111111-1111-4111-8111-111111111111";
const stranger = "22222222-2222-4222-8222-222222222222";
const friend = "33333333-3333-4333-8333-333333333333";
const host = "99999999-9999-4999-8999-999999999999";
const eventId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ticketId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const otherTicketId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const orderId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const otherOrderId = "abababab-abab-4aba-8aba-abababababab";
const rsvpId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const strangerRsvpId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const rsvpTicketId = "12121212-1212-4121-8121-121212121212";
const storedQr = "db-qr-maya-9f3a2c1b";
const rsvpQr = "db-qr-rsvp-only-77";

const event = {
  id: eventId,
  title: "Night Market",
  start_date: "2026-11-02T01:00:00.000Z",
  timezone: "America/Los_Angeles",
  venue: "The Hall",
  address: "1 Main St",
  city: "Los Angeles",
  hide_address: false,
  creator_id: host,
};

const order = {
  id: orderId,
  event_id: eventId,
  purchaser_user_id: owner,
  payment_status: "paid",
  payment_method: "stripe",
};

const ownTicket = {
  id: ticketId,
  event_id: eventId,
  order_id: orderId,
  rsvp_id: rsvpId,
  attendee_user_id: owner,
  attendee_name: "Maya Torres",
  status: "registered",
  qr_code: storedQr,
  ticket_number: "20261101-abcd1234",
  created_at: "2026-10-01T00:00:00.000Z",
};

const otherTicket = {
  id: otherTicketId,
  event_id: eventId,
  order_id: otherOrderId,
  rsvp_id: strangerRsvpId,
  attendee_user_id: stranger,
  attendee_name: "Someone Else",
  status: "registered",
  qr_code: "db-qr-someone-else",
  ticket_number: "20261101-eeeeeeee",
  created_at: "2026-10-01T00:00:00.000Z",
};

const otherOrder = {
  id: otherOrderId,
  event_id: eventId,
  purchaser_user_id: stranger,
  payment_status: "paid",
  payment_method: "stripe",
};

const ownerRsvp = { id: rsvpId, event_id: eventId, user_id: owner, status: "going" };
const strangerRsvp = { id: strangerRsvpId, event_id: eventId, user_id: stranger, status: "going" };

const rsvpTicket = {
  id: rsvpTicketId,
  event_id: eventId,
  order_id: null,
  rsvp_id: rsvpId,
  attendee_user_id: null,
  attendee_name: "Maya Torres",
  status: "registered",
  qr_code: rsvpQr,
  ticket_number: "20261101-rsvp0001",
  created_at: "2026-10-02T00:00:00.000Z",
};

const rows = {
  attendees: [ownTicket, otherTicket, rsvpTicket],
  orders: [order, otherOrder],
  rsvps: [ownerRsvp, strangerRsvp],
  events: [event],
  hosts: [{ user_id: host, display_name: "Ada Chen" }],
};

const forged = {
  eventId,
  eventTitle: "Stolen Gala",
  venue: "Nowhere",
  guestName: "Thief",
  hostName: "Hacker",
  qrCode: "forged-qr-not-a-ticket",
};

function certs() {
  const dir = mkdtempSync(join(tmpdir(), "ether-wallet-"));
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-keyout", "wwdr.key", "-out", "wwdr.pem", "-days", "2", "-nodes", "-subj", "/CN=Test WWDR"], { cwd: dir });
  execFileSync("openssl", ["req", "-newkey", "rsa:2048", "-keyout", "pass.key", "-out", "pass.csr", "-nodes", "-subj", "/CN=Ether Event"], { cwd: dir });
  execFileSync("openssl", ["x509", "-req", "-in", "pass.csr", "-CA", "wwdr.pem", "-CAkey", "wwdr.key", "-CAcreateserial", "-out", "pass.crt", "-days", "2"], { cwd: dir });
  return {
    dir,
    certs: {
      certPem: readFileSync(join(dir, "pass.crt"), "utf8"),
      keyPem: readFileSync(join(dir, "pass.key"), "utf8"),
      wwdrPem: readFileSync(join(dir, "wwdr.pem"), "utf8"),
    },
  };
}

async function requestPass(callerId: string, body: Record<string, unknown>, ticketRows = rows, signing?: { dir: string; certs: { certPem: string; keyPem: string; wwdrPem: string } }) {
  return issueWalletPass({
    callerId,
    body,
    rows: ticketRows,
    configured: true,
    certs: signing?.certs,
    passTypeIdentifier: "pass.com.ether.event",
    teamIdentifier: "TEAM123456",
  });
}

function readSignedPass(dir: string, bytes: Uint8Array) {
  writeFileSync(join(dir, "ticket.pkpass"), bytes);
  execFileSync("unzip", ["-t", "ticket.pkpass"], { cwd: dir });
  execFileSync("unzip", ["-o", "ticket.pkpass", "-d", "unpacked"], { cwd: dir });
  const verified = execFileSync("openssl", [
    "cms", "-verify", "-binary", "-inform", "DER",
    "-in", "unpacked/signature",
    "-content", "unpacked/manifest.json",
    "-CAfile", "wwdr.pem",
    "-purpose", "any",
  ], { cwd: dir });
  assert.ok(verified.length > 0);
  return JSON.parse(readFileSync(join(dir, "unpacked/pass.json"), "utf8"));
}

describe("wallet pass ownership", () => {
  it("rejects a member who asks for someone else's ticket", async () => {
    const denied = await requestPass(stranger, { ticketId, ...forged });
    assert.equal(denied.status, 403);
    assert.equal(denied.body.error, "You don't own this ticket");
    assert.equal(denied.body.pkpass, undefined);
    assert.equal("bytes" in denied, false);

    const byOrder = await requestPass(stranger, { orderId, ...forged });
    assert.equal(byOrder.status, 403);
    assert.equal(byOrder.body.pkpass, undefined);

    const sameEventRsvp = resolveWalletTicket({
      callerId: stranger,
      ticketId,
      orderId: null,
      rows,
    });
    assert.equal(sameEventRsvp.ok, false);

    const hostDenied = await requestPass(host, { ticketId });
    assert.equal(hostDenied.status, 403);
    assert.equal(hostDenied.body.pkpass, undefined);

    const hidden = resolveWalletTicket({
      callerId: owner,
      ticketId,
      orderId: null,
      rows: {
        ...rows,
        events: [{ ...event, hide_address: true, address: "should-not-appear", private_address: "9 Secret St" }],
      },
    });
    assert.equal(hidden.ok, true);
    assert.equal(hidden.venue, "The Hall, 9 Secret St, Los Angeles");
    assert.equal(hidden.venue.includes("should-not-appear"), false);
  });

  it("signs a pass for the owner from the database ticket, not the request", async () => {
    const signing = certs();
    try {
      const issued = await requestPass(owner, { ticketId, ...forged }, rows, signing);
      assert.equal(issued.status, 200);
      assert.equal(issued.body.configured, true);
      assert.equal(issued.body.filename, "Night-Market.pkpass");
      assert.equal(typeof issued.body.pkpass, "string");
      const pass = readSignedPass(signing.dir, issued.bytes);
      const packed = JSON.stringify(pass);
      assert.equal(pass.barcode.message, storedQr);
      assert.equal(pass.barcodes[0].message, storedQr);
      assert.equal(pass.serialNumber, ticketId);
      assert.equal(pass.description, "Night Market");
      assert.equal(pass.eventTicket.primaryFields[0].value, "Night Market");
      assert.equal(pass.eventTicket.primaryFields[0].label, "Ada Chen");
      assert.equal(pass.eventTicket.secondaryFields.find((field: { key: string }) => field.key === "guest").value, "Maya Torres");
      assert.equal(pass.eventTicket.secondaryFields.find((field: { key: string }) => field.key === "venue").value, "The Hall, 1 Main St, Los Angeles");
      assert.equal(pass.organizationName, "Ada Chen");
      assert.equal(packed.includes("forged-qr-not-a-ticket"), false);
      assert.equal(packed.includes("Stolen Gala"), false);
      assert.equal(packed.includes("Nowhere"), false);
      assert.equal(packed.includes("Thief"), false);
      assert.equal(packed.includes("Hacker"), false);
      assert.equal(packed.includes(eventId), false);

      const byOrder = await requestPass(owner, { orderId, ...forged }, rows, signing);
      assert.equal(byOrder.status, 200);
      const orderPass = readSignedPass(signing.dir, byOrder.bytes);
      assert.equal(orderPass.barcode.message, storedQr);
      assert.equal(orderPass.serialNumber, ticketId);
    } finally {
      rmSync(signing.dir, { recursive: true, force: true });
    }
  });

  it("lets the RSVP holder and the purchaser through, and blocks a pass that is not a live ticket", async () => {
    const signing = certs();
    try {
      const rsvpPass = await requestPass(owner, { ticketId: rsvpTicketId, qrCode: "forged-qr-not-a-ticket" }, rows, signing);
      assert.equal(rsvpPass.status, 200);
      const pass = readSignedPass(signing.dir, rsvpPass.bytes);
      assert.equal(pass.barcode.message, rsvpQr);
      assert.equal(JSON.stringify(pass).includes("forged-qr-not-a-ticket"), false);

      const gifted = {
        ...ownTicket,
        id: "45454545-4545-4454-8454-454545454545",
        attendee_user_id: friend,
        rsvp_id: null,
        qr_code: "db-qr-gift-for-friend",
      };
      const friendPass = await requestPass(friend, { ticketId: gifted.id }, {
        ...rows,
        attendees: [gifted],
      }, signing);
      assert.equal(friendPass.status, 200);
      assert.equal(readSignedPass(signing.dir, friendPass.bytes).barcode.message, "db-qr-gift-for-friend");

      const purchaserPass = await requestPass(owner, { orderId }, {
        ...rows,
        attendees: [gifted],
      }, signing);
      assert.equal(purchaserPass.status, 200);
      assert.equal(readSignedPass(signing.dir, purchaserPass.bytes).barcode.message, "db-qr-gift-for-friend");

      const unpaid = await requestPass(owner, { ticketId }, {
        ...rows,
        orders: [{ ...order, payment_status: "pending" }],
      });
      assert.equal(unpaid.status, 403);
      assert.equal(unpaid.body.pkpass, undefined);

      const cancelled = await requestPass(owner, { ticketId }, {
        ...rows,
        attendees: [{ ...ownTicket, status: "cancelled" }, otherTicket, rsvpTicket],
      });
      assert.equal(cancelled.status, 403);
      assert.equal(cancelled.body.pkpass, undefined);

      const invented = await requestPass(owner, forged);
      assert.equal(invented.status, 400);
      assert.equal(invented.body.pkpass, undefined);

      const anonymous = await requestPass("", { ticketId });
      assert.equal(anonymous.status, 401);
    } finally {
      rmSync(signing.dir, { recursive: true, force: true });
    }
  });

  it("keeps the function from reading a title or QR off the request", () => {
    const source = readFileSync(new URL("../../supabase/functions/generate-wallet-pass/index.ts", import.meta.url), "utf8");
    assert.equal(source.includes("body.qrCode"), false);
    assert.equal(source.includes("body.eventTitle"), false);
    assert.equal(source.includes("body.eventId"), false);
    assert.equal(source.includes("body.guestName"), false);
    assert.match(source, /issueWalletPass/);
    assert.match(source, /getBearerUser/);
  });
});
