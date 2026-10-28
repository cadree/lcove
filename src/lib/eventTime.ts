/** Event zone when one is saved, otherwise the viewer's zone. Never a silent UTC clock. */
export function resolveTimeZone(timeZone?: string | null) {
  const trimmed = timeZone?.trim();
  if (trimmed) return trimmed;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Wall-clock parts of an instant in a specific IANA timezone. */
export function zonedParts(iso: string, timeZone: string | null | undefined) {
  const zone = resolveTimeZone(timeZone);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(iso));
  const num = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);
  return {
    year: num("year"),
    month: num("month"),
    day: num("day"),
    hour: num("hour"),
    minute: num("minute"),
  };
}

export function formatEventTime(iso: string, timeZone: string | null | undefined) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: resolveTimeZone(timeZone),
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatEventDate(
  iso: string,
  timeZone: string | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  },
) {
  return new Intl.DateTimeFormat("en-US", {
    ...options,
    timeZone: resolveTimeZone(timeZone),
  }).format(new Date(iso));
}

/**
 * Convert a date (YYYY-MM-DD) and time (HH:mm) in `timeZone` to a UTC ISO string.
 * Uses the timezone offset of that wall clock, not the browser zone.
 */
export function zonedWallTimeToUtc(date: string, time: string, timeZone: string): string {
  const zone = timeZone || "UTC";
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const parts = zonedParts(utcGuess.toISOString(), zone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0);
  return new Date(utcGuess.getTime() - (asUtc - utcGuess.getTime())).toISOString();
}

export function sameZonedDay(iso: string, day: Date, timeZone: string | null | undefined) {
  const parts = zonedParts(iso, timeZone);
  return parts.year === day.getFullYear() && parts.month === day.getMonth() + 1 && parts.day === day.getDate();
}
