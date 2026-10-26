import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { isKnownPath, isPublicPath } from "./appRoutes.ts";
import { toneForPath } from "./screenTone.ts";
import {
  birthdayError,
  birthdayFace,
  cardInitials,
  cardKicker,
  cardNameLines,
  isPublicVerifyCard,
  memberOfError,
  memberOfFace,
  memberSinceShort,
  memberStatus,
  normalizePassionTitle,
  passionTitleError,
  reviewsFace,
  usernameAt,
  usernameError,
  verifyUrl,
  walletButtonVisible,
} from "./etherId.ts";

const migration = readFileSync(
  new URL("../../supabase/migrations/20261024190000_ether_id.sql", import.meta.url),
  "utf8",
);
const memberOfMigration = readFileSync(
  new URL("../../supabase/migrations/20261025120000_profile_member_of.sql", import.meta.url),
  "utf8",
);
const passionTitleMigration = readFileSync(
  new URL("../../supabase/migrations/20261026120000_profile_passion_title.sql", import.meta.url),
  "utf8",
);
const etherIdFace = readFileSync(
  new URL("../components/profile/EtherIdFace.tsx", import.meta.url),
  "utf8",
);

describe("member status", () => {
  const now = new Date("2026-10-24T12:00:00.000Z");

  it("lets a ban win over a suspension and recent activity", () => {
    assert.equal(memberStatus({
      accessStatus: "banned",
      isSuspended: true,
      onboardingCompleted: true,
      lastActiveAt: now.toISOString(),
      now,
    }), "Banned");
  });

  it("lets an admin suspension win over an active account", () => {
    assert.equal(memberStatus({
      accessStatus: "active",
      isSuspended: true,
      onboardingCompleted: true,
      lastActiveAt: now.toISOString(),
      now,
    }), "Suspended");
  });

  it("is active only for a finished account seen in the last 30 days", () => {
    assert.equal(memberStatus({
      accessStatus: "active",
      isSuspended: false,
      onboardingCompleted: true,
      lastActiveAt: "2026-10-01T12:00:00.000Z",
      now,
    }), "Active");
    assert.equal(memberStatus({
      accessStatus: "active",
      isSuspended: false,
      onboardingCompleted: true,
      lastActiveAt: "2026-09-01T12:00:00.000Z",
      now,
    }), "Inactive");
    assert.equal(memberStatus({
      accessStatus: "pending",
      isSuspended: false,
      onboardingCompleted: false,
      lastActiveAt: now.toISOString(),
      now,
    }), "Inactive");
  });
});

describe("birthday", () => {
  it("shows month and day with the self-reported label and hides it otherwise", () => {
    assert.deepEqual(birthdayFace({ birthday_label: "March 4", birthday_note: "self-reported" }), {
      label: "March 4",
      note: "self-reported",
    });
    assert.equal(birthdayFace({ birthday_label: null, birthday_note: null }), null);
    assert.equal(birthdayFace({ birthday_label: "March 4", birthday_note: "self-reported" })?.label.includes("2024"), false);
  });

  it("rejects an impossible day and a half-filled date", () => {
    assert.equal(birthdayError(2, 31), "That is not a real month and day.");
    assert.equal(birthdayError(3, null), "Choose a month and a day.");
    assert.equal(birthdayError(2, 29), null);
    assert.equal(birthdayError(null, null), null);
  });
});

describe("passion title", () => {
  it("trims a typed title and rejects more than 24 characters", () => {
    assert.equal(normalizePassionTitle("  Filmmaker  "), "Filmmaker");
    assert.equal(normalizePassionTitle("   "), null);
    assert.equal(normalizePassionTitle(null), null);
    assert.equal(passionTitleError(""), null);
    assert.equal(passionTitleError("x".repeat(24)), null);
    assert.equal(passionTitleError(`  ${"x".repeat(24)}  `), null);
    assert.equal(passionTitleError("x".repeat(25)), "Passion is 24 characters or fewer.");
  });

  it("stores the title on the profile and does not fall back to a role or user passion", () => {
    assert.match(passionTitleMigration, /ADD COLUMN IF NOT EXISTS passion_title text/);
    assert.match(passionTitleMigration, /char_length\(passion_title\) <= 24/);
    assert.match(passionTitleMigration, /passion title is 24 characters or fewer/);
    assert.match(passionTitleMigration, /NULLIF\(btrim\(passion_title\), ''\)/);
    assert.doesNotMatch(passionTitleMigration, /user_passions/);
    assert.doesNotMatch(etherIdFace, /ether-id-handle/);
    assert.doesNotMatch(etherIdFace, /Designer/);
    assert.match(etherIdFace, /Add your passion/);
  });
});

describe("username and verify url", () => {
  it("formats a handle and refuses a raw-looking short name", () => {
    assert.equal(usernameAt("maya"), "@maya");
    assert.equal(usernameAt(null), null);
    assert.equal(usernameError("ab"), "Use 3 to 20 letters, numbers, or underscores.");
    assert.equal(usernameError("@Maya"), null);
  });

  it("builds a verify link that is not the user id", () => {
    const url = verifyUrl("https://etherbylcove.com/", "/id/v/eid1.abc.1.sig");
    assert.equal(url, "https://etherbylcove.com/id/v/eid1.abc.1.sig");
    assert.equal(url.includes("11111111-1111-4111-8111-111111111111"), false);
  });
});

describe("member of", () => {
  it("prints LCOVE when the field is empty and rejects more than 24 characters", () => {
    assert.equal(memberOfFace(""), "LCOVE");
    assert.equal(memberOfFace("   "), "LCOVE");
    assert.equal(memberOfFace(null), "LCOVE");
    assert.equal(memberOfFace(undefined), "LCOVE");
    assert.equal(memberOfFace("  North Hall  "), "North Hall");
    assert.equal(memberOfError(""), null);
    assert.equal(memberOfError("x".repeat(24)), null);
    assert.equal(memberOfError(`  ${"x".repeat(24)}  `), null);
    assert.equal(memberOfError("x".repeat(25)), "Member of is 24 characters or fewer.");
    assert.equal(memberOfError(` ${"y".repeat(25)} `), "Member of is 24 characters or fewer.");
  });

  it("stores a length check and an impersonation report reason", () => {
    assert.match(memberOfMigration, /ADD COLUMN IF NOT EXISTS member_of text/);
    assert.match(memberOfMigration, /char_length\(member_of\) <= 24/);
    assert.match(memberOfMigration, /member of is 24 characters or fewer/);
    assert.match(memberOfMigration, /'Impersonation'/);
    assert.match(memberOfMigration, /'member_of', v_member_of/);
    assert.match(memberOfMigration, /'city', v_city/);
  });
});

describe("card face", () => {
  it("formats the approved card from member fields", () => {
    assert.deepEqual(cardNameLines("Cadre Wallace"), ["Wallace", "Cadre"]);
    assert.equal(cardInitials("Cadre Wallace"), "CW");
    assert.equal(cardInitials("Cadre"), "C");
    assert.equal(cardInitials("  "), "E");
    assert.equal(cardKicker("Creative Director", "Los Angeles"), "— Creative · Los Angeles");
    assert.equal(memberSinceShort("2026-10-01", "October 2026"), "Oct 2026");
    assert.equal(reviewsFace(4.5, 2), "4.5 · 2");
    assert.equal(reviewsFace(null, 0), "—");
  });
});

describe("wallet button", () => {
  it("stays hidden until the pass reports that the secrets are present", () => {
    assert.equal(walletButtonVisible(undefined), false);
    assert.equal(walletButtonVisible(false), false);
    assert.equal(walletButtonVisible(true), true);
  });
});

describe("routes", () => {
  it("keeps the card signed in and the verify page public", () => {
    assert.equal(isKnownPath("/id"), true);
    assert.equal(isPublicPath("/id"), false);
    assert.equal(isKnownPath("/id/v/eid1.abc.1.sig"), true);
    assert.equal(isPublicPath("/id/v/eid1.abc.1.sig"), true);
    assert.equal(toneForPath("/id"), "pink");
    assert.equal(toneForPath("/id/v/eid1.abc.1.sig"), "pink");
  });
});

describe("verify payload", () => {
  it("rejects a card that includes birthday or the user id", () => {
    assert.equal(isPublicVerifyCard({
      display_name: "Maya",
      username: "maya",
      avatar_url: null,
      status: "Active",
      member_since: "2026-10-01",
      member_since_label: "October 2026",
    }), true);
    assert.equal(isPublicVerifyCard({ display_name: "Maya", user_id: "secret", birthday_label: "March 4" }), false);
  });
});

describe("ether id migration inventory", () => {
  it("counts user_reviews and completed projects, and keeps birth year off the card", () => {
    assert.match(migration, /FROM public\.user_reviews/);
    assert.doesNotMatch(migration, /studio_reviews/);
    assert.match(migration, /p\.status = 'completed'/);
    assert.match(migration, /pa\.status = 'accepted'/);
    assert.match(migration, /interval '30 days'/);
    assert.match(migration, /WHEN p_access_status = 'banned' THEN 'Banned'/);
    assert.match(migration, /birth_year is unrelated/);
    assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.get_ether_id_by_token\(text\) TO anon, authenticated, service_role/);
    assert.match(migration, /REVOKE ALL ON TABLE public\.ether_id_secret FROM PUBLIC, anon, authenticated/);
    assert.match(migration, /SET search_path = public, extensions, pg_temp/);
    const calls = migration.match(/\b(?:gen_random_bytes|crypt|gen_salt|digest|hmac)\s*\(/g) ?? [];
    const qualified = migration.match(/\b(?:extensions|public)\.(?:gen_random_bytes|crypt|gen_salt|digest|hmac)\s*\(/g) ?? [];
    assert.ok(calls.length > 0);
    assert.equal(calls.length, qualified.length);
  });
});
