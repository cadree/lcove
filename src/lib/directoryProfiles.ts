export interface DirectoryProfileIdentity {
  user_id: string;
}

/** Keep the first row for each user_id. Callers pass newest-first. */
export function dedupeProfilesByUserId<T extends DirectoryProfileIdentity>(profiles: T[]): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const profile of profiles) {
    if (!profile.user_id || seen.has(profile.user_id)) continue;
    seen.add(profile.user_id);
    unique.push(profile);
  }
  return unique;
}
