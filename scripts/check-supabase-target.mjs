import { decidePreviewSupabaseTarget, formatPreviewTargetError } from "../src/lib/supabaseTarget.mjs";

const decision = decidePreviewSupabaseTarget(process.env);
if (decision.action === "reject") {
  console.error(formatPreviewTargetError(decision));
  process.exit(1);
}
if (decision.reason === "staging-target") {
  console.log(`Preview build will use Supabase project ${decision.projectRef}.`);
}
