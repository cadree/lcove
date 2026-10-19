import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { STORE_PUBLIC_COLUMNS } from "@/hooks/useStore";
import lcoveMark from "@/assets/lcove-mark-cutout.png";

type MallKind = "creators" | "clothing" | "studios";

interface MallCard {
  id: string;
  name: string;
  kind: MallKind;
  kindLabel: string;
  countLabel: string;
  to?: string;
  image?: string | null;
  mark?: string | null;
  example?: boolean;
}

const FILTERS: { id: "all" | MallKind; label: string }[] = [
  { id: "all", label: "All" },
  { id: "creators", label: "Creators" },
  { id: "clothing", label: "Clothing" },
  { id: "studios", label: "Studios" },
];

function kindForStore(name: string, description: string | null): MallKind {
  const text = `${name} ${description ?? ""}`.toLowerCase();
  if (text.includes("studio")) return "studios";
  if (text.includes("cloth") || text.includes("denim") || text.includes("wear")) return "clothing";
  return "creators";
}

const EXAMPLES: MallCard[] = [
  {
    id: "example-studio",
    name: "Example Studio",
    kind: "studios",
    kindLabel: "Studio",
    countLabel: "Example",
    example: true,
  },
  {
    id: "example-line",
    name: "Example Line",
    kind: "creators",
    kindLabel: "Creator",
    countLabel: "Example",
    example: true,
  },
];

export function CommunityMall({ query = "" }: { query?: string }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const { data: stores = [] } = useQuery({
    queryKey: ["explore-mall-stores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select(STORE_PUBLIC_COLUMNS)
        .eq("is_active", true)
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const cards = useMemo(() => {
    const live: MallCard[] = stores.map((store) => {
      const kind = kindForStore(store.name, store.description);
      return {
        id: store.id,
        name: store.name,
        kind,
        kindLabel: kind === "studios" ? "Studio" : kind === "clothing" ? "Clothing" : "Creator",
        countLabel: "Open",
        to: "/mall",
        image: store.cover_image_url,
        mark: store.logo_url,
      };
    });
    const nuance: MallCard = {
      id: "nuance",
      name: "Nuance by LCOVE",
      kind: "clothing",
      kindLabel: "Clothing",
      countLabel: "Drops",
      to: "/nuance",
      mark: lcoveMark,
    };
    const merged = [...live, nuance].sort((a, b) => a.name.localeCompare(b.name));
    return live.length < 2 ? [...merged, ...EXAMPLES] : merged;
  }, [stores]);

  const needle = query.trim().toLowerCase();
  const visible = cards.filter((card) => {
    if (filter !== "all" && card.kind !== filter) return false;
    if (!needle) return true;
    return card.name.toLowerCase().includes(needle) || card.kindLabel.toLowerCase().includes(needle);
  });

  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 className="ether-title text-[15px] tracking-[0.06em]">Community mall</h2>
        <Link to="/mall" className="mono-label inline-flex min-h-11 items-center text-[10px] text-muted-foreground">
          All stores
        </Link>
      </div>
      <div className="mb-3 flex gap-2 overflow-x-auto scrollbar-hide">
        {FILTERS.map((item) => {
          const active = filter === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`mono-label inline-flex h-11 shrink-0 items-center rounded-full border px-4 text-[11px] ${
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
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {visible.map((card) => {
          const body = (
            <>
              <div className="relative h-[92px] overflow-hidden rounded-t-[16px] bg-[linear-gradient(155deg,hsl(var(--scan)/0.55),hsl(var(--brand)/0.28)_48%,hsl(var(--panel)))]">
                {card.image && <img src={card.image} alt="" className="h-full w-full object-cover" />}
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_28%,rgba(255,255,255,0.28)_48%,transparent_64%)]" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[hsl(var(--panel))] to-transparent" />
                {card.mark && (
                  <img
                    src={card.mark}
                    alt=""
                    className="mark-cutout absolute bottom-2 left-3 h-11 w-11 object-contain"
                  />
                )}
              </div>
              <div className="px-3 pb-3 pt-4">
                <p className="truncate font-body text-[13px] font-extrabold">{card.name}</p>
                <p className="mono-label mt-1 text-[7.5px] text-muted-foreground">{card.kindLabel}</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="mono-label text-[8px] text-muted-foreground">{card.countLabel}</span>
                  {card.example && (
                    <span className="mono-label rounded-full border border-border px-1.5 py-0.5 text-[8px]">Example</span>
                  )}
                </div>
              </div>
            </>
          );
          const className = "file-panel block w-[156px] shrink-0 overflow-hidden text-left shadow-[0_18px_34px_-18px_rgba(0,0,0,0.72),inset_0_1px_0_rgba(255,255,255,0.16)]";
          return card.to && !card.example ? (
            <Link key={card.id} to={card.to} className={className}>
              {body}
            </Link>
          ) : (
            <div key={card.id} className={className}>
              {body}
            </div>
          );
        })}
      </div>
      <Link to="/brand-partners" className="file-panel mt-3 flex min-h-11 items-center justify-between px-4">
        <span className="font-body text-sm font-bold">Brand partners</span>
        <span className="mono-label text-[10px] text-muted-foreground">Row</span>
      </Link>
    </section>
  );
}
