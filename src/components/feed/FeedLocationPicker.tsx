import { useMemo, useState } from "react";
import { Check, Globe2, MapPin, Search } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { locationChoices, type FeedLocation, type LocationChoice } from "@/lib/feedLocation";

interface FeedLocationPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current: FeedLocation | null;
  /** The member's own city, offered first. */
  home: FeedLocation | null;
  members: LocationChoice[];
  onPick: (location: FeedLocation | null) => void;
}

export function FeedLocationPicker({ open, onOpenChange, current, home, members, onPick }: FeedLocationPickerProps) {
  const [query, setQuery] = useState("");
  const rows = useMemo(() => {
    const list = locationChoices(members, query);
    if (query.trim() || !home || list.some((row) => row.key === home.key)) return list;
    return [{ ...home, members: 0 }, ...list];
  }, [members, query, home]);

  const pick = (location: FeedLocation | null) => {
    onPick(location);
    setQuery("");
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-h-[85dvh] w-full max-w-lg rounded-t-2xl">
        <SheetHeader className="text-left">
          <SheetTitle>Location</SheetTitle>
          <SheetDescription>
            Show posts and people from one place. Ether matches the city on each profile.
          </SheetDescription>
        </SheetHeader>
        <label className="relative mt-4 block">
          <span className="sr-only">Search a city or area</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search a city or area, like Manhattan"
            className="min-h-11 pl-9"
            autoComplete="off"
          />
        </label>
        <ul className="mt-3 space-y-1" aria-label="Places">
          {!query.trim() && (
            <li>
              <button type="button" onClick={() => pick(null)} className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left hover:bg-muted">
                <Globe2 className="h-4 w-4 shrink-0" />
                <span className="flex-1 font-medium">Everywhere</span>
                {!current && <Check className="h-4 w-4 shrink-0" aria-label="Selected" />}
              </button>
            </li>
          )}
          {rows.map((row) => (
            <li key={row.key}>
              <button type="button" onClick={() => pick({ key: row.key, label: row.label })} className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left hover:bg-muted">
                <MapPin className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{row.label}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {home?.key === row.key && !query.trim() ? "Your city" : row.members > 0 ? `${row.members} ${row.members === 1 ? "member" : "members"}` : ""}
                </span>
                {current?.key === row.key && <Check className="h-4 w-4 shrink-0" aria-label="Selected" />}
              </button>
            </li>
          ))}
          {query.trim().length >= 2 && rows.length === 0 && (
            <li className="px-3 py-4 text-sm text-muted-foreground">No place found. Try the city name.</li>
          )}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
