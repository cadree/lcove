export const MIN_PASSION_LENGTH = 2;
export const MAX_PASSION_LENGTH = 32;
export const MAX_PASSIONS = 10;

export interface CatalogPassion {
  id: string;
  name: string;
}

export interface UserPassionInsert {
  user_id: string;
  passion_id: string | null;
  custom_name: string | null;
}

export function parsePassionTokens(raw: string): string[] {
  return raw
    .split(/[,;\n]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export function mergePassions(
  existing: string[],
  raw: string,
): { passions: string[]; error: string | null } {
  const tokens = parsePassionTokens(raw);
  if (tokens.length === 0) {
    return {
      passions: existing,
      error: `Passion must be at least ${MIN_PASSION_LENGTH} characters`,
    };
  }

  const next = [...existing];
  let error: string | null = null;

  for (const token of tokens) {
    if (token.length < MIN_PASSION_LENGTH) {
      error = `Passion must be at least ${MIN_PASSION_LENGTH} characters`;
      continue;
    }
    if (token.length > MAX_PASSION_LENGTH) {
      error = `Passion must be ${MAX_PASSION_LENGTH} characters or less`;
      continue;
    }
    if (next.length >= MAX_PASSIONS) {
      error = `You can add up to ${MAX_PASSIONS} passions`;
      continue;
    }
    const duplicate = next.some((passion) => passion.trim().toLowerCase() === token.toLowerCase());
    if (duplicate) {
      error = "This passion is already added";
      continue;
    }
    next.push(token);
    error = null;
  }

  return { passions: next, error };
}

/**
 * Catalog lookup is exact-name only. Typed tags that are not seeded
 * (Portraits, Street Photography) must be stored on user_passions.custom_name
 * or the profile keeps only the names that already exist in passions.
 */
export function buildUserPassionInserts(
  userId: string,
  entered: string[],
  catalog: CatalogPassion[],
): UserPassionInsert[] {
  const byName = new Map(catalog.map((row) => [row.name.trim().toLowerCase(), row]));
  const seen = new Set<string>();
  const rows: UserPassionInsert[] = [];

  for (const raw of entered) {
    const trimmed = raw.trim();
    const key = trimmed.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const match = byName.get(key);
    if (match) {
      rows.push({ user_id: userId, passion_id: match.id, custom_name: null });
    } else {
      rows.push({ user_id: userId, passion_id: null, custom_name: trimmed });
    }
  }

  return rows;
}
