import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import PageLayout from "@/components/layout/PageLayout";
import { CommunityMall } from "@/components/explore/CommunityMall";
import { ExploreBrowse } from "@/components/explore/ExploreBrowse";
import { QuestCard } from "@/components/novi/QuestCard";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useNoviQuests } from "@/hooks/useNoviQuests";
import { nextQuest } from "@/lib/noviQuests";
import { shotPeople, shotSessionEnabled } from "@/lib/shotSession";

const segments = [
  { id: "for-you", label: "For you" },
  { id: "browse", label: "Browse" },
  { id: "people", label: "People" },
  { id: "portfolios", label: "Portfolios" },
  { id: "events", label: "Events" },
  { id: "community", label: "Community" },
  { id: "live", label: "Live" },
  { id: "cinema", label: "Cinema" },
  { id: "mall", label: "Mall" },
] as const;

type SegmentId = (typeof segments)[number]["id"];

const destinations: Record<Exclude<SegmentId, "for-you" | "mall" | "browse">, { title: string; detail: string; to: string; extra?: { title: string; detail: string; to: string } }> = {
  people: {
    title: "Directory",
    detail: "Profiles you can open",
    to: "/directory",
  },
  portfolios: {
    title: "Portfolios",
    detail: "Portfolio folders",
    to: "/portfolios",
  },
  events: {
    title: "Events",
    detail: "Community events and the calendar",
    to: "/calendar",
  },
  community: {
    title: "Community",
    detail: "Public updates",
    to: "/community",
    extra: { title: "Collectives", detail: "Groups you can join or start", to: "/collectives" },
  },
  live: {
    title: "Live",
    detail: "Streams happening now",
    to: "/live",
  },
  cinema: {
    title: "Cinema",
    detail: "Networks and screenings",
    to: "/cinema",
  },
};

const Explore = () => {
  const [segment, setSegment] = useState<SegmentId>("for-you");
  const [query, setQuery] = useState("");
  const { quests } = useNoviQuests();
  const openQuest = nextQuest(quests);
  const { data: people = [] } = useQuery({
    queryKey: ["explore-people", query],
    queryFn: async () => {
      if (shotSessionEnabled()) return shotPeople;
      const request = supabase
        .from("profiles_public")
        .select("user_id, display_name, city_display, avatar_url")
        .limit(8);
      const { data, error } = query.trim()
        ? await request.ilike("display_name", `%${query.trim()}%`)
        : await request;
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <PageLayout>
      <div className="mx-auto max-w-3xl px-4 pb-8 pt-4 sm:px-6">
        <header className="pb-3">
          <p className="kicker">In the archive</p>
          <h1 className="ether-title text-[34px]">Explore</h1>
        </header>

        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="SEARCH PEOPLE, CITIES, STORES"
            aria-label="Search people, cities, stores"
            className="h-11 rounded-[14px] pl-10 font-mono text-[11px] uppercase tracking-[0.14em]"
          />
        </div>

        <div className="mb-5 flex gap-2 overflow-x-auto scrollbar-hide">
          {segments.map((item) => {
            const active = segment === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSegment(item.id)}
                className={`mono-label inline-flex h-11 shrink-0 items-center rounded-full border px-3 text-[11px] ${
                  active
                    ? "border-[hsl(var(--scan))] text-foreground shadow-[inset_0_0_12px_rgba(121,195,207,0.35)]"
                    : "border-border text-muted-foreground"
                }`}
                aria-pressed={active}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {segment === "browse" && <ExploreBrowse query={query} />}

        {(segment === "for-you" || segment === "people") && (
          <section className="mb-6">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="ether-title text-[15px]">Find your people</h2>
              <Link to="/directory" className="mono-label text-[9px] text-muted-foreground">Directory</Link>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
              {people.map((person) => (
                <Link
                  key={person.user_id}
                  to={`/profile/${person.user_id}`}
                  className="file-panel flex w-[132px] shrink-0 flex-col items-center px-3 py-4 text-center"
                >
                  <span className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-[conic-gradient(from_120deg,#FF9FC8,#C4142D,#FF9FC8)] p-[2px]">
                    <span className="flex h-full w-full items-center justify-center rounded-full bg-card font-body text-sm font-extrabold">
                      {(person.display_name || "?").charAt(0)}
                    </span>
                  </span>
                  <span className="line-clamp-2 font-body text-[13px] font-extrabold">{person.display_name || "Member"}</span>
                  <span className="mono-label mt-1 text-[8px] text-muted-foreground">{person.city_display || "City open"}</span>
                </Link>
              ))}
            </div>
            {openQuest && segment === "for-you" && <div className="mt-4"><QuestCard quest={openQuest} /></div>}
          </section>
        )}

        {segment !== "for-you" && segment !== "mall" && segment !== "people" && segment !== "browse" && (
          <div className="mb-6 space-y-3">
            <Link to={destinations[segment].to} className="file-panel flex min-h-11 flex-col justify-center px-4 py-4">
              <span className="ether-title text-[22px]">{destinations[segment].title}</span>
              <span className="text-sm text-muted-foreground">{destinations[segment].detail}</span>
            </Link>
            {destinations[segment].extra && (
              <Link to={destinations[segment].extra.to} className="file-panel flex min-h-11 flex-col justify-center px-4 py-4">
                <span className="ether-title text-[22px]">{destinations[segment].extra.title}</span>
                <span className="text-sm text-muted-foreground">{destinations[segment].extra.detail}</span>
              </Link>
            )}
          </div>
        )}

        {segment === "people" && (
          <Link to="/directory" className="file-panel mb-6 flex min-h-11 items-center justify-between px-4">
            <span className="font-body text-sm font-bold">Open the full directory</span>
            <span className="mono-label text-[10px] text-muted-foreground">People</span>
          </Link>
        )}

        {(segment === "for-you" || segment === "mall") && <CommunityMall query={query} />}
      </div>
    </PageLayout>
  );
};

export default Explore;
