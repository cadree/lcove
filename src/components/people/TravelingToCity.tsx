import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plane } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { discovery } from "@/lib/creativeDiscovery";
import { tripRange } from "@/lib/tripDates";
import { TripJoinButton } from "@/components/travel/TripJoinButton";

/** Under the deck: open trips heading to the chosen city. Hidden when there are none. */
export function TravelingToCity({ cityKey, label }: { cityKey: string; label: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const trips = useQuery({
    queryKey: ["trips", user?.id, "city", cityKey],
    queryFn: () => discovery.trips(cityKey),
    enabled: !!user,
    staleTime: 60_000,
  });
  const open = (trips.data || []).filter((t) => t.status === "planning" || t.joined);
  if (!open.length) return null;
  const city = label.split(",")[0];
  return (
    <section className="mt-6" aria-label={`Members traveling to ${city}`}>
      <div className="mb-2 flex items-end justify-between gap-3">
        <h3 className="font-display text-xl">Members traveling to {city}</h3>
        <Link to={`/travel?city=${encodeURIComponent(label)}`} className="text-xs underline">All trips</Link>
      </div>
      <ul className="flex snap-x gap-3 overflow-x-auto pb-2">
        {open.map((t) => (
          <li key={t.id} className="w-[78vw] max-w-[320px] shrink-0 snap-start rounded-3xl bg-white/5 p-4 ring-1 ring-white/10">
            <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-[.18em] text-white/60">
              <Plane size={12} /> {tripRange(t.starts_on, t.ends_on)}
            </p>
            <p className="mt-1 truncate font-display text-lg">{t.title}</p>
            <p className="mt-1 line-clamp-2 text-sm text-white/70">{t.notes}</p>
            <p className="mt-2 text-xs text-white/60">
              {t.roster.slice(0, 3).map((m) => m.display_name).join(", ")}
              {t.roster.length > 3 ? ` +${t.roster.length - 3}` : ""} · {t.member_count}/{t.capacity}
            </p>
            <div className="mt-3">
              <TripJoinButton size="sm" trip={t} onOpen={() => navigate(`/travel?trip=${t.id}`)} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
