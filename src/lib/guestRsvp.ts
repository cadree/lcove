const RSVP_KEY = (eventId: string) => `ether-guest-rsvp:${eventId}`;

export function rememberGuestRsvp(eventId: string, rsvpId: string): void {
  try {
    sessionStorage.setItem(RSVP_KEY(eventId), rsvpId);
  } catch {
    // Private mode can block storage. The confirmation URL still carries the id.
  }
}

export function rememberedGuestRsvp(eventId: string): string | null {
  try {
    const value = sessionStorage.getItem(RSVP_KEY(eventId));
    return value && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
  } catch {
    return null;
  }
}

export function guestRsvpErrorMessage(error: unknown): string {
  let raw = "";
  if (error instanceof Error) raw = error.message;
  else if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
    raw = error.message;
  }
  const message = raw.toLowerCase();
  if (message.includes("already rsvped")) return "You're already on the list for this event.";
  if (message.includes("limit reached")) return "Too many tries right now. Please wait and try again.";
  if (message.includes("tickets required")) return "This event uses tickets. Pick one to continue.";
  if (message.includes("email required")) return "Add a valid email.";
  if (message.includes("name required")) return "Add your name.";
  if (message.includes("phone invalid")) return "That phone number is too long.";
  return "Could not save your RSVP. Please try again.";
}
