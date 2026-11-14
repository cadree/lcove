/** Format an event instant in the event's IANA zone. */
export function formatEventInstant(iso, timeZone, options) {
  const zone = typeof timeZone === "string" && timeZone.trim() ? timeZone.trim() : "";
  return new Intl.DateTimeFormat("en-US", {
    ...options,
    ...(zone ? { timeZone: zone } : {}),
  }).format(new Date(iso));
}

export function eventDateLabel(iso, timeZone) {
  return formatEventInstant(iso, timeZone, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function eventTimeLabel(iso, timeZone) {
  return formatEventInstant(iso, timeZone, {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export function eventStampLabel(iso, timeZone) {
  return formatEventInstant(iso, timeZone, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}
