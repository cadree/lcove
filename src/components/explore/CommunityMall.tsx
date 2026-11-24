import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { STORE_PUBLIC_COLUMNS } from "@/hooks/useStore";
import lcoveMark from "@/assets/lcove-mark-cutout.png";
import { featureOn } from "@/config/features";
import { mallPreviews } from "@/lib/mallCards";

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
  previews?: string[];
}

const FILTERS: { id: "all" | MallKind; label: string }[] = [
  { id: "all", label: "All" },
  { id: "creators", label: "Creators" },
  { id: "clothing", label: "Clothing" },
  { id: "studios", label: "Studios" },
];

function kindForStore(name: string, description: string | null, website: string | null): MallKind {
  const text = `${name} ${description ?? ""} ${website ?? ""}`.toLowerCase();
  if (text.includes("studio")) return "studios";
  if (text.includes("cloth") || text.includes("denim") || text.includes("wear") || text.includes("nuance")) return "clothing";
  return "creators";
}

function isNuanceStore(name: string, website: string | null): boolean {
  const text = `${name} ${website ?? ""}`.toLowerCase();
  return text.includes("nuancebylcove.com") || text.includes("nuance");
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
      const ids = (data ?? []).map((store) => store.id);
      const counts = new Map<string, number>();
      if (ids.length > 0) {
        const { data: items } = await supabase
          .from("store_items")
          .select("store_id, images, created_at")
          .in("store_id", ids)
          .eq("is_active", true)
          .order("created_at", { ascending: false });
        for (const item of items ?? []) {
          counts.set(item.store_id, (counts.get(item.store_id) ?? 0) + 1);
        }
        const previews = mallPreviews(items ?? [], 3);
        return (data ?? []).map((store) => ({ ...store, item_count: counts.get(store.id) ?? 0, previews: previews.get(store.id) ?? [] }));
      }
      return (data ?? []).map((store) => ({ ...store, item_count: 0, previews: [] as string[] }));
    },
  });

  const cards = useMemo(() => {
    const live: MallCard[] = stores.map((store) => {
      const website = store.shopify_store_url;
      const kind = kindForStore(store.name, store.description, website);
      const count = store.item_count ?? 0;
      return {
        id: store.id,
        name: store.name,
        kind,
        kindLabel: kind === "studios" ? "Studio" : kind === "clothing" ? "Clothing" : "Creator",
        countLabel: count > 0 ? `${count} item${count === 1 ? "" : "s"}` : "Open",
        to: `/store?store=${store.id}`,
        image: store.cover_image_url || store.previews[0] || null,
        mark: store.logo_url,
        previews: store.previews,
      };
    });
    const hasNuance = stores.some((store) => isNuanceStore(store.name, store.shopify_store_url));
    const nuance: MallCard = {
      id: "nuance",
      name: "Nuance by LCOVE",
      kind: "clothing",
      kindLabel: "Clothing",
      countLabel: "Drops",
      to: "/nuance",
      mark: lcoveMark,
    };
    const merged = [...live, ...(hasNuance ? [] : [nuance])].sort((a, b) => a.name.localeCompare(b.name));
    // Example stores only fill an empty mall when the flag is on; real members never see them otherwise.
    return featureOn("exampleContent") && live.length < 2 ? [...merged, ...EXAMPLES] : merged;
  }, [stores]);

  const needle = query.trim().toLowerCase();
  const visible = cards.filter((card) => {
    if (filter !== "all" && card.kind !== filter) return false;
    if (!needle) return true;
    return card.name.toLowerCase().includes(needle) || card.kindLabel.toLowerCase().includes(needle);
  });

  const kinds = new Set(cards.map((card) => card.kind));
  const filters = FILTERS.filter((item) => item.id === "all" || kinds.has(item.id));

  if (cards.length === 0) return null;

  return (
    <section aria-labelledby="mall-title">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="kicker">Made by members</p>
          <h2 id="mall-title" className="ether-title text-[22px]">Community mall</h2>
        </div>
        <Link to="/mall" className="mono-label inline-flex min-h-11 items-center text-[10px] text-muted-foreground">
          All stores
        </Link>
      </div>
      {filters.length > 2 && (
        <div className="mb-3 flex gap-2 overflow-x-auto scrollbar-hide">
          {filters.map((item) => {
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
      )}
      {visible.length === 0 ? (
        <p className="file-panel px-4 py-6 text-center text-sm text-muted-foreground">No stores match “{query.trim()}”.</p>
      ) : (
        <div className="-mx-4 flex items-start snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide sm:mx-0 sm:px-0">
          {visible.map((card) => {
            const body = (
              <>
                <div className="relative aspect-[4/3] overflow-hidden bg-[linear-gradient(155deg,hsl(var(--scan)/0.55),hsl(var(--brand)/0.28)_48%,hsl(var(--panel)))]">
                  {card.image && <img src={card.image} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />}
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_30%,rgba(255,255,255,0.18)_48%,transparent_62%)]" />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[hsl(var(--panel))] via-[hsl(var(--panel)/0.6)] to-transparent" />
                  <span className="mono-label absolute right-3 top-3 rounded-full bg-black/55 px-2 py-1 text-[8px] text-white backdrop-blur">{card.kindLabel}</span>
                  <div className="absolute inset-x-3 bottom-3 flex items-end gap-3">
                    {card.mark && (
                      <img src={card.mark} alt="" className="mark-cutout h-12 w-12 shrink-0 rounded-[12px] bg-black/40 object-contain p-1 backdrop-blur" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-body text-[17px] font-extrabold text-foreground">{card.name}</p>
                      <p className="mono-label text-[9px] text-muted-foreground">{card.countLabel}</p>
                    </div>
                  </div>
                </div>
                {card.previews && card.previews.length > 1 && (
                  <div className="grid grid-cols-3 gap-1.5 p-3 pt-2.5">
                    {card.previews.slice(0, 3).map((src) => (
                      <img key={src} src={src} alt="" loading="lazy" className="aspect-square w-full rounded-[10px] bg-muted object-cover" />
                    ))}
                  </div>
                )}
                {card.example && (
                  <p className="mono-label px-3 pb-3 text-[8px] text-muted-foreground">Example</p>
                )}
              </>
            );
            const className = "group file-panel block w-[78vw] max-w-[300px] shrink-0 snap-start overflow-hidden text-left shadow-[0_24px_44px_-22px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.14)] sm:w-[280px]";
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
      )}
      <Link to="/brand-partners" className="file-panel mt-3 flex min-h-11 items-center justify-between px-4">
        <span className="font-body text-sm font-bold">Brand partners</span>
        <span className="mono-label text-[10px] text-muted-foreground">Row</span>
      </Link>
    </section>
  );
}
