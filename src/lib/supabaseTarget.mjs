// Decides which Supabase project a build may embed.
// Production builds are unchanged: a Cloudflare Pages build of the
// production branch, and any build that is not Cloudflare Pages, may
// keep using ether-prod. Preview builds may not.

export const PRODUCTION_SUPABASE_REF = "aykopqinnnssxdhxqruo";
export const DEFAULT_PRODUCTION_BRANCH = "cursor/ether-combined";

const HOST_REF = /https?:\/\/([a-z0-9]{20})\.supabase\.co/i;

export function supabaseProjectRef(url, projectId) {
  const fromId = String(projectId ?? "").trim().toLowerCase();
  const match = String(url ?? "").trim().match(HOST_REF);
  const fromUrl = match ? match[1].toLowerCase() : "";
  const conflict = Boolean(fromId && fromUrl && fromId !== fromUrl);
  return {
    ref: conflict ? null : fromId || fromUrl || null,
    conflict,
    fromId,
    fromUrl,
  };
}

export function mentionsProductionSupabase(url, projectId) {
  return `${url ?? ""}\n${projectId ?? ""}`.toLowerCase().includes(PRODUCTION_SUPABASE_REF);
}

export function isCloudflarePagesBuild(env) {
  const flag = String(env?.CF_PAGES ?? "").trim().toLowerCase();
  return flag === "1" || flag === "true";
}

export function productionBranchName(env) {
  const named = String(env?.ETHER_PRODUCTION_BRANCH ?? "").trim();
  return named || DEFAULT_PRODUCTION_BRANCH;
}

export function decidePreviewSupabaseTarget(env) {
  const source = env ?? {};
  const url = String(source.VITE_SUPABASE_URL ?? "").trim();
  const projectId = String(source.VITE_SUPABASE_PROJECT_ID ?? "").trim();
  const key = String(source.VITE_SUPABASE_PUBLISHABLE_KEY ?? "").trim();
  const branch = String(source.CF_PAGES_BRANCH ?? "").trim();
  const parsed = supabaseProjectRef(url, projectId);
  const decision = {
    projectRef: parsed.ref,
    conflict: parsed.conflict,
    urlSet: url.length > 0,
    keySet: key.length > 0,
    projectIdSet: projectId.length > 0,
    branch: branch || null,
    productionBranch: productionBranchName(source),
  };

  if (!isCloudflarePagesBuild(source)) {
    return { action: "allow", reason: "not-cloudflare", ...decision };
  }
  if (branch && branch === decision.productionBranch) {
    return { action: "allow", reason: "production-branch", ...decision };
  }
  if (mentionsProductionSupabase(url, projectId)) {
    return { action: "reject", reason: "preview-uses-production", ...decision };
  }
  if (!url || !projectId || !key || parsed.conflict) {
    return {
      action: "reject",
      reason: parsed.conflict ? "preview-target-mismatch" : "preview-missing-target",
      ...decision,
    };
  }
  return { action: "allow", reason: "staging-target", ...decision };
}

export function authStorageKeys(url, projectId) {
  const keys = [
    "sb-aykopqinnnssxdhxqruo-auth-token",
    "sb-aykopqinnnssxdhxqruo-auth-token-code-verifier",
    "sb-wjbyvlgsxscwukkolehg-auth-token",
    "sb-wjbyvlgsxscwukkolehg-auth-token-code-verifier",
    "supabase.auth.token",
  ];
  const { ref } = supabaseProjectRef(url, projectId);
  if (ref) {
    keys.push(`sb-${ref}-auth-token`, `sb-${ref}-auth-token-code-verifier`);
  }
  return [...new Set(keys)];
}

export function formatPreviewTargetError(decision) {
  const lines = [
    "Cloudflare Pages preview build refused.",
    `Branch: ${decision.branch ?? "(unset)"}`,
    `Production branch expected: ${decision.productionBranch}`,
  ];
  if (decision.reason === "preview-uses-production") {
    lines.push(
      `This build would embed ether-prod (${PRODUCTION_SUPABASE_REF}).`,
      "Preview deployments must use the staging Supabase project.",
      "In the Cloudflare dashboard, open Workers & Pages, project ether-staging, Settings, Environment variables.",
      "Select Preview. The page opens on Production. Set these Preview variables to the staging project, and do not change the Production values:",
      "  VITE_SUPABASE_URL = https://<staging-ref>.supabase.co",
      "  VITE_SUPABASE_PUBLISHABLE_KEY = <staging anon key>",
      "  VITE_SUPABASE_PROJECT_ID = <staging-ref>",
      "The publishable key is not printed here. See docs/preview-staging.md.",
    );
  } else if (decision.reason === "preview-target-mismatch") {
    lines.push(
      "VITE_SUPABASE_URL and VITE_SUPABASE_PROJECT_ID name different projects.",
      "Set both Preview variables to the same staging project. See docs/preview-staging.md.",
    );
  } else {
    const missing = [];
    if (!decision.urlSet) missing.push("VITE_SUPABASE_URL");
    if (!decision.keySet) missing.push("VITE_SUPABASE_PUBLISHABLE_KEY");
    if (!decision.projectIdSet) missing.push("VITE_SUPABASE_PROJECT_ID");
    lines.push(
      `Preview is missing: ${missing.join(", ") || "(unset)"}`,
      "Set all three on the Preview environment to the staging project. Do not copy ether-prod. See docs/preview-staging.md.",
    );
  }
  return lines.join("\n");
}
