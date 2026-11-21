export type MatchPhase = "idle" | "saving" | "pending" | "matched" | "error";

export function matchPhaseFromStatus(status: string | null | undefined): MatchPhase {
  if (status === "accepted") return "matched";
  if (status === "pending") return "pending";
  return "idle";
}

export function matchButtonLabel(phase: MatchPhase): string {
  if (phase === "pending") return "Pending";
  if (phase === "matched") return "Matched";
  if (phase === "saving") return "Saving";
  if (phase === "error") return "Match";
  return "Match";
}
