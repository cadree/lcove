export const APPLE_WALLET_SECRETS = [
  "APPLE_PASS_TYPE_ID",
  "APPLE_TEAM_ID",
  "APPLE_PASS_CERT",
  "APPLE_PASS_KEY",
  "APPLE_WWDR_CERT",
];

export function appleWalletConfigured(env) {
  return APPLE_WALLET_SECRETS.every((name) => {
    const value = env?.[name];
    return typeof value === "string" && value.trim().length > 0;
  });
}

export function appleWalletEnv() {
  if (typeof Deno === "undefined") return {};
  return Object.fromEntries(APPLE_WALLET_SECRETS.map((name) => [name, Deno.env.get(name) || ""]));
}
