import { Suspense, lazy, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { OpenToFilter } from "@/components/openTo/OpenToChips";
import { hasOpenTo, openToLabel, type OpenToTag } from "@/lib/openTo";
import { Globe2, MapPin, Plane, SlidersHorizontal, UserPlus, Users } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { markConnectHintSeen, showConnectHint } from "@/lib/firstRun";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DiscoveryPreferences } from "@/components/discovery/DiscoveryPreferences";
import { ReportDialog } from "@/components/safety/ReportDialog";
import { useUserBlocks } from "@/hooks/useUserBlocks";
import { usePeopleDiscovery } from "@/hooks/usePeopleDiscovery";
import { discovery } from "@/lib/creativeDiscovery";
import {
  REGION, deckFor, inCity, listFor, matchesQuery, placeForKey, placeOptions,
  type DiscoverySignal, type Person,
} from "@/lib/peopleDiscovery";
import { ConnectCtaSheet, ConnectMomentHost, ConnectNudgeLine, nudgeFromPerson, personNudge, useConnectNudges } from "./ConnectMoment";
import { AvatarRow } from "./AvatarRow";
import { LiveAreaToggle } from "./LiveAreaToggle";
import { MemberGrid } from "./MemberGrid";
import { SwipeDeck } from "./SwipeDeck";
import { TravelingToCity } from "./TravelingToCity";
import { GlobePlaceControl } from "./GlobePlaceControl";
import { FeedLocationPicker } from "@/components/feed/FeedLocationPicker";
import { supabase } from "@/integrations/supabase/client";
import { connectedParam, messageHref, type IcebreakerMe } from "@/lib/connectMoment";
import { NEARBY_KM, nearbyGroups, safeArea, type LonLat, type MapGroup } from "@/lib/nearbyMap";

// The globe and its city coordinates (~300 KB) load after the deck renders.
const CreativeGlobe = lazy(() => import("@/components/discovery/CreativeGlobe").then((m) => ({ default: m.CreativeGlobe })));
// The street map (MapLibre, ~250 KB gzipped) loads only when someone opens Nearby.
const StreetMap = lazy(() => import("@/components/discovery/StreetMap"));

/** City centres, loaded once for Nearby (the globe bundles its own copy). */
function useCityPoints(enabled: boolean) {
  return useQuery({
    queryKey: ["city-coordinates"],
    queryFn: async () => (await import("@/data/cityCoordinates.json")).default as Record<string, number[]>,
    enabled,
    staleTime: Infinity,
  });
}

/**
 * The one people experience. Global: the globe with a card per city; a card opens that city's
 * people. Nearby: a street map of your city with members at area or city level. Both share the
 * avatar row, the swipe deck and matches; "See all" opens the full member list.
 */
export function PeopleDiscovery({ query }: { query: string }) {
  const { user, people: everyone, members, signals, settings } = usePeopleDiscovery();
  const [openFilter, setOpenFilter] = useState<OpenToTag[]>([]);
  const people = useMemo(
    () => (openFilter.length ? everyone.filter((p) => hasOpenTo(p.open_to, openFilter)) : everyone),
    [everyone, openFilter],
  );
  const openFilterLabel = openFilter.map((tag) => openToLabel(tag)?.toLowerCase()).join(" + ");
  const { blockUser } = useUserBlocks();
  const cache = useQueryClient();
  const search = useDeferredValue(query);
  const [city, setCity] = useState<string | null>(null);
  const [mode, setMode] = useState<"global" | "nearby">("global");
  /** The city whose sheet is open, after tapping its card on the globe. */
  const [sheetCity, setSheetCity] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  /** My own ~1 km area from this session's opt-in, for centring my map before the server echoes it. */
  const [localArea, setLocalArea] = useState<LonLat | null>(null);
  const [focus, setFocus] = useState<{ id: string; at: number } | null>(null);
  const [sheetFocus, setSheetFocus] = useState<{ id: string; at: number } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [placeOpen, setPlaceOpen] = useState(false);
  const [reporting, setReporting] = useState<Person | null>(null);
  const [moment, setMoment] = useState<{ person: Person; matched: boolean; conversationId: string | null } | null>(null);
  const [ctaPerson, setCtaPerson] = useState<Person | null>(null);
  const nudges = useConnectNudges(user?.id);
  const location = useLocation();
  // First run (arriving from onboarding): open on my city if anyone is there, and show one Connect hint.
  const [hint, setHint] = useState(() => showConnectHint(window.localStorage, user?.id, location.search));
  const dismissHint = () => {
    markConnectHintSeen(window.localStorage, user?.id);
    setHint(false);
  };
  const openedHome = useRef(false);
  // Bring the deck into view once on first run; the globe sits above it.
  const hintRef = useRef<HTMLDivElement | null>(null);
  const scrolledToHint = useRef(false);
  useEffect(() => {
    if (!hint || scrolledToHint.current || !hintRef.current) return;
    scrolledToHint.current = true;
    hintRef.current.scrollIntoView({ block: "start", behavior: "smooth" });
  });

  const me = everyone.find((p) => p.user_id === user?.id);
  const myIcebreaker: IcebreakerMe | null = me
    ? { skills: me.skills, passions: me.passions, city: me.live?.label || me.home?.label || me.city_display || me.city }
    : null;
  const myLive = placeForKey(settings.data?.live_city_key);
  const myPlace = myLive || me?.home || null;
  const myArea = myLive ? safeArea(settings.data?.live_area) || localArea : null;
  const points = useCityPoints(mode === "nearby");
  const cityPoint = myPlace && points.data?.[myPlace.key];
  const nearCenter: LonLat | null = myArea || (cityPoint?.length === 2 ? [cityPoint[0], cityPoint[1]] : null);
  const options = useMemo(() => placeOptions(people), [people]);
  // Order the deck when the city, search or member set changes, not on every like,
  // so the card in front does not jump away after a decision.
  const roster = people.map((p) => p.user_id).join(",");
  const deckOrder = useMemo(
    () => deckFor(people, user?.id, city, search).map((p) => p.user_id),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- liked changes must not reorder
    [roster, user?.id, city, search, signals.dataUpdatedAt === 0],
  );
  const deck = useMemo(() => {
    const byId = new Map(people.map((p) => [p.user_id, p]));
    return deckOrder.flatMap((id) => byId.get(id) || []).filter((p) => p.discoverable);
  }, [deckOrder, people]);
  const list = useMemo(() => listFor(people, city, search), [people, city, search]);
  const here = useMemo(() => people.filter((p) => p.discoverable && inCity(p, city)), [people, city]);
  const groups = useMemo(
    () => (nearCenter && points.data ? nearbyGroups(people, nearCenter, points.data, user?.id) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the centre is two numbers
    [people, nearCenter?.[0], nearCenter?.[1], points.data, user?.id],
  );
  const nearbyDeck = useMemo(() => {
    const near = new Set(groups.flatMap((g) => g.people.map((p) => p.user_id)));
    return deck.filter((p) => near.has(p.user_id) && matchesQuery(p, search));
  }, [groups, deck, search]);
  const sheetDeck = useMemo(() => (sheetCity ? deck.filter((p) => inCity(p, sheetCity)) : []), [deck, sheetCity]);
  const nearbyMode = mode === "nearby" && !!myPlace;
  const shownDeck = nearbyMode ? nearbyDeck : deck;
  useEffect(() => {
    if (!hint || openedHome.current || !myPlace || city) return;
    if (people.some((p) => p.user_id !== user?.id && p.discoverable && inCity(p, myPlace.key))) {
      openedHome.current = true;
      setCity(myPlace.key);
    }
  }, [hint, myPlace, city, people, user?.id]);
  const labelFor = (key: string | null) =>
    key
      ? options.cities.find((c) => c.key === key)?.label || options.regions.find((r) => r.key === key)?.label || placeForKey(key)?.label || "This city"
      : null;
  const cityLabel = labelFor(city);
  const placeChoices = useMemo(
    () => ({
      cities: options.cities.map((c) => ({ key: c.key, label: c.label, members: c.count })),
      regions: options.regions.map((r) => ({ key: r.key, label: `All of ${r.label}`, members: r.count })),
    }),
    [options],
  );
  const sheetLabel = labelFor(sheetCity);

  const matches = useQuery({
    queryKey: ["creative-matches", user?.id],
    queryFn: discovery.matches,
    refetchInterval: 30_000,
    enabled: !!user,
  });
  const swipe = useMutation({
    mutationFn: ({ person, liked }: { person: Person; liked: boolean }) => discovery.swipe(person.user_id, liked),
    onSuccess: async (data, { person, liked }) => {
      cache.setQueryData<DiscoverySignal[]>(["discovery-globe", user?.id], (rows) =>
        rows?.map((row) => (row.user_id === person.user_id ? { ...row, liked } : row)),
      );
      await cache.invalidateQueries({ queryKey: ["creative-matches"] });
      if (data.new_match && data.conversation_id) {
        // Both people get an in-app notice from the database; this pushes it to the other phone.
        void supabase.functions.invoke("send-push-notification", {
          body: { user_id: person.user_id, notification_type: "match", title: "You connected", data: { conversation_id: data.conversation_id } },
        }).catch(() => undefined);
      }
      if (liked) setMoment({ person, matched: !!data.matched, conversationId: data.conversation_id });
    },
    onError: (e: Error) => {
      toast.error(e.message);
      if (/Show yourself/.test(e.message)) setSettingsOpen(true);
    },
  });
  // A match push or notice opens Explore with ?connected=<id>: replay the match moment for the
  // person who was matched (they did not see it happen), then the start-something sheet.
  const navigate = useNavigate();
  const connectedId = connectedParam(location.search);
  useEffect(() => {
    if (!connectedId || !members.isSuccess || !matches.isSuccess) return;
    const next = new URLSearchParams(location.search);
    next.delete("connected");
    const rest = next.toString();
    const clean = `${location.pathname}${rest ? `?${rest}` : ""}`;
    const match = matches.data?.find((m) => m.user_id === connectedId);
    const person = everyone.find((p) => p.user_id === connectedId);
    if (person) {
      navigate(clean, { replace: true });
      setMoment({ person, matched: !!match, conversationId: match?.conversation_id ?? null });
    } else if (match?.conversation_id) {
      navigate(messageHref(match.conversation_id), { replace: true });
    } else {
      navigate(clean, { replace: true });
    }
  }, [connectedId, members.isSuccess, matches.isSuccess, matches.data, everyone, location.pathname, location.search, navigate]);
  const unmatch = useMutation({
    mutationFn: discovery.unmatch,
    onSuccess: () => cache.invalidateQueries({ queryKey: ["creative-matches"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const nearby = () => {
    if (!myPlace) {
      toast.info("Add your city in Settings, or share a live city, to see people nearby.");
      setSettingsOpen(true);
      return;
    }
    setMode("nearby");
    setCity(null);
  };
  const global = () => {
    setMode("global");
    setCity(null);
  };
  const openCity = (key: string) => {
    setCity(key);
    setSheetCity(key);
  };
  // A street-map pin opens its city's members as a sheet, over the map where the tap was. An area
  // pin opens the same sheet with the person (or the first of the people) in that area in front.
  const openPin = (group: MapGroup) => {
    const first = group.people[0];
    const key = group.kind === "city" ? group.key.replace(/^city:/, "") : first?.live?.key ?? first?.home?.key;
    if (!key) return;
    setSheetFocus(group.kind === "area" && first ? { id: first.user_id, at: Date.now() } : null);
    setSheetCity(key);
  };

  const deckProps = {
    pending: swipe.isPending,
    viewerId: user?.id,
    me: myIcebreaker,
    nudgeFor: (id: string) => personNudge(nudges, id),
    onReopen: (person: Person) => setCtaPerson(person),
    onDecide: (person: Person, liked: boolean) => {
      if (hint) dismissHint();
      return swipe.mutateAsync({ person, liked }).catch(() => undefined);
    },
    onReport: setReporting,
    onBlock: (person: Person) => {
      if (window.confirm(`Block ${person.name}? They disappear from discovery and any match is removed.`))
        blockUser.mutate(person.user_id, {
          onSuccess: () => void cache.invalidateQueries({ queryKey: ["discovery-globe"] }),
          onError: (e: Error) => toast.error(e.message),
        });
    },
  };
  const matchIds = new Set((matches.data || []).map((m) => m.user_id));
  const openNudges = nudges.filter((n) => !n.started && !matchIds.has(n.userId));

  if (!user) {
    return (
      <section className="rounded-[28px] bg-[#1d1a22] p-6 text-[#faf5f0]">
        <h2 className="font-display text-3xl">Find your people</h2>
        <p className="mt-2 text-sm text-white/70">Sign in to browse members on the globe and swipe through profiles.</p>
        <Link to="/auth" className="mt-4 inline-flex min-h-11 items-center rounded-full bg-[#ff9fc8] px-5 text-sm font-semibold text-[#2c1320]">Sign in</Link>
      </section>
    );
  }

  const loading = members.isPending || signals.isPending;
  const failed = members.isError || signals.isError;
  return (
    <>
      <section aria-labelledby="people-title" className="overflow-hidden rounded-[28px] bg-[#1d1a22] px-4 pb-5 pt-4 text-[#faf5f0] shadow-[0_30px_80px_-40px_rgba(0,0,0,.9)] sm:px-6">
        <header className="relative z-20 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[.25em] text-[#ff9fc8]">People</p>
            <h2 id="people-title" className="font-display text-[26px] leading-tight sm:text-[30px]">Find your people</h2>
          </div>
          <button
            type="button"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
            aria-label="Discovery settings"
            onClick={() => setSettingsOpen(true)}
          >
            <SlidersHorizontal size={19} />
          </button>
        </header>

        <div className="relative z-20 mt-3 flex flex-wrap items-center gap-2">
          <label className="flex min-h-11 min-w-0 flex-1 basis-[180px] items-center gap-2 rounded-full bg-white/10 px-3">
            <MapPin size={16} className="shrink-0 text-[#ff9fc8]" />
            <select
              aria-label="Select a city or state"
              value={city || ""}
              onChange={(e) => {
                setMode("global");
                setCity(e.target.value || null);
              }}
              className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none"
            >
              <option className="bg-[#1d1a22]" value="">Everywhere</option>
              {!!options.cities.length && (
                <optgroup className="bg-[#1d1a22]" label="Cities">
                  {options.cities.map((c) => (
                    <option className="bg-[#1d1a22]" key={c.key} value={c.key}>{c.label} ({c.count})</option>
                  ))}
                </optgroup>
              )}
              {!!options.regions.length && (
                <optgroup className="bg-[#1d1a22]" label="States & countries">
                  {options.regions.map((r) => (
                    <option className="bg-[#1d1a22]" key={r.key} value={r.key}>{r.label} ({r.count})</option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>
          <div className="flex rounded-full bg-white/10 p-1" role="group" aria-label="Range">
            <button
              type="button"
              aria-pressed={nearbyMode}
              onClick={nearby}
              className={`min-h-9 rounded-full px-4 text-sm ${nearbyMode ? "bg-[#faf4ed] text-[#1d1a22]" : "text-white/80"}`}
            >
              Nearby
            </button>
            <button
              type="button"
              aria-pressed={!nearbyMode}
              onClick={global}
              className={`min-h-9 rounded-full px-4 text-sm ${!nearbyMode ? "bg-[#faf4ed] text-[#1d1a22]" : "text-white/80"}`}
            >
              Global
            </button>
          </div>
          <Link
            to={cityLabel && city && !city.startsWith(REGION) ? `/travel?city=${encodeURIComponent(cityLabel)}` : "/travel"}
            className="flex min-h-11 items-center gap-1.5 rounded-full bg-[#faf4ed] px-4 text-sm font-medium text-[#1d1a22]"
          >
            <Plane size={16} /> Let’s travel
          </Link>
        </div>
        <OpenToFilter value={openFilter} onChange={setOpenFilter} />

        <div className="lg:mt-2 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-8">
        <div className="min-w-0">
        {nearbyMode ? (
          <div className="mt-3">
            <Suspense fallback={<div className="h-[min(420px,52dvh)] w-full animate-pulse rounded-[24px] bg-white/5" role="status" aria-label="Loading map" />}>
              {nearCenter ? (
                <StreetMap
                  center={nearCenter}
                  groups={groups}
                  me={myArea ? { point: myArea, live: true } : nearCenter ? { point: nearCenter, live: false } : null}
                  onPick={openPin}
                />
              ) : (
                <div className="h-[min(420px,52dvh)] w-full animate-pulse rounded-[24px] bg-white/5" role="status" aria-label="Loading map" />
              )}
            </Suspense>
            <LiveAreaToggle on={!!myArea} disabled={!settings.data?.discoverable} onArea={setLocalArea} />
          </div>
        ) : (
          <Suspense fallback={<div className="mx-auto my-3 aspect-square w-full max-w-[520px] rounded-full bg-white/5" role="status" aria-label="Loading globe" />}>
            <CreativeGlobe
              people={people}
              selected={city}
              onSelect={openCity}
              me={myPlace ? { key: myPlace.key, label: myPlace.label, live: !!myLive } : null}
            />
          </Suspense>
        )}

        <div className="mt-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-display text-2xl">
              {nearbyMode ? "Members nearby" : cityLabel || "Around the world"}
            </h3>
            <p className="text-xs text-white/60">
              {nearbyMode
                ? `${nearbyDeck.length} within ${NEARBY_KM} km of ${myPlace?.label.split(",")[0] || "you"}${myArea ? " · using your live area" : " · by profile city"}`
                : `${here.length} ${here.length === 1 ? "member" : "members"} ${cityLabel ? "here" : "on the globe"}${here.some((p) => p.live) ? ` · ${here.filter((p) => p.live).length} here live` : ""}`}
              {search ? ` · matching “${search}”` : ""}
              {openFilterLabel ? ` · open to ${openFilterLabel}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {city && !nearbyMode && (
              <button type="button" className="min-h-11 text-xs text-white/70 underline" onClick={() => setCity(null)}>
                <Globe2 size={14} className="mr-1 inline" />
                All cities
              </button>
            )}
            <button type="button" className="min-h-11 text-xs font-medium text-[#ff9fc8]" onClick={() => setListOpen(true)}>
              See all{list.length ? ` ${list.length}` : ""}
            </button>
          </div>
        </div>

        <AvatarRow
          people={shownDeck}
          label={nearbyMode ? "Members nearby" : `Members ${cityLabel ? `in ${cityLabel}` : "around the world"}`}
          onPick={(id) => setFocus({ id, at: Date.now() })}
        />

        </div>
        <div className="mt-4 min-w-0 lg:mt-0">
          {loading ? (
            <div className="h-[min(560px,68dvh)] w-[86%] max-w-[380px] animate-pulse rounded-[28px] bg-white/5" role="status" aria-label="Finding creatives" />
          ) : failed ? (
            <div role="alert" className="py-8 text-center">
              <p>People did not load.</p>
              <button type="button" className="min-h-11 underline" onClick={() => { void members.refetch(); void signals.refetch(); }}>Try again</button>
            </div>
          ) : shownDeck.length ? (
            <>
            {hint && !nearbyMode && (
              <div ref={hintRef} role="note" className="mb-3 flex max-w-[380px] items-start gap-3 rounded-2xl border border-[#ff9fc8]/40 bg-[#ff9fc8]/10 p-3 text-sm">
                <UserPlus size={18} className="mt-0.5 shrink-0 text-[#ff9fc8]" aria-hidden />
                <p className="min-w-0 flex-1">
                  These are real members{cityLabel ? ` in ${cityLabel}` : ""}. Tap <strong>Connect</strong> on anyone you'd make something with. If they connect back, a chat opens for you both.
                </p>
                <button type="button" className="min-h-11 shrink-0 px-2 text-xs underline" onClick={dismissHint}>
                  Got it
                </button>
              </div>
            )}
            <SwipeDeck
              people={shownDeck}
              focus={focus}
              {...deckProps}
              top={
                <GlobePlaceControl
                  label={nearbyMode ? `Near ${myPlace?.label.split(",")[0] || "you"}` : cityLabel || "Everywhere"}
                  onOpen={() => setPlaceOpen(true)}
                />
              }
            />
            {nearbyMode && myPlace ? (
              <TravelingToCity cityKey={myPlace.key} label={myPlace.label} />
            ) : (
              city && !city.startsWith(REGION) && cityLabel && <TravelingToCity cityKey={city} label={cityLabel} />
            )}
            </>
          ) : (
            <div className="rounded-[28px] border border-dashed border-white/15 px-6 py-10 text-center">
              <div className="mb-4 flex justify-center">
                <GlobePlaceControl label={nearbyMode ? "Nearby" : cityLabel || "Everywhere"} onOpen={() => setPlaceOpen(true)} />
              </div>
              <p className="font-display text-xl">
                {openFilterLabel && !search
                  ? `Nobody here is open to ${openFilterLabel} yet`
                  : search
                  ? `Nobody here matches “${search}”`
                  : nearbyMode
                    ? `No one else near ${myPlace?.label.split(",")[0] || "you"} yet`
                    : cityLabel ? `No one on the globe in ${cityLabel} yet` : "No one else on the globe yet"}
              </p>
              <p className="mt-2 text-sm text-white/60">
                {nearbyMode ? "Switch to Global to see every city." : list.length ? `${list.length} ${list.length === 1 ? "member matches" : "members match"} in See all.` : "Try another city or a different search."}
              </p>
            </div>
          )}
        </div>

        </div>

        {!!(matches.data?.length || openNudges.length) && (
          <div className="mt-5 border-t border-white/10 pt-4">
            {!!matches.data?.length && (
              <>
            <h3 className="mb-2 text-[10px] uppercase tracking-[.25em] text-white/60">Your matches</h3>
            <ul className="space-y-2">
              {matches.data.map((m) => {
                const nudge = personNudge(nudges, m.user_id);
                return (
                <li key={m.user_id} className="space-y-1">
                  <div className="flex items-center justify-between gap-3">
                  <Link className="flex min-h-11 items-center text-sm" to={`/messages?conversation=${m.conversation_id}`}>
                    {m.display_name || "Creative"} · Open chat
                  </Link>
                  <button
                    type="button"
                    disabled={unmatch.isPending}
                    className="min-h-11 text-xs text-white/50"
                    onClick={() => {
                      if (window.confirm("Unmatch? You will both need to connect again to unlock matches-only DMs.")) unmatch.mutate(m.user_id);
                    }}
                  >
                    Unmatch
                  </button>
                  </div>
                  {nudge && <ConnectNudgeLine nudge={nudge} viewerId={user?.id} me={myIcebreaker} />}
                </li>
                );
              })}
            </ul>
              </>
            )}
            {!!openNudges.length && (
              <div className={matches.data?.length ? "mt-4" : ""}>
                <h3 className="mb-2 text-[10px] uppercase tracking-[.25em] text-white/60">Start something</h3>
                <ul className="space-y-2">
                  {openNudges.map((nudge) => (
                    <li key={nudge.userId}>
                      <ConnectNudgeLine nudge={nudge} viewerId={user?.id} me={myIcebreaker} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        <p className="mt-4 text-[11px] leading-relaxed text-white/45">
          Members appear at their profile city unless they hide themselves in settings. Live cities and live areas (about 1 km, never an exact spot) are opt-in and expire. Globe data:{" "}
          <a className="underline" href="https://www.geonames.org/" target="_blank" rel="noopener noreferrer">GeoNames</a>,{" "}
          <a className="underline" href="https://www.naturalearthdata.com/" target="_blank" rel="noopener noreferrer">Natural Earth</a>.
        </p>
      </section>

      <Sheet open={listOpen} onOpenChange={setListOpen}>
        <SheetContent side="bottom" className="max-h-[88dvh] rounded-t-[28px] px-4 pb-8">
          <SheetTitle className="ether-title pr-10 text-[22px]">{cityLabel ? `Everyone in ${cityLabel}` : "Everyone"} · {list.length}</SheetTitle>
          <SheetDescription className="mb-4 text-sm text-muted-foreground">Every member{search ? ` matching “${search}”` : ""}{openFilterLabel ? ` open to ${openFilterLabel}` : ""}, including people who hide from the globe.</SheetDescription>
          {members.isPending ? (
            <p role="status" className="text-sm text-muted-foreground">Loading members…</p>
          ) : list.length ? (
            <MemberGrid people={list} resetKey={`${city}|${search}|${openFilter.join(",")}`} />
          ) : (
            <div className="file-panel flex flex-col items-center gap-2 p-6 text-center">
              <Users className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No members match{search ? ` “${search}”` : ""}{cityLabel ? ` in ${cityLabel}` : ""}.</p>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={!!sheetCity} onOpenChange={(open) => !open && setSheetCity(null)}>
        <SheetContent
          side="bottom"
          className="max-h-[92dvh] rounded-t-[28px] border-white/10 bg-[#1d1a22] px-4 pb-8 text-[#faf5f0]"
          style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))" }}
        >
          <div className="mx-auto mb-3 mt-1 h-1 w-10 rounded-full bg-white/20" aria-hidden="true" />
          <p className="text-[10px] uppercase tracking-[.25em] text-[#ff9fc8]">{sheetDeck.length} {sheetDeck.length === 1 ? "member" : "members"}</p>
          <SheetTitle className="pr-10 font-display text-[26px] font-normal leading-tight text-[#faf5f0]">Members in {sheetLabel}</SheetTitle>
          <SheetDescription className="text-xs text-white/60">Connect with anyone you would make something with. If they connect back, a chat opens.</SheetDescription>
          <AvatarRow people={sheetDeck} label={`Members in ${sheetLabel}`} onPick={(id) => setSheetFocus({ id, at: Date.now() })} />
          <div className="mt-4">
            {sheetDeck.length ? (
              <SwipeDeck people={sheetDeck} focus={sheetFocus} {...deckProps} />
            ) : (
              <p className="py-8 text-center text-sm text-white/60">No one else on the globe here yet.</p>
            )}
          </div>
          {sheetCity && !sheetCity.startsWith(REGION) && sheetLabel && <TravelingToCity cityKey={sheetCity} label={sheetLabel} />}
        </SheetContent>
      </Sheet>

      <FeedLocationPicker
        open={placeOpen}
        onOpenChange={setPlaceOpen}
        current={city ? { key: city, label: cityLabel || city } : null}
        home={myPlace ? { key: myPlace.key, label: myPlace.label } : null}
        members={placeChoices.cities}
        regions={placeChoices.regions}
        title="Whose cards to show"
        description="Pick a city or a state. Cards show members whose profile, live city or trip is there."
        onPick={(place) => {
          setMode("global");
          setCity(place?.key ?? null);
        }}
      />
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discovery settings</DialogTitle>
            <DialogDescription>Choose how members find you on the globe and who can message you.</DialogDescription>
          </DialogHeader>
          <DiscoveryPreferences />
        </DialogContent>
      </Dialog>
      {reporting && (
        <ReportDialog open onOpenChange={(open) => !open && setReporting(null)} targetType="profile" targetId={reporting.user_id} />
      )}
      <ConnectMomentHost
        viewerId={user?.id}
        viewer={me ? { name: me.name, avatarUrl: me.avatar_url } : { name: "You", avatarUrl: null }}
        me={myIcebreaker}
        event={moment}
        onClear={() => setMoment(null)}
      />
      {ctaPerson && (
        <ConnectCtaSheet
          open
          nudge={
            personNudge(nudges, ctaPerson.user_id)
            || nudgeFromPerson(
              ctaPerson,
              !!matches.data?.some((m) => m.user_id === ctaPerson.user_id),
              matches.data?.find((m) => m.user_id === ctaPerson.user_id)?.conversation_id || null,
            )
          }
          me={myIcebreaker}
          viewerId={user?.id}
          onOpenChange={(open) => {
            if (!open) setCtaPerson(null);
          }}
        />
      )}
    </>
  );
}

