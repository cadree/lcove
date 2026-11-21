/**
 * Status for an edge-function failure.
 * Authentication problems are 401, bad input is 400, and everything else stays 500.
 * The response body keeps the same error string the client already shows.
 */

const AUTH_PATTERNS = [
  /missing sub claim/i,
  /invalid claim/i,
  /invalid jwt/i,
  /\bjwt expired\b/i,
  /\btoken expired\b/i,
  /token not yet valid/i,
  /malformed token/i,
  /invalid signature/i,
  /unexpected webhook issuer/i,
  /no authorization header/i,
  /missing authorization/i,
  /authorization required/i,
  /authorization header/i,
  /\bnot authenticated\b/i,
  /user not authenticated/i,
  /authentication failed/i,
  /^authentication error:/i,
  /^auth error:/i,
  /^auth:/i,
  /\bunauthorized\b/i,
  /\bnot authorized\b/i,
  /access denied/i,
  /you don't own/i,
  /you don’t own/i,
  /don't have permission/i,
  /don’t have permission/i,
  /don't have access/i,
  /don’t have access/i,
  /only the (event )?host\b/i,
  /only admins\b/i,
  /admin role required/i,
];

const SERVER_PATTERNS = [
  /not configured/i,
  /\bnot set\b/i,
  /is not set/i,
  /secret key/i,
  /\bapi key\b/i,
  /failed to\b/i,
  /could not (load|start|fetch|create|send)/i,
  /did not respond/i,
  /did not publish/i,
  /gateway error/i,
  /unexpected state/i,
  /\b(query|lookup) failed\b/i,
  /stripe key must/i,
  /vapid keys/i,
  /invalid sender domain/i,
  /internal server/i,
  /fetch failed/i,
  /\btimeout\b/i,
  /econn/i,
  /relation .* does not exist/i,
  /column .* does not exist/i,
  /server configuration/i,
  /no such /i,
  /rate limit/i,
  /checkout missing/i,
  /payment missing/i,
  /gift missing/i,
];

const INPUT_PATTERNS = [
  /\brequired\b/i,
  /^missing\b/i,
  /^invalid\b/i,
  /\bminimum\b/i,
  /\bmust be\b/i,
  /\bnot found\b/i,
  /^insufficient\b/i,
  /does not accept/i,
  /cannot be purchased/i,
  /can't purchase/i,
  /can't subscribe/i,
  /sold outside/i,
  /not a valid/i,
  /greater than zero/i,
  /this network is free/i,
  /no stripe customer/i,
  /no active /i,
  /sold out/i,
  /\balready\b/i,
  /limit reached/i,
  /cannot transfer/i,
  /code expired/i,
  /^maximum\b/i,
  /at least one/i,
  /ticket\(s\) remaining/i,
  /does not have a/i,
  /only card orders/i,
  /only a paid/i,
  /has no card payment/i,
  /fan challenge/i,
  /not enabled payouts/i,
  /^unknown action\b/i,
];

export function errorText(error) {
  if (typeof error === "string" && error.trim()) return error.trim();
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string" && error.message) {
    return error.message;
  }
  return "Unknown error";
}

function isAuth(message) {
  return AUTH_PATTERNS.some((pattern) => pattern.test(message));
}

function isServer(message) {
  return SERVER_PATTERNS.some((pattern) => pattern.test(message));
}

function isBadInput(message) {
  return INPUT_PATTERNS.some((pattern) => pattern.test(message));
}

function isUpstream(error) {
  if (!error || typeof error !== "object") return false;
  const type = "type" in error && typeof error.type === "string" ? error.type : "";
  if (type.startsWith("Stripe")) return true;
  const code = "code" in error && typeof error.code === "string" ? error.code : "";
  return /^(PGRST|22|23|42)/.test(code);
}

export function httpStatusForError(error) {
  if (
    error
    && typeof error === "object"
    && error.name === "HttpError"
    && (error.status === 400 || error.status === 401 || error.status === 500)
  ) {
    return error.status;
  }
  const message = errorText(error);
  if (isAuth(message)) return 401;
  if (isServer(message) || isUpstream(error)) return 500;
  if (isBadInput(message)) return 400;
  return 500;
}
