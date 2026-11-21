import { FIRST_RUN_PATH } from "./firstRun.ts";

export type AccessProfile = {
  onboarding_completed?: boolean | null;
  access_status?: string | null;
};

/** Where a signed-in person should be after the profile has loaded. */
export function accessPath(profile: AccessProfile, currentPath = ""): string {
  if (!profile.onboarding_completed) return "/onboarding";
  const status = profile.access_status || "pending";
  if (status === "banned") return "/locked";
  if (status === "denied") return "/denied";
  if (status === "active") {
    if (currentPath === "/pending" || currentPath === "/denied" || currentPath === "/locked") {
      return FIRST_RUN_PATH;
    }
    return currentPath || "/feed";
  }
  return "/pending";
}

export function isAwaitingVerification(profile: AccessProfile): boolean {
  return Boolean(profile.onboarding_completed) && (profile.access_status || "pending") === "pending";
}
