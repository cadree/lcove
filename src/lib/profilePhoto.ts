/** A stored or previewed profile photo is present. */
export function hasProfilePhoto(avatarUrl: string | null | undefined): boolean {
  return Boolean(avatarUrl && avatarUrl.trim());
}

/**
 * New sign-ups must pick a photo before they can leave the name step or
 * finish onboarding. A photo already saved on the profile still counts.
 */
export function onboardingPhotoMissing(
  avatarFile: File | null | undefined,
  existingAvatarUrl?: string | null,
): boolean {
  return !avatarFile && !hasProfilePhoto(existingAvatarUrl);
}

/**
 * Active members who joined without a photo can keep using the app, but they
 * should see a prompt on Home and Profile until they add one.
 */
export function needsActiveMemberPhotoPrompt(profile: {
  access_status?: string | null;
  avatar_url?: string | null;
} | null | undefined): boolean {
  if (!profile) return false;
  if (profile.access_status !== "active") return false;
  return !hasProfilePhoto(profile.avatar_url);
}

export const ONBOARDING_PHOTO_TITLE = "Add a photo";
export const ONBOARDING_PHOTO_HINT =
  "People should be able to recognize you. Choose one from your camera or library.";
export const ONBOARDING_PHOTO_REQUIRED = "Add a photo to continue.";
export const ONBOARDING_PHOTO_SAVE_FAILED = "We couldn't save your photo. Try again, or pick a different one.";
export const MISSING_PHOTO_PROMPT = "Add a photo so people know who you are.";
export const MISSING_PHOTO_ACTION = "Add photo";
