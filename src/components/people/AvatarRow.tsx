import { Plane } from "lucide-react";
import type { Person } from "@/lib/peopleDiscovery";
import { safeWebLink } from "@/lib/tripMoney";

/** A horizontal row of member faces. Tapping one brings their card to the front of the deck. */
export function AvatarRow({ people, label, onPick }: { people: Person[]; label: string; onPick: (userId: string) => void }) {
  if (!people.length) return null;
  return (
    <ul className="-mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-1 scrollbar-hide" aria-label={label}>
      {people.slice(0, 30).map((person) => (
        <li key={person.user_id} className="shrink-0">
          <button
            type="button"
            className="flex w-14 flex-col items-center gap-1"
            onClick={() => onPick(person.user_id)}
            aria-label={`Show ${person.name}`}
          >
            <span className={`relative block h-14 w-14 overflow-hidden rounded-full ring-2 ${person.live ? "ring-[#79c3cf]" : person.liked ? "ring-[#ff9fc8]" : "ring-white/20"}`}>
              {safeWebLink(person.avatar_url) ? (
                <img src={safeWebLink(person.avatar_url)} alt="" loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-[#4a4150] font-bold">{person.name.charAt(0).toUpperCase()}</span>
              )}
              {person.trip && <Plane size={12} className="absolute bottom-0.5 right-0.5 rounded-full bg-[#faf4ed] p-0.5 text-[#1d1a22]" />}
            </span>
            <span className="w-full truncate text-center text-[11px] text-white/75">{person.name.split(" ")[0]}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
