import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  Clapperboard,
  Crown,
  FolderKanban,
  Handshake,
  Heart,
  LayoutDashboard,
  Radio,
  Search,
  Shirt,
  ShoppingBag,
  Store,
  SunMedium,
  Ticket,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { SquircleIcon, type IconFill } from "@/components/world/SquircleIcon";
import { useHomeUsage } from "@/hooks/useHomeUsage";
import { isIosApp } from "@/lib/platform";
import type { LucideIcon } from "lucide-react";

interface ToolsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ToolItem {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  fill: IconFill;
  iosHidden?: boolean;
}

const groups: { id: string; label: string; items: ToolItem[] }[] = [
  {
    id: "work",
    label: "Work",
    items: [
      { id: "today", label: "Today", path: "/today", icon: SunMedium, fill: "gold" },
      { id: "projects", label: "Projects", path: "/projects", icon: FolderKanban, fill: "cyan" },
      { id: "pipeline", label: "Pipeline", path: "/pipeline", icon: LayoutDashboard, fill: "denim" },
      { id: "boards", label: "Boards", path: "/boards", icon: LayoutDashboard, fill: "denim" },
      { id: "calendar", label: "Calendar", path: "/calendar", icon: Calendar, fill: "cyan" },
      { id: "booking", label: "Booking", path: "/settings/booking", icon: Ticket, fill: "bone" },
    ],
  },
  {
    id: "money",
    label: "Money",
    items: [
      { id: "wallet", label: "Wallet", path: "/wallet", icon: Wallet, fill: "gold" },
      { id: "store", label: "Store", path: "/store", icon: Store, fill: "gold" },
      { id: "dashboard", label: "Dashboard", path: "/dashboard", icon: Wallet, fill: "pink" },
      { id: "fund", label: "Fund", path: "/fund", icon: Heart, fill: "rose", iosHidden: true },
      { id: "membership", label: "Membership", path: "/membership", icon: Crown, fill: "violet", iosHidden: true },
    ],
  },
  {
    id: "stage",
    label: "Stage",
    items: [
      { id: "events", label: "My events", path: "/dashboard/events", icon: Calendar, fill: "cyan" },
      { id: "tickets", label: "My tickets", path: "/profile", icon: Ticket, fill: "rose" },
      { id: "live", label: "Live", path: "/live", icon: Radio, fill: "red" },
      { id: "cinema", label: "Cinema networks", path: "/cinema", icon: Clapperboard, fill: "ink" },
    ],
  },
  {
    id: "partners",
    label: "Partners",
    items: [
      { id: "partners", label: "Partners", path: "/partners", icon: Handshake, fill: "denim" },
      { id: "brand-partners", label: "Brand partners", path: "/brand-partners", icon: Shirt, fill: "gold" },
      { id: "partner-portal", label: "Partner portal", path: "/partner-portal", icon: Users, fill: "violet" },
    ],
  },
];

export function ToolsSheet({ open, onOpenChange }: ToolsSheetProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const { pinnedItems, recentItems, trackClick } = useHomeUsage();
  const hideIos = isIosApp();

  const visibleGroups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          if (item.iosHidden && hideIos) return false;
          if (!needle) return true;
          return item.label.toLowerCase().includes(needle) || group.label.toLowerCase().includes(needle);
        }),
      }))
      .filter((group) => group.items.length > 0);
  }, [hideIos, query]);

  const openPath = (path: string, id: string) => {
    trackClick(id);
    onOpenChange(false);
    window.setTimeout(() => navigate(path), 160);
  };

  const shortcuts = [
    { label: "Pinned", items: pinnedItems },
    { label: "Recent", items: recentItems },
  ].filter((row) => row.items.length > 0 && !query.trim());

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[88dvh] rounded-t-[28px] border-border bg-card/95 px-4 pb-8 backdrop-blur-xl"
        style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))" }}
        aria-labelledby="tools-sheet-title"
      >
        <div className="mx-auto mb-4 mt-1 h-1 w-10 rounded-full bg-foreground/20" aria-hidden="true" />
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="kicker">Profile</p>
            <SheetTitle id="tools-sheet-title" className="ether-title text-[26px] text-left">
              Tools
            </SheetTitle>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="tap-target inline-flex items-center justify-center text-muted-foreground"
            aria-label="Close tools"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="SEARCH TOOLS"
            aria-label="Search tools"
            className="h-11 rounded-[14px] pl-10 font-mono text-[12px] uppercase tracking-[0.14em]"
          />
        </div>

        {shortcuts.map((row) => (
          <div key={row.label} className="mb-4">
            <p className="mono-label mb-2 text-[10px] text-muted-foreground">{row.label}</p>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              {row.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openPath(item.route, item.id)}
                  className="file-panel flex min-h-11 shrink-0 items-center gap-2 px-3"
                >
                  <item.icon className="h-4 w-4" strokeWidth={1.9} />
                  <span className="font-body text-sm font-semibold">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}

        <div className="space-y-5">
          {visibleGroups.map((group) => (
            <section key={group.id}>
              <p className="mono-label mb-2 text-[10px] text-muted-foreground">{group.label}</p>
              <div className="grid grid-cols-3 gap-2">
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openPath(item.path, item.id)}
                    className="file-panel flex min-h-11 flex-col items-start gap-2 px-2.5 py-3 text-left"
                  >
                    <SquircleIcon icon={item.icon} fill={item.fill} size={34} glyph={17} />
                    <span className="font-body text-[13px] font-semibold leading-tight">{item.label}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
          {visibleGroups.length === 0 && (
            <p className="text-sm text-muted-foreground">No tools match that search.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
