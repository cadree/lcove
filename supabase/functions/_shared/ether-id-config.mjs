// Secrets the Ether ID Apple Wallet pass needs. Values stay in the
// function environment. This module only checks that they are present.

export const PASS_SECRET_NAMES = [
  "APPLE_PASS_TYPE_ID",
  "APPLE_TEAM_ID",
  "APPLE_PASS_CERT_PEM",
  "APPLE_PASS_KEY_PEM",
  "APPLE_WWDR_CERT_PEM",
];

export const APNS_SECRET_NAMES = ["APPLE_APNS_KEY_P8", "APPLE_APNS_KEY_ID"];

export const PUSH_SECRET_NAME = "ETHER_ID_PUSH_SECRET";

export function secretPresent(env, name) {
  return typeof env?.[name] === "string" && env[name].trim() !== "";
}

export function missingWalletSecrets(env) {
  return [...PASS_SECRET_NAMES, ...APNS_SECRET_NAMES].filter((name) => !secretPresent(env, name));
}

/** True only when the pass can be signed and a ban can push to Wallet. */
export function walletConfigured(env) {
  return missingWalletSecrets(env).length === 0;
}

export function matchEtherIdRoute(pathname, method) {
  const marker = "/ether-id-pass";
  const at = pathname.indexOf(marker);
  const rest = (at === -1 ? pathname : pathname.slice(at + marker.length)).replace(/\/$/, "") || "/";

  if (rest === "/") return { kind: "app", method };
  if (rest === "/push" && method === "POST") return { kind: "push", method };

  let match = rest.match(/^\/v1\/devices\/([^/]+)\/registrations\/([^/]+)\/([^/]+)$/);
  if (match && (method === "POST" || method === "DELETE")) {
    return {
      kind: method === "POST" ? "register" : "unregister",
      device: decodeURIComponent(match[1]),
      passType: decodeURIComponent(match[2]),
      serial: decodeURIComponent(match[3]),
    };
  }

  match = rest.match(/^\/v1\/devices\/([^/]+)\/registrations\/([^/]+)$/);
  if (match && method === "GET") {
    return {
      kind: "list",
      device: decodeURIComponent(match[1]),
      passType: decodeURIComponent(match[2]),
    };
  }

  match = rest.match(/^\/v1\/passes\/([^/]+)\/([^/]+)$/);
  if (match && method === "GET") {
    return {
      kind: "latest",
      passType: decodeURIComponent(match[1]),
      serial: decodeURIComponent(match[2]),
    };
  }

  if (rest === "/v1/log" && method === "POST") return { kind: "log", method };
  return { kind: "unknown", method };
}
