import assert from "node:assert/strict";
import test from "node:test";
import { applicantLinksError, normalizeApplicantLink } from "./applicantLinks.ts";

test("member application requires at least one public review link", () => {
  assert.match(applicantLinksError("", "") || "", /Add a public social profile/);
  assert.equal(applicantLinksError("instagram.com/ada", ""), null);
  assert.equal(applicantLinksError("", "https://portfolio.example.com/"), null);
  assert.equal(applicantLinksError("https://social.example.com/ada", "portfolio.example.com"), null);
});

test("applicant links use safe web URLs with no local host or credentials", () => {
  assert.equal(normalizeApplicantLink("instagram.com/ada"), "https://instagram.com/ada");
  assert.equal(normalizeApplicantLink("https://example.com/"), "https://example.com/");
  for (const bad of ["javascript:alert(1)", "data:text/html,hello", "http://localhost:8000",
    "https://user:secret@example.com", "https://127.0.0.1", "@username", "not a url"]) {
    assert.equal(normalizeApplicantLink(bad), null, bad);
  }
  assert.match(applicantLinksError("instagram.com/ada", "javascript:alert(1)") || "", /valid website/);
});
