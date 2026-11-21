// Who may attach a verified reply-to to an event, and how often a code may be sent.
// The host is the event creator. An organizer is an owner or admin of the event's
// organization, and only when the event belongs to one.

export const HOST_VERIFY_HOURLY_LIMIT = 3;
export const HOST_VERIFY_WINDOW_MS = 60 * 60 * 1000;

const ORGANIZER_ROLES = new Set(["owner", "admin"]);

export function callerMaySetEventReplyTo({ callerId, creatorId, organizationId, organizerRole }) {
  if (!callerId || !creatorId) return false;
  if (callerId === creatorId) return true;
  if (!organizationId) return false;
  return ORGANIZER_ROLES.has(organizerRole);
}

export function verificationSendLimited(userAttempts, addressAttempts, limit = HOST_VERIFY_HOURLY_LIMIT) {
  const userCount = Number(userAttempts) || 0;
  const addressCount = Number(addressAttempts) || 0;
  return userCount >= limit || addressCount >= limit;
}
