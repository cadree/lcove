import { Suspense, lazy, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Globe2, MapPin, Plane, SlidersHorizontal, UserPlus, Users } from "lucide-react";
import { markConnectHintSeen, showConnectHint } from "@/lib/firstRun";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DiscoveryPreferences } from "@/components/discovery/DiscoveryPreferences";
import { ReportDialog } from "@/components/safety/ReportDialog";
import { useUserBlocks } from "@/hooks/useUserBlocks";
import { usePeopleDiscovery } from "@/hooks/usePeopleDiscovery";
import { discovery } from "@/lib/creativeDiscovery";
import {
  REGION, deckFor, inCity, listFor, placeForKey, placeOptions,
  type DiscoverySignal, type Person,
} from "@/lib/peopleDiscovery";
import { safeWebLink } from "@/lib/tripMoney";
import { MemberGrid } from "./MemberGrid";
import { SwipeDeck } from "./SwipeDeck";
import { TravelingToCity } from "./TravelingToCity";
import { supabase } from "@/integrations/supabase/client";

// The globe and its city coordinates (~300 KB) load after the deck renders.
const CreativeGlobe = lazy(() => import("@/components/discovery/CreativeGlobe").then((m) => ({ default: m.CreativeGlobe })));

/**
 * The one people experience: globe, city or state picker, Nearby/Global, the member
 * avatar row, the swipe deck, matches and the full member list share one search and city.
 */
export function PeopleDiscovery({ query, full }: { query: string; full: boolean }) {
  const { user, people, members, signals, settings } = usePeopleDiscovery();
  const { blockUser } = useUserBlocks();
  const cache = useQueryClient();
  const navigate = useNavigate();
  const search = useDeferredValue(query);
  const [city, setCity] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ id: string; at: number } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reporting, setReporting] = useState<Person | null>(null);
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

  const me = people.find((p) => p.user_id === user?.id);
  const myLive = placeForKey(settings.data?.live_city_key);
  const myPlace = myLive || me?.home || null;
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
  useEffect(() => {
    if (!hint || openedHome.current || !myPlace || city) return;
    if (people.some((p) => p.user_id !== user?.id && p.discoverable && inCity(p, myPlace.key))) {
      openedHome.current = true;
      setCity(myPlace.key);
    }
  }, [hint, myPlace, city, people, user?.id]);
  const cityLabel = city
    ? options.cities.find((c) => c.key === city)?.label || options.regions.find((r) => r.key === city)?.label || placeForKey(city)?.label || "This city"
    : null;

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
      if (data.matched && data.conversation_id) {
        // Both people get an in-app notice from the database; this pushes it to the other phone.
        void supabase.functions.invoke("send-push-notification", {
          body: { user_id: person.user_id, notification_type: "match", title: "It's a match", data: { conversation_id: data.conversation_id } },
        }).catch(() => undefined);
        toast.success(`It's a match with ${person.name}. Your chat is ready.`, {
          action: { label: "Open chat", onClick: () => navigate(`/messages?conversation=${data.conversation_id}`) },
        });
      } else if (liked) toast.success(`Connect sent to ${person.name}. They only find out if they connect back.`);
    },
    onError: (e: Error) => {
      toast.error(e.message);
      if (/Show yourself/.test(e.message)) setSettingsOpen(true);
    },
  });
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
    setCity(myPlace.key);
  };

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
        <header className="flex items-start justify-between gap-3">
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

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="flex min-h-11 min-w-0 flex-1 basis-[180px] items-center gap-2 rounded-full bg-white/10 px-3">
            <MapPin size={16} className="shrink-0 text-[#ff9fc8]" />
            <select
              aria-label="Select a city or state"
              value={city || ""}
              onChange={(e) => setCity(e.target.value || null)}
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
              aria-pressed={!!city && city === myPlace?.key}
              onClick={nearby}
              className={`min-h-9 rounded-full px-4 text-sm ${city && city === myPlace?.key ? "bg-[#faf4ed] text-[#1d1a22]" : "text-white/80"}`}
            >
              Nearby
            </button>
            <button
              type="button"
              aria-pressed={!city}
              onClick={() => setCity(null)}
              className={`min-h-9 rounded-full px-4 text-sm ${!city ? "bg-[#faf4ed] text-[#1d1a22]" : "text-white/80"}`}
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

        <div className="lg:mt-2 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-8">
        <div className="min-w-0">
        <Suspense fallback={<div className="mx-auto my-3 aspect-square w-full max-w-[520px] rounded-full bg-white/5" role="status" aria-label="Loading globe" />}>
          <CreativeGlobe
            people={people}
            selected={city}
            onSelect={setCity}
            me={myPlace ? { key: myPlace.key, label: myPlace.label, live: !!myLive } : null}
          />
        </Suspense>

        <div className="mt-1 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-display text-2xl">{cityLabel || "Around the world"}</h3>
            <p className="text-xs text-white/60">
              {here.length} {here.length === 1 ? "member" : "members"} on the globe
              {here.some((p) => p.live) ? ` · ${here.filter((p) => p.live).length} here live` : ""}
              {search ? ` · matching “${search}”` : ""}
            </p>
          </div>
          {city && (
            <button type="button" className="min-h-11 shrink-0 text-xs text-white/70 underline" onClick={() => setCity(null)}>
              <Globe2 size={14} className="mr-1 inline" />
              All cities
            </button>
          )}
        </div>

        {!!deck.length && (
          <ul className="-mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-1 scrollbar-hide" aria-label={`Members ${cityLabel ? `in ${cityLabel}` : "around the world"}`}>
            {deck.slice(0, 30).map((person) => (
              <li key={person.user_id} className="shrink-0">
                <button
                  type="button"
                  className="flex w-14 flex-col items-center gap-1"
                  onClick={() => setFocus({ id: person.user_id, at: Date.now() })}
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
        )}

        </div>
        <div className="mt-4 min-w-0 lg:mt-0">
          {loading ? (
            <div className="h-[min(560px,68dvh)] w-[86%] max-w-[380px] animate-pulse rounded-[28px] bg-white/5" role="status" aria-label="Finding creatives" />
          ) : failed ? (
            <div role="alert" className="py-8 text-center">
              <p>People did not load.</p>
              <button type="button" className="min-h-11 underline" onClick={() => { void members.refetch(); void signals.refetch(); }}>Try again</button>
            </div>
          ) : deck.length ? (
            <>
            {hint && (
              <div ref={hintRef} role="note" className="mb-3 flex max-w-[380px] items-start gap-3 rounded-2xl border border-[#ff9fc8]/40 bg-[#ff9fc8]/10 p-3 text-sm">
                <UserPlus size={18} className="mt-0.5 shrink-0 text-[#ff9fc8]" aria-hidden />
                <p className="min-w-0 flex-1">
                  These are real members{cityLabel ? ` in ${cityLabel}` : ""}. Tap <strong>Connect</strong> on anyone you'd make something with. If they connect back, it's a match and a chat opens.
                </p>
                <button type="button" className="min-h-11 shrink-0 px-2 text-xs underline" onClick={dismissHint}>
                  Got it
                </button>
              </div>
            )}
            <SwipeDeck
              people={deck}
              focus={focus}
              pending={swipe.isPending}
              onDecide={(person, liked) => {
                if (hint) dismissHint();
                return swipe.mutateAsync({ person, liked }).catch(() => undefined);
              }}
              onReport={setReporting}
              onBlock={(person) => {
                if (window.confirm(`Block ${person.name}? They disappear from discovery and any match is removed.`))
                  blockUser.mutate(person.user_id, {
                    onSuccess: () => void cache.invalidateQueries({ queryKey: ["discovery-globe"] }),
                    onError: (e: Error) => toast.error(e.message),
                  });
              }}
            />
            {city && !city.startsWith("region:") && cityLabel && <TravelingToCity cityKey={city} label={cityLabel} />}
            </>
          ) : (
            <div className="rounded-[28px] border border-dashed border-white/15 px-6 py-10 text-center">
              <p className="font-display text-xl">{search ? `Nobody on the globe matches “${search}”` : cityLabel ? `No one on the globe in ${cityLabel} yet` : "No one else on the globe yet"}</p>
              <p className="mt-2 text-sm text-white/60">{list.length ? `${list.length} ${list.length === 1 ? "member matches" : "members match"} in the list below.` : "Try another city or a different search."}</p>
            </div>
          )}
        </div>

        </div>

        {!!matches.data?.length && (
          <div className="mt-5 border-t border-white/10 pt-4">
            <h3 className="mb-2 text-[10px] uppercase tracking-[.25em] text-white/60">Your matches</h3>
            <ul className="space-y-1">
              {matches.data.map((m) => (
                <li key={m.user_id} className="flex items-center justify-between gap-3">
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
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="mt-4 text-[11px] leading-relaxed text-white/45">
          Members appear at their profile city unless they hide themselves in settings. Live cities are opt-in, city-level and expire. Map data:{" "}
          <a className="underline" href="https://www.geonames.org/" target="_blank" rel="noopener noreferrer">GeoNames</a>,{" "}
          <a className="underline" href="https://www.naturalearthdata.com/" target="_blank" rel="noopener noreferrer">Natural Earth</a>.
        </p>
      </section>

      <section aria-labelledby="members-title" className="mt-6">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="kicker">Directory</p>
            <h2 id="members-title" className="ether-title text-[22px]">
              {cityLabel ? `Everyone in ${cityLabel}` : "Everyone"} · {list.length}
            </h2>
          </div>
          {!full && list.length > 6 && (
            <Link to="/explore?section=people" className="mono-label min-h-11 content-center text-[10px] text-muted-foreground">See all</Link>
          )}
        </div>
        {members.isPending ? (
          <p role="status" className="text-sm text-muted-foreground">Loading members…</p>
        ) : list.length ? (
          <MemberGrid people={full ? list : list.slice(0, 6)} resetKey={`${city}|${search}`} />
        ) : (
          <div className="file-panel flex flex-col items-center gap-2 p-6 text-center">
            <Users className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No members match{search ? ` “${search}”` : ""}{cityLabel ? ` in ${cityLabel}` : ""}.</p>
          </div>
        )}
      </section>

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
    </>
  );
}

