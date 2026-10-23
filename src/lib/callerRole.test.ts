import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { authorizeRsvpConfirmation, authorizeTransactionalEmail } from "../../supabase/functions/_shared/notification-auth.mjs";
import { credentialRole, namedKeyValues, resolveCallerRole } from "../../supabase/functions/_shared/caller-role.mjs";

const publishable = "sb_publishable_test_public_key";
const secret = "sb_secret_test_private_key";
const namedSecret = "sb_secret_test_billing_key";
const legacyAnon = jwt({ role: "anon" });
const legacyService = jwt({ role: "service_role" });
const userJwt = jwt({ role: "authenticated", sub: "11111111-1111-4111-8111-111111111111" });
const forgedService = jwt({ role: "service_role", iss: "forged" });

const keys = {
  secrets: [secret, namedSecret, legacyService],
  publishable: [publishable, legacyAnon],
};

function jwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.sig`;
}

describe("caller role", () => {
  it("reads named project keys from the platform JSON env", () => {
    assert.deepEqual(
      namedKeyValues(JSON.stringify({ default: secret, billing: namedSecret })),
      [secret, namedSecret],
    );
    assert.deepEqual(namedKeyValues("not-json"), []);
    assert.deepEqual(namedKeyValues(""), []);
  });

  it("treats a publishable key as anon and a secret key as service_role", () => {
    assert.equal(credentialRole(`Bearer ${publishable}`, keys), "anon");
    assert.equal(credentialRole(secret, keys), "service_role");
    assert.equal(credentialRole(namedSecret, keys), "service_role");
    assert.equal(credentialRole(legacyAnon, keys), "anon");
    assert.equal(credentialRole(`Bearer ${legacyService}`, keys), "service_role");
  });

  it("keeps a signed-in user authenticated when apikey is the publishable key", () => {
    assert.equal(resolveCallerRole(`Bearer ${userJwt}`, publishable, keys), "authenticated");
  });

  it("accepts the new keys from the apikey header when Authorization is empty", () => {
    assert.equal(resolveCallerRole(null, publishable, keys), "anon");
    assert.equal(resolveCallerRole("", secret, keys), "service_role");
  });

  it("does not grant service_role to a guessed secret or an empty caller", () => {
    assert.equal(credentialRole("sb_secret_guessed", keys), null);
    assert.equal(credentialRole("sb_publishable_guessed", keys), null);
    assert.equal(resolveCallerRole(null, null, keys), null);
    assert.equal(resolveCallerRole("Bearer ", "Bearer ", keys), null);
    // Signature checks happen at the gateway. A service_role claim is the legacy JWT.
    assert.equal(credentialRole(forgedService, keys), "service_role");
  });

  it("lets a guest publishable key confirm an RSVP and blocks it from arbitrary mail", () => {
    const role = resolveCallerRole(null, publishable, keys);
    const guest = authorizeRsvpConfirmation({
      callerId: null,
      role,
      eventId: "99999999-9999-4999-8999-999999999999",
      rsvpId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      rsvp: { event_id: "99999999-9999-4999-8999-999999999999", user_id: null },
      eventCreatorId: "22222222-2222-4222-8222-222222222222",
    });
    assert.equal(guest.ok, true);
    assert.equal(authorizeTransactionalEmail({ role }).status, 401);
    assert.equal(authorizeTransactionalEmail({ role: null }).status, 401);
    assert.equal(authorizeTransactionalEmail({ role: "authenticated" }).status, 401);
    assert.equal(authorizeTransactionalEmail({ role: resolveCallerRole(`Bearer ${secret}`, null, keys) }).ok, true);
    assert.equal(authorizeTransactionalEmail({ role: resolveCallerRole(`Bearer ${legacyService}`, null, keys) }).ok, true);
  });
});
