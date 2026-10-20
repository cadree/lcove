import { Link } from "react-router-dom";

interface MatchPerson {
  user_id: string;
  display_name: string | null;
  city_display?: string | null;
}

export function PeopleMatchCard({
  person,
  onInvite,
}: {
  person: MatchPerson;
  onInvite: (recipientId: string) => void;
}) {
  return (
    <div
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", person.user_id);
        event.dataTransfer.effectAllowed = "copy";
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const from = event.dataTransfer.getData("text/plain");
        if (!from || from === person.user_id) return;
        onInvite(person.user_id);
      }}
      className="file-panel flex w-[148px] shrink-0 flex-col items-center px-3 py-4 text-center"
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
      <button
        type="button"
        className="mono-label mt-2 inline-flex h-11 items-center text-[10px] text-foreground"
        onClick={() => onInvite(person.user_id)}
      >
        Match
      </button>
    </div>
  );
}
