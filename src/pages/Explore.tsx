import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import PageLayout from "@/components/layout/PageLayout";
import { CommunityMall } from "@/components/explore/CommunityMall";
import { ExploreBrowse } from "@/components/explore/ExploreBrowse";
import { PeopleDiscovery } from "@/components/people/PeopleDiscovery";
import { QuestCard } from "@/components/novi/QuestCard";
import { Input } from "@/components/ui/input";
import { useNoviQuests } from "@/hooks/useNoviQuests";
import { homeQuestCard } from "@/lib/noviQuests";

const sections = [
  { id: "for-you", label: "For you" },
  { id: "people", label: "People" },
  { id: "browse", label: "Reels & posts" },
  { id: "mall", label: "Mall" },
] as const;
type SectionId = (typeof sections)[number]["id"];

const elsewhere = [
  { label: "Events", to: "/calendar" },
  { label: "Live", to: "/live" },
  { label: "Community", to: "/community" },
  { label: "Collectives", to: "/collectives" },
  { label: "Cinema", to: "/cinema" },
  { label: "Portfolios", to: "/portfolios" },
  { label: "Travel", to: "/travel" },
];

function isSection(value: string | null): value is SectionId {
  return sections.some((s) => s.id === value);
}

const Explore = () => {
  const [params, setParams] = useSearchParams();
  const section: SectionId = isSection(params.get("section")) ? (params.get("section") as SectionId) : "for-you";
  const [query, setQuery] = useState(params.get("q") || "");
  const { quests } = useNoviQuests();
  const openQuest = homeQuestCard(quests);
  const choose = (id: SectionId) => {
    const next = new URLSearchParams(params);
    if (id === "for-you") next.delete("section");
    else next.set("section", id);
    setParams(next, { replace: true });
    window.scrollTo({ top: 0 });
  };
  const chip = (active: boolean) =>
    `mono-label inline-flex h-11 shrink-0 items-center rounded-full border px-3 text-[11px] ${
      active
        ? "border-[hsl(var(--scan))] text-foreground shadow-[inset_0_0_12px_rgba(121,195,207,0.35)]"
        : "border-border text-muted-foreground"
    }`;

  return (
    <PageLayout>
      <div className="mx-auto max-w-3xl px-4 pb-8 pt-4 sm:px-6 lg:max-w-5xl">
        <header className="pb-3">
          <p className="kicker">In the archive</p>
          <h1 className="ether-title text-[34px]">Explore</h1>
        </header>

        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="SEARCH PEOPLE, CITIES, STORES"
            aria-label="Search people, cities, stores"
            className="h-11 rounded-[14px] pl-10 font-mono text-[11px] uppercase tracking-[0.14em]"
          />
        </div>

        <nav aria-label="Explore sections" className="mb-5 flex gap-2 overflow-x-auto scrollbar-hide">
          {sections.map((item) => (
            <button key={item.id} type="button" onClick={() => choose(item.id)} className={chip(section === item.id)} aria-pressed={section === item.id}>
              {item.label}
            </button>
          ))}
          <span className="mx-1 w-px shrink-0 self-stretch bg-border" aria-hidden="true" />
          {elsewhere.map((item) => (
            <Link key={item.to} to={item.to} className={chip(false)}>
              {item.label}
            </Link>
          ))}
        </nav>

        {(section === "for-you" || section === "people") && (
          <PeopleDiscovery query={query} full={section === "people"} />
        )}

        {section === "for-you" && openQuest && <div className="mt-6"><QuestCard quest={openQuest} /></div>}

        {section === "for-you" && (
          <section aria-labelledby="browse-title" className="mt-8">
            <div className="mb-2 flex items-end justify-between">
              <h2 id="browse-title" className="ether-title text-[22px]">Reels & posts</h2>
              <button type="button" onClick={() => choose("browse")} className="mono-label min-h-11 text-[10px] text-muted-foreground">See all</button>
            </div>
            <ExploreBrowse query={query} />
          </section>
        )}
        {section === "browse" && <ExploreBrowse query={query} />}

        {(section === "for-you" || section === "mall") && (
          <div className="mt-8">
            <CommunityMall query={query} />
          </div>
        )}
      </div>
    </PageLayout>
  );
};

export default Explore;
