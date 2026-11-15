/**
 * In-app path a database notice opens, for notice types that carry one in
 * data.path. Only known shapes pass, so a crafted notice can't send someone
 * off-app or to an arbitrary route.
 */
const PATHS: Record<string, RegExp> = {
  credit: /^\/profile\?section=credits$/,
};

export function noticePath(notification: { type: string; data?: unknown }): string | null {
  const shape = PATHS[notification.type];
  if (!shape) return null;
  const data = notification.data;
  const path = data && typeof data === "object" ? (data as Record<string, unknown>).path : null;
  return typeof path === "string" && shape.test(path) ? path : null;
}
