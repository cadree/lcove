import assert from "node:assert/strict";
import test from "node:test";
import {
  applicantLinksError,
  applicantSocialLabel,
  applicantSocialUrl,
  normalizeApplicantLink,
  openExternalHttpUrl,
  onExternalHttpUrlClick,
} from "./applicantLinks.ts";

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

test("stored social handles and URLs become public https links", () => {
  assert.equal(applicantSocialUrl("instagram", "@ada"), "https://instagram.com/ada");
  assert.equal(applicantSocialUrl("instagram", "ada"), "https://instagram.com/ada");
  assert.equal(applicantSocialUrl("instagram", "ada.loves"), "https://instagram.com/ada.loves");
  assert.equal(applicantSocialUrl("instagram", "https://www.instagram.com/ada"), "https://www.instagram.com/ada");
  assert.equal(applicantSocialUrl("instagram", "instagram.com/ada"), "https://instagram.com/ada");
  assert.equal(applicantSocialUrl("tiktok", "ada"), "https://www.tiktok.com/@ada");
  assert.equal(applicantSocialUrl("tiktok", "@ada"), "https://www.tiktok.com/@ada");
  assert.equal(applicantSocialUrl("twitter", "@ada"), "https://x.com/ada");
  assert.equal(applicantSocialUrl("youtube", "@StudioName"), "https://www.youtube.com/@StudioName");
  assert.equal(applicantSocialUrl("linkedin", "ada-loves"), "https://www.linkedin.com/in/ada-loves");
  assert.equal(applicantSocialUrl("social_profile", "@ada"), "https://instagram.com/ada");
  assert.equal(applicantSocialUrl("social_profile", "https://tiktok.com/@ada"), "https://tiktok.com/@ada");
  assert.equal(applicantSocialUrl("website", "portfolio.example.com"), "https://portfolio.example.com/");
  assert.equal(applicantSocialUrl("website", "@ada"), null);
  assert.equal(applicantSocialUrl("instagram", "javascript:alert(1)"), null);
  assert.equal(applicantSocialUrl("instagram", "not a url"), null);
  assert.equal(applicantSocialUrl("instagram", ""), "");
  assert.equal(applicantSocialLabel("instagram"), "Instagram");
  assert.equal(applicantSocialLabel("social_profile"), "Social media");
  assert.equal(applicantSocialLabel("website"), "Website / portfolio");
});

test("openExternalHttpUrl only opens a safe http(s) tab", () => {
  const opened: string[] = [];
  const original = globalThis.window;
  (globalThis as { window: { open: typeof window.open } }).window = {
    open(url: string | URL, target?: string, features?: string) {
      opened.push(`${String(url)}|${target}|${features}`);
      return null;
    },
  };
  try {
    assert.equal(openExternalHttpUrl("https://instagram.com/ada"), true);
    assert.deepEqual(opened, ["https://instagram.com/ada|_blank|noopener,noreferrer"]);
    opened.length = 0;
    assert.equal(openExternalHttpUrl("javascript:alert(1)"), false);
    assert.deepEqual(opened, []);
    const event = { prevented: false, stopped: false, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; } };
    onExternalHttpUrlClick("https://www.tiktok.com/@ada", event);
    assert.equal(event.prevented, true);
    assert.equal(event.stopped, true);
    assert.equal(opened[0].startsWith("https://www.tiktok.com/@ada"), true);
  } finally {
    if (original) (globalThis as { window: typeof original }).window = original;
    else delete (globalThis as { window?: unknown }).window;
  }
});
