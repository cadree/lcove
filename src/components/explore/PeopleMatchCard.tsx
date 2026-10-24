import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { matchButtonLabel, matchPhaseFromStatus, type MatchPhase } from "@/lib/peopleMatch";

interface MatchPerson {
  user_id: string;
  display_name: string | null;
  city_display?: string | null;
}

export function PeopleMatchCard({
  person,
  onInvite,
  isSelf = false,
  inviteStatus = null,
}: {
  person: MatchPerson;
  onInvite: (recipientId: string) => Promise<void>;
  isSelf?: boolean;
  inviteStatus?: string | null;
}) {
  const [phase, setPhase] = useState<MatchPhase>("idle");
  const [errorText, setErrorText] = useState<string | null>(null);
  const saved = matchPhaseFromStatus(inviteStatus);
  const view: MatchPhase = phase === "saving" || phase === "error" ? phase : saved !== "idle" ? saved : phase;
  const locked = view === "pending" || view === "matched" || view === "saving";

  const match = async () => {
    if (locked || isSelf) return;
    setErrorText(null);
    setPhase("saving");
    try {
      await onInvite(person.user_id);
      setPhase("pending");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save that match";
      setPhase("error");
      setErrorText(message);
      toast.error(message);
    }
  };

  return (
    <div
      data-match-id={person.user_id}
      data-match-state={isSelf ? "self" : view}
      className={`file-panel flex w-[240px] shrink-0 snap-start flex-col items-center px-3 py-4 text-center ${
        view === "pending" || view === "matched" ? "ring-2 ring-[hsl(var(--scan))]" : ""
      }`}
    >
      <Link to={`/profile/${person.user_id}`} className="flex w-full flex-col items-center">
        <span className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-[conic-gradient(from_120deg,#FF9FC8,#C4142D,#FF9FC8)] p-[2px]">
          <span className="flex h-full w-full items-center justify-center rounded-full bg-card font-body text-sm font-extrabold">
            {(person.display_name || "?").charAt(0)}
          </span>
        </span>
        <span className="line-clamp-2 font-body text-[13px] font-extrabold">{person.display_name || "Member"}</span>
        <span className="mono-label mt-1 text-[8px] text-muted-foreground">{person.city_display || "City open"}</span>
      </Link>
      {isSelf ? (
        <span className="mono-label mt-2 inline-flex h-11 items-center text-[10px] text-muted-foreground">You</span>
      ) : (
        <>
          <button
            type="button"
            className="mono-label mt-2 inline-flex h-11 items-center px-3 text-[10px] text-foreground"
            onClick={match}
            disabled={locked}
            aria-live="polite"
          >
            {matchButtonLabel(view)}
          </button>
          {view === "error" && errorText && (
            <p className="text-[11px] text-destructive" role="alert">{errorText}</p>
          )}
        </>
      )}
    </div>
  );
}
