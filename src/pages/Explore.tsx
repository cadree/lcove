import { useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import PageLayout from "@/components/layout/PageLayout";
import { CommunityMall } from "@/components/explore/CommunityMall";
import { Input } from "@/components/ui/input";

const segments = [
  { id: "for-you", label: "For you" },
  { id: "people", label: "People" },
  { id: "portfolios", label: "Portfolios" },
  { id: "events", label: "Events" },
  { id: "community", label: "Community" },
  { id: "live", label: "Live" },
  { id: "cinema", label: "Cinema" },
  { id: "mall", label: "Mall" },
] as const;

type SegmentId = (typeof segments)[number]["id"];

const destinations: Record<Exclude<SegmentId, "for-you" | "mall">, { title: string; detail: string; to: string; extra?: { title: string; detail: string; to: string } }> = {
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

        {(segment === "for-you" || segment === "people") && (
          <Link to="/directory" className="file-panel mb-6 flex min-h-[88px] items-center justify-between gap-3 px-4 py-4">
            <span>
              <span className="mono-label block text-[9px] text-[hsl(var(--bubble))]">Directory</span>
              <span className="ether-title mt-1 block text-[20px]">Find your people</span>
              <span className="mt-1 block text-sm text-muted-foreground">Open the directory</span>
            </span>
            <span className="mono-label rounded-full border border-[hsl(var(--bubble))] px-3 py-2 text-[10px] text-foreground">
              People
            </span>
          </Link>
        )}

        {segment !== "for-you" && segment !== "mall" && segment !== "people" && (
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
