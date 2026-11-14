import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Plane,
  SlidersHorizontal,
  Search,
  MapPin,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import PageLayout from "@/components/layout/PageLayout";
import { CreativeGlobe } from "@/components/discovery/CreativeGlobe";
import { CreativeCard } from "@/components/discovery/CreativeCard";
import { DiscoveryPreferences } from "@/components/discovery/DiscoveryPreferences";
import { discovery } from "@/lib/creativeDiscovery";
import { safeWebLink } from "@/lib/tripMoney";
import { resolveCity } from "@/lib/cities";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function Directory() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();
  const cache = useQueryClient();
  const [city, setCity] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [index, setIndex] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSearch(query), 250);
    return () => clearTimeout(timer);
  }, [query]);
  const result = useInfiniteQuery({
    queryKey: ["discovery", user?.id, city, search],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => discovery.people(city, search, pageParam),
    getNextPageParam: (last, pages) =>
      last.people.length === 30 ? pages.length * 30 : undefined,
    enabled: !!user,
  });
  const matches = useQuery({
    queryKey: ["creative-matches", user?.id],
    queryFn: discovery.matches,
    refetchInterval: 15000,
    enabled: !!user,
  });
  const cities = result.data?.pages[0]?.cities || [];
  const people = result.data?.pages.flatMap((p) => p.people) || [];
  const selected = cities.find((c) => c.city_key === city);
  const railCities =
    selected && !cities.slice(0, 24).includes(selected)
      ? [selected, ...cities.slice(0, 23)]
      : cities.slice(0, 24);
  const chooseCity = (key: string | null) => {
    setCity(key);
    setIndex(0);
  };
  const swipe = useMutation({
    mutationFn: ({ target, liked }: { target: string; liked: boolean }) =>
      discovery.swipe(target, liked),
    onSuccess: async (data) => {
      setIndex((i) => i + 1);
      await cache.invalidateQueries({ queryKey: ["creative-matches"] });
      if (data.matched && data.conversation_id) {
        toast.success("You matched! Your chat is ready.", {
          action: {
            label: "Open chat",
            onClick: () =>
              navigate(`/messages?conversation=${data.conversation_id}`),
          },
        });
      } else
        toast.success(
          "Saved. Your choice stays private until you both connect."
        );
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const unmatch = useMutation({
    mutationFn: discovery.unmatch,
    onSuccess: () =>
      cache.invalidateQueries({ queryKey: ["creative-matches"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <PageLayout>
      <div className="min-h-screen bg-[#24212a] text-[#faf5f0]">
        <div className="mx-auto max-w-4xl px-4 pb-8 pt-4">
          <header className="flex items-center justify-between gap-3">
            <div>
              <Link
                to="/explore"
                className="inline-flex min-h-11 items-center text-xs uppercase tracking-[.2em] text-white/60"
              >
                Ether / Discover
              </Link>
              <h1 className="font-display text-3xl">Find your people.</h1>
            </div>
            <button
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10"
              aria-label="Discovery settings"
              aria-expanded={settingsOpen}
              onClick={() => setSettingsOpen((v) => !v)}
            >
              <SlidersHorizontal size={20} />
            </button>
          </header>
          {settingsOpen && (
            <div className="my-4 rounded-2xl bg-background text-foreground">
              <DiscoveryPreferences />
            </div>
          )}
          <div className="relative z-10 mt-5 flex items-center justify-between gap-3">
            <label className="flex min-h-11 min-w-0 max-w-[55%] items-center gap-2 rounded-full bg-white/15 px-3">
              <MapPin size={16} />
              <select
                aria-label="Select a city or state"
                value={city || ""}
                onChange={(e) => chooseCity(e.target.value || null)}
                className="h-11 min-w-0 bg-transparent text-sm"
              >
                <option className="bg-[#24212a]" value="">
                  All cities
                </option>
                {cities.map((c) => (
                  <option
                    className="bg-[#24212a]"
                    value={c.city_key}
                    key={c.city_key}
                  >
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <Link
              to={
                selected
                  ? `/travel?city=${encodeURIComponent(selected.label)}`
                  : "/travel"
              }
              className="flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-[#ded0bd] px-4 text-sm font-medium text-[#352d31]"
            >
              <Plane size={17} /> Let’s travel
            </Link>
          </div>
          <CreativeGlobe
            cities={cities}
            selected={city}
            onSelect={chooseCity}
          />
          <div className="mb-4 flex w-fit rounded-full bg-white/10 p-1">
            <button
              className={`min-h-11 rounded-full px-5 text-sm ${
                city ? "bg-white/20" : ""
              }`}
              onClick={() => {
                const label = profile?.city_display || profile?.city;
                if (!label) {
                  toast.info(
                    "Add your city in Settings to browse creatives nearby."
                  );
                  setSettingsOpen(true);
                  return;
                }
                const key = resolveCity(label).city_key;
                const found = cities.find(
                  (c) =>
                    c.city_key === key || resolveCity(c.label).city_key === key
                );
                if (!found) {
                  toast.info("No discoverable creatives in your city yet.");
                  return;
                }
                chooseCity(found.city_key);
              }}
            >
              My city
            </button>
            <button
              className={`min-h-11 rounded-full px-5 text-sm ${
                !city ? "bg-white/20" : ""
              }`}
              onClick={() => chooseCity(null)}
            >
              Global
            </button>
          </div>
          <p className="mb-3 text-xs text-white/60">
            Chosen cities, not live locations. Only members who turn on
            discovery appear.
          </p>
          <div
            className="flex snap-x gap-3 overflow-x-auto pb-4"
            aria-label="Cities and states"
          >
            {railCities.map((c) => (
              <button
                key={c.city_key}
                aria-pressed={city === c.city_key}
                onClick={() => chooseCity(c.city_key)}
                className={`relative flex h-48 w-36 shrink-0 snap-start flex-col justify-end overflow-hidden rounded-2xl bg-gradient-to-br from-[#8b7779] to-[#423b4a] p-3 text-left sm:h-56 sm:w-44 ${
                  city === c.city_key ? "ring-2 ring-[#d8eee4] ring-inset" : ""
                }`}
              >
                {safeWebLink(c.image) && (
                  <img
                    src={safeWebLink(c.image)}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover opacity-60"
                  />
                )}
                <span className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                <span className="relative break-words font-display text-xl leading-tight">
                  {c.label.split(",")[0]}
                </span>
                <span className="relative mt-1 text-xs text-white/80">
                  {c.label.split(",").slice(1).join(",").trim()}
                </span>
                <span className="relative mt-2 text-xs">
                  {c.count} creatives
                </span>
              </button>
            ))}
          </div>
          <section className="mt-2 rounded-[30px] bg-[#eee8e0] p-4 text-[#342e37] sm:p-6">
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-[#bfb5bc]" />
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-display text-2xl">
                {selected?.label || "Creatives around the world"}
              </h2>
              <span className="text-xs">
                {people.length
                  ? `${Math.min(index + 1, people.length)} / ${people.length}${
                      result.hasNextPage ? "+" : ""
                    }`
                  : ""}
              </span>
            </div>
            <label className="mb-5 flex items-center gap-2 rounded-xl bg-white/60 px-3">
              <Search size={18} />
              <input
                className="h-11 w-full bg-transparent text-sm outline-none"
                aria-label="Search creatives or cities"
                placeholder="Search name, city or bio"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setIndex(0);
                }}
              />
            </label>
            {!user ? (
              <Link to="/auth" className="underline">
                Sign in to discover creatives
              </Link>
            ) : result.isError ? (
              <div role="alert">
                <p>Discovery is unavailable right now.</p>
                <button
                  className="min-h-11 underline"
                  onClick={() => result.refetch()}
                >
                  Try again
                </button>
              </div>
            ) : result.isPending ? (
              <p role="status">Finding creatives…</p>
            ) : people[index] ? (
              <div className="mx-auto max-w-lg">
                <CreativeCard
                  person={people[index]}
                  pending={swipe.isPending}
                  onSwipe={(liked) =>
                    swipe.mutate({ target: people[index].user_id, liked })
                  }
                />
              </div>
            ) : (
              <div className="py-8 text-center">
                <p>
                  {people.length
                    ? "You’ve reached the end of these profiles."
                    : "No discoverable creatives here yet."}
                </p>
                <button
                  className="min-h-11 underline"
                  onClick={() => setSettingsOpen(true)}
                >
                  Manage your discovery visibility
                </button>
              </div>
            )}
            <div className="mt-4 flex justify-between gap-2">
              <button
                className="flex min-h-11 items-center gap-1 disabled:opacity-30"
                disabled={index === 0 || swipe.isPending}
                onClick={() => setIndex((i) => i - 1)}
              >
                <ChevronLeft size={18} /> Previous
              </button>
              {index + 1 < people.length ? (
                <button
                  className="flex min-h-11 items-center gap-1"
                  onClick={() => setIndex((i) => i + 1)}
                >
                  Browse next <ChevronRight size={18} />
                </button>
              ) : (
                result.hasNextPage && (
                  <button
                    className="min-h-11"
                    disabled={result.isFetchingNextPage}
                    onClick={() => result.fetchNextPage()}
                  >
                    {result.isFetchingNextPage
                      ? "Loading…"
                      : "Load more creatives"}
                  </button>
                )
              )}
            </div>
          </section>
          {!!matches.data?.length && (
            <section className="mt-6">
              <h2 className="mb-2 font-display text-2xl">Your matches</h2>
              {matches.data.map((m) => (
                <div
                  className="flex items-center justify-between gap-3 border-b border-white/10 py-2"
                  key={m.user_id}
                >
                  <Link
                    className="flex min-h-11 items-center"
                    to={`/messages?conversation=${m.conversation_id}`}
                  >
                    {m.display_name || "Creative"} · Open chat
                  </Link>
                  <button
                    disabled={unmatch.isPending}
                    className="min-h-11 text-sm text-white/60"
                    onClick={() => {
                      if (
                        window.confirm(
                          "Unmatch? You will both need to connect again to unlock matches-only DMs."
                        )
                      )
                        unmatch.mutate(m.user_id);
                    }}
                  >
                    Unmatch
                  </button>
                </div>
              ))}
            </section>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
