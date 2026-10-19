/**
 * Day labels for message threads and notification groups.
 *
 * Compare the viewer's local calendar day. A `YYYY-MM-DD` string parsed with
 * `new Date` is UTC midnight, which in timezones behind UTC is the previous
 * local evening — so a 10:59 PM Eastern message was labeled "Yesterday".
 */

export interface CalendarDay {
  year: number;
  month: number;
  day: number;
}

export type OlderDayStyle = "long" | "short";

export interface DayDividerOptions {
  /** Fixed clock for comparisons. Defaults to the current instant. */
  now?: Date | string | number;
  /** IANA zone. Omit to use the viewer's local timezone. */
  timeZone?: string;
  /** Format used when the instant is neither today nor yesterday. */
  older?: OlderDayStyle;
}

function asDate(input: Date | string | number): Date {
  return input instanceof Date ? input : new Date(input);
}

function dateTimeFormat(timeZone: string | undefined, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", timeZone ? { ...options, timeZone } : options);
}

/** Year, month, and day in the viewer's local timezone (or `timeZone` when given). */
export function localCalendarDay(input: Date | string | number, timeZone?: string): CalendarDay {
  const parts = dateTimeFormat(timeZone, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(asDate(input));
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);

  return { year: value("year"), month: value("month"), day: value("day") };
}

/** Stable local-day key. Do not pass this back through `new Date`. */
export function calendarDayKey(input: Date | string | number, timeZone?: string): string {
  const { year, month, day } = localCalendarDay(input, timeZone);
  const monthText = String(month).padStart(2, "0");
  const dayText = String(day).padStart(2, "0");
  return `${year}-${monthText}-${dayText}`;
}

/** Whole local calendar days from `from` until `to` (`to` minus `from`). */
export function localCalendarDayDelta(
  to: Date | string | number,
  from: Date | string | number,
  timeZone?: string,
): number {
  const later = localCalendarDay(to, timeZone);
  const earlier = localCalendarDay(from, timeZone);
  const laterMs = Date.UTC(later.year, later.month - 1, later.day);
  const earlierMs = Date.UTC(earlier.year, earlier.month - 1, earlier.day);
  return Math.round((laterMs - earlierMs) / 86_400_000);
}

function formatOlderDay(input: Date | string | number, timeZone: string | undefined, older: OlderDayStyle): string {
  const date = asDate(input);
  if (older === "short") {
    return dateTimeFormat(timeZone, { month: "short", day: "numeric" }).format(date);
  }
  return dateTimeFormat(timeZone, { month: "long", day: "numeric", year: "numeric" }).format(date);
}

/** "Today", "Yesterday", or a calendar date in the viewer's local timezone. */
export function dayDividerLabel(input: Date | string | number, options: DayDividerOptions = {}): string {
  const timeZone = options.timeZone;
  const now = options.now ?? new Date();
  const delta = localCalendarDayDelta(input, now, timeZone);
  if (delta === 0) return "Today";
  if (delta === -1) return "Yesterday";
  return formatOlderDay(input, timeZone, options.older ?? "long");
}
