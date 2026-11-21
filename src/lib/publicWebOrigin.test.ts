import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PRODUCTION_WEB_ORIGIN, resolvePublicWebOrigin } from "./publicWebOrigin.mjs";

const PROD = { supabaseUrl: "https://aykopqinnnssxdhxqruo.supabase.co", projectId: "aykopqinnnssxdhxqruo" };
const STAGING_REF = "b".repeat(20);
const STAGING = { supabaseUrl: `https://${STAGING_REF}.supabase.co`, projectId: STAGING_REF };
const STAGING_WEB = "https://codex-pending-vouch-recovery.ether-staging.pages.dev";

describe("resolvePublicWebOrigin", () => {
  it("keeps production as the native default", () => {
    assert.equal(resolvePublicWebOrigin({ ...PROD, native: true }), PRODUCTION_WEB_ORIGIN);
    assert.equal(resolvePublicWebOrigin({ native: true }), PRODUCTION_WEB_ORIGIN);
  });
  it("uses the configured staging site for a staging native build", () => {
    assert.equal(resolvePublicWebOrigin({ ...STAGING, native: true, configured: `${STAGING_WEB}/` }), STAGING_WEB);
  });
  it("never gives a staging build a production link", () => {
    assert.equal(resolvePublicWebOrigin({ ...STAGING, native: true }), null);
    assert.equal(resolvePublicWebOrigin({ ...STAGING, native: true, configured: PRODUCTION_WEB_ORIGIN }), null);
    assert.equal(resolvePublicWebOrigin({ ...STAGING, native: false, configured: PRODUCTION_WEB_ORIGIN, currentOrigin: STAGING_WEB }), null);
  });
  it("never gives a production build a staging link", () => {
    assert.equal(resolvePublicWebOrigin({ ...PROD, native: true, configured: STAGING_WEB }), null);
  });
  it("rejects malformed or insecure origins", () => {
    assert.equal(resolvePublicWebOrigin({ ...STAGING, native: true, configured: "http://evil.example" }), null);
    assert.equal(resolvePublicWebOrigin({ ...STAGING, native: true, configured: "not a url" }), null);
  });
  it("uses the page origin on the web when nothing is configured", () => {
    assert.equal(resolvePublicWebOrigin({ ...STAGING, native: false, currentOrigin: STAGING_WEB }), STAGING_WEB);
  });
});
