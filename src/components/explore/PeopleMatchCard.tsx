import { useRef, useState } from "react";
import { Link } from "react-router-dom";

interface MatchPerson {
  user_id: string;
  display_name: string | null;
  city_display?: string | null;
}

export function PeopleMatchCard({
  person,
  onInvite,
  isSelf = false,
}: {
  person: MatchPerson;
  onInvite: (recipientId: string) => void;
  isSelf?: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  const finishDrag = (clientX: number, clientY: number) => {
    const moved = drag.current?.moved ?? false;
    drag.current = null;
    setDragging(false);
    if (!moved) return;
    suppressClick.current = true;
    const hit = document.elementFromPoint(clientX, clientY);
    const id = hit?.closest("[data-match-id]")?.getAttribute("data-match-id");
    if (id && id !== person.user_id) onInvite(id);
  };

  return (
    <div
      data-match-id={person.user_id}
      onPointerDown={(event) => {
        if (isSelf || event.button !== 0) return;
        if ((event.target as HTMLElement).closest("button")) return;
        drag.current = { x: event.clientX, y: event.clientY, moved: false };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!drag.current) return;
        const distance = Math.hypot(event.clientX - drag.current.x, event.clientY - drag.current.y);
        if (distance > 10) {
          drag.current.moved = true;
          setDragging(true);
        }
      }}
      onPointerUp={(event) => finishDrag(event.clientX, event.clientY)}
      onPointerCancel={() => {
        drag.current = null;
        setDragging(false);
      }}
      className={`file-panel flex w-[148px] shrink-0 touch-none flex-col items-center px-3 py-4 text-center ${dragging ? "ring-2 ring-[hsl(var(--scan))]" : ""}`}
    >
      <Link
        to={`/profile/${person.user_id}`}
        className="flex w-full flex-col items-center"
        onClick={(event) => {
          if (!suppressClick.current) return;
          suppressClick.current = false;
          event.preventDefault();
        }}
      >
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
        <button
          type="button"
          className="mono-label mt-2 inline-flex h-11 items-center text-[10px] text-foreground"
          onClick={() => onInvite(person.user_id)}
        >
          Match
        </button>
      )}
    </div>
  );
}
