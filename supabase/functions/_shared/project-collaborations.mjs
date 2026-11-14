// Edge-function copy of the alert and community-notify rules.
// src/lib/projectCollaborations.ts is the app copy. The unit test checks they match.

export const CHAT_EMAIL_WINDOW_MS = 15 * 60 * 1000;

export function shouldNotifyCommunity(input) {
  if (input.isPrivate || input.isCreator) return false;
  return input.categoryEnabled !== false;
}

export function chatAlertChannels(input) {
  if (input.isSender || input.messagesEnabled === false) {
    return { inApp: false, push: false, email: false };
  }
  if (input.isMuted) return { inApp: true, push: false, email: false };
  return {
    inApp: true,
    push: input.pushEnabled !== false,
    email: input.emailEnabled !== false,
  };
}
