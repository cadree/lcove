/**
 * Calendar dates stored as YYYY-MM-DD (or midnight UTC) are a day, not an instant.
 * Parsing them with Date.parse shifts the day west of UTC.
 */
export function parseCalendarDate(value: string): Date {
  const trimmed = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (!match) return new Date(trimmed);
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
  const utcMidnight = /T00:00:00(\.0+)?(Z|\+00:?00)?$/.test(trimmed);
  if (dateOnly || utcMidnight) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  return new Date(trimmed);
}
