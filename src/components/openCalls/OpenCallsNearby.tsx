import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Check, Megaphone } from "lucide-react";
import { usePeopleDiscovery } from "@/hooks/usePeopleDiscovery";
import { callApplyHref, callDateLabel } from "@/lib/openCalls";
import { openCallsApi } from "@/lib/openCallsApi";
import { placeForKey } from "@/lib/peopleDiscovery";
import { PaidPill } from "./ProjectOpenCalls";

/** Explore: open calls in my city (live city first, then profile city). City level only. */
export function OpenCallsNearby() {
  const { user, people, settings } = usePeopleDiscovery();
  const me = people.find((p) => p.user_id === user?.id);
  const place = placeForKey(settings.data?.live_city_key) || me?.home || null;
  const calls = useQuery({
    queryKey: ["open-calls-near", place?.key],
    queryFn: () => openCallsApi.near(place!.key),
    enabled: !!user && !!place?.key,
    staleTime: 60_000,
  });
  const list = calls.data || [];
  if (!place || !list.length) return null;
  const city = place.label.split(",")[0];
  return (
    <section className="mt-6" aria-labelledby="open-calls-near-title" data-testid="open-calls-nearby">
      <div className="mb-2 flex items-end justify-between gap-2">
        <h2 id="open-calls-near-title" className="ether-title flex items-center gap-2 text-[22px]">
          <Megaphone className="h-4 w-4 text-muted-foreground" aria-hidden /> Open calls in {city}
        </h2>
        <span className="mono-label text-[10px] text-muted-foreground">{list.length}</span>
      </div>
      <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-2 scrollbar-hide" style={{ overscrollBehaviorX: "contain" }}>
        {list.map((call) => (
          <li key={call.id} className="w-[78%] max-w-[300px] shrink-0 snap-start" data-testid="nearby-call">
            <Link to={callApplyHref(call)} className="file-panel flex h-full flex-col overflow-hidden">
              <div className="relative h-24 w-full bg-muted">
                {call.cover && <img src={call.cover} alt="" loading="lazy" className="h-full w-full object-cover" />}
                <span className="absolute left-2 top-2"><PaidPill paid={call.paid} /></span>
              </div>
              <div className="flex flex-1 flex-col p-3">
                <p className="truncate text-base font-semibold">{call.role}</p>
                <p className="truncate text-xs text-muted-foreground">{call.project_title}{call.owner_name ? ` · ${call.owner_name}` : ""}</p>
                <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5" /> {callDateLabel(call.call_date)} · {call.city_label}
                </p>
                {call.description && <p className="mt-1.5 line-clamp-2 text-sm text-foreground/85">{call.description}</p>}
                <span className="mt-auto pt-3 text-sm font-medium text-primary">
                  {call.applied ? <span className="inline-flex items-center gap-1"><Check className="h-4 w-4" /> Applied</span> : "See the role and apply →"}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
