export interface ActiveNowProfile {
  user_id: string;
  display_name?: string | null;
  avatar_url?: string | null;
}

export interface ActiveNowPerson {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
}

function presenceUserId(presence: unknown): string | undefined {
  if (typeof presence !== "object" || presence === null || !("user_id" in presence)) return undefined;
  const userId = presence.user_id;
  return typeof userId === "string" && userId ? userId : undefined;
}

/** User ids currently tracked on the online-users channel. The presence key is the user id. */
export function collectPresenceUserIds(state: { readonly [key: string]: readonly unknown[] }): string[] {
  const online = new Set<string>();
  for (const [key, presences] of Object.entries(state)) {
    let found = false;
    for (const presence of presences) {
      const userId = presenceUserId(presence);
      if (!userId) continue;
      online.add(userId);
      found = true;
    }
    if (!found && key) online.add(key);
  }
  return [...online];
}

/**
 * Everyone else currently in presence. A direct chat is not required.
 * Names and avatars come from profiles; a missing profile still shows.
 */
export function selectActiveNow(input: {
  onlineUserIds: Iterable<string>;
  selfId?: string | null;
  profiles?: readonly ActiveNowProfile[];
}): ActiveNowPerson[] {
  const profiles = new Map<string, ActiveNowProfile>();
  for (const profile of input.profiles ?? []) {
    if (profile.user_id) profiles.set(profile.user_id, profile);
  }

  const seen = new Set<string>();
  const people: ActiveNowPerson[] = [];
  for (const userId of input.onlineUserIds) {
    if (!userId || userId === input.selfId || seen.has(userId)) continue;
    seen.add(userId);
    const profile = profiles.get(userId);
    const displayName = profile?.display_name?.trim() || "User";
    people.push({
      userId,
      displayName,
      avatarUrl: profile?.avatar_url ?? null,
    });
  }
  return people;
}

/**
 * Publish presence only while a real session is in the foreground.
 * The native app waits until Capacitor reports active, then joins even if
 * the webview visibility flag is stale. Background drops. Web follows the tab.
 */
export function shouldPublishPresence(input: {
  userId?: string | null;
  shotSession?: boolean;
  nativePlatform: boolean;
  nativeActive: boolean | null;
  documentVisible: boolean;
}): boolean {
  if (!input.userId || input.shotSession) return false;
  if (input.nativePlatform) return input.nativeActive === true;
  return input.documentVisible;
}
