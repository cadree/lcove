const NAME_CHAR = /[a-zA-Z\s\-'.]/;

export function displayNameError(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Enter a name to continue.";
  if (trimmed.length < 2) return "Name must be at least 2 characters.";
  if (trimmed.length > 50) return "Name must be 50 characters or less.";
  const rejected = [...new Set([...trimmed].filter((character) => !NAME_CHAR.test(character)))];
  if (rejected.length > 0) {
    const shown = rejected.map((character) => `“${character}”`).join(", ");
    return `${shown} is not allowed in a name. Use letters, spaces, hyphens, or apostrophes.`;
  }
  return null;
}
