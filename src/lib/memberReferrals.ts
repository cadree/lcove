/** Member introductions are separate from project-performance vouches.
 * These are links for applying, never tokens that grant membership. */
export const MEMBER_REFERRAL_META_KEY = "ether_referral_code";
export const ETHER_JOIN_ORIGIN = "https://etherbylcove.com";

export function normalizedMemberReferralCode(input: string | null | undefined): string {
  const code = (input || "").trim().toLowerCase();
  return /^[a-f0-9]{32}$/.test(code) ? code : "";
}

export function memberInviteUrl(code: string): string {
  const valid = normalizedMemberReferralCode(code);
  return valid ? `${ETHER_JOIN_ORIGIN}/auth?tab=join&ref=${encodeURIComponent(valid)}` : "";
}

export type MemberReferralPreview = {
  name: string;
  kind: "vouch" | "referral";
};
