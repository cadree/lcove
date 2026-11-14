import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plane, Radio } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { tripBadge, type Person } from "@/lib/peopleDiscovery";
import { safeWebLink } from "@/lib/tripMoney";

const PAGE = 24;

/** Everyone who matches, including members hidden from the globe and deck. */
export function MemberGrid({ people, resetKey }: { people: Person[]; resetKey: string }) {
  const [shown, setShown] = useState(PAGE);
  useEffect(() => setShown(PAGE), [resetKey]);
  return (
    <>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {people.slice(0, shown).map((person) => (
          <li key={person.user_id}>
            <Link to={`/profile/${person.user_id}`} className="file-panel flex min-h-11 items-start gap-3 p-3">
              <Avatar className="h-12 w-12 shrink-0">
                <AvatarImage src={safeWebLink(person.avatar_url) || undefined} alt="" />
                <AvatarFallback className="font-bold">{person.name.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-body text-[15px] font-extrabold text-foreground">{person.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {[person.role, person.home?.label || person.city_display || person.city].filter(Boolean).join(" · ") || "City open"}
                </span>
                {person.live && (
                  <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-[hsl(var(--scan))]"><Radio size={11} /> In {person.live.label} now</span>
                )}
                {person.trip && (
                  <span className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground"><Plane size={11} /> {tripBadge(person.trip)}</span>
                )}
                {person.bio && <span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">{person.bio}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {shown < people.length && (
        <Button type="button" variant="outline" className="mt-4 min-h-11 w-full" onClick={() => setShown((n) => n + PAGE)}>
          Show more ({people.length - shown})
        </Button>
      )}
    </>
  );
}
