import assert from "node:assert/strict";
import test from "node:test";
import {
  hasProfilePhoto,
  needsActiveMemberPhotoPrompt,
  onboardingPhotoMissing,
} from "./profilePhoto.ts";

test("a blank or missing avatar is not a profile photo", () => {
  assert.equal(hasProfilePhoto(null), false);
  assert.equal(hasProfilePhoto(undefined), false);
  assert.equal(hasProfilePhoto(""), false);
  assert.equal(hasProfilePhoto("   "), false);
  assert.equal(hasProfilePhoto("https://cdn.example/avatar.jpg"), true);
});

test("onboarding cannot continue without a chosen or saved photo", () => {
  assert.equal(onboardingPhotoMissing(null, null), true);
  assert.equal(onboardingPhotoMissing(undefined, ""), true);
  const file = { name: "me.jpg" } as File;
  assert.equal(onboardingPhotoMissing(file, null), false);
  assert.equal(onboardingPhotoMissing(null, "https://cdn.example/avatar.jpg"), false);
});

test("active members without a photo are prompted, not locked out", () => {
  assert.equal(needsActiveMemberPhotoPrompt(null), false);
  assert.equal(
    needsActiveMemberPhotoPrompt({ access_status: "pending", avatar_url: null }),
    false,
  );
  assert.equal(
    needsActiveMemberPhotoPrompt({ access_status: "active", avatar_url: null }),
    true,
  );
  assert.equal(
    needsActiveMemberPhotoPrompt({ access_status: "active", avatar_url: "https://cdn.example/a.jpg" }),
    false,
  );
  assert.equal(
    needsActiveMemberPhotoPrompt({ access_status: "denied", avatar_url: null }),
    false,
  );
});
