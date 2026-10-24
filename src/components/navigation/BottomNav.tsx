import { Link, useLocation } from "react-router-dom";
import { Compass, Home, MessageCircle, Plus, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCreateFlow } from "@/components/create/CreateFlowContext";
import { prefetchCreateSheet, prefetchTab } from "@/lib/tabRoutes";

const tabs = [
  { id: "home", label: "Home", to: "/feed", icon: Home, match: (path: string) => path === "/feed" },
  {
    id: "explore",
    label: "Explore",
    to: "/explore",
    icon: Compass,
    match: (path: string) =>
      ["/explore", "/directory", "/portfolios", "/community", "/events", "/mall", "/cinema", "/live", "/collectives"].includes(path) ||
      path.startsWith("/cinema"),
  },
  { id: "messages", label: "Messages", to: "/messages", icon: MessageCircle, match: (path: string) => path.startsWith("/messages") },
  { id: "profile", label: "Profile", to: "/profile", icon: User, match: (path: string) => path === "/profile" || path.startsWith("/profile/") },
];

const BottomNav = () => {
  const location = useLocation();
  const { openCreate } = useCreateFlow();

  const itemClass = (active: boolean) =>
    cn(
      "mono-label flex min-h-11 flex-col items-center justify-center gap-1 px-1 text-[8.5px] tracking-[0.14em]",
      active ? "text-[hsl(var(--bubble))] drop-shadow-[0_0_8px_rgba(255,159,200,0.85)]" : "text-muted-foreground",
    );

  const renderTab = (tab: (typeof tabs)[number]) => {
    const active = tab.match(location.pathname);
    const Icon = tab.icon;
    return (
      <Link
        key={tab.id}
        to={tab.to}
        className={cn(itemClass(active), "relative z-[1] touch-manipulation")}
        aria-current={active ? "page" : undefined}
        onPointerDown={() => prefetchTab(tab.to)}
      >
        <Icon className="h-[22px] w-[22px]" strokeWidth={1.7} />
        <span>{tab.label}</span>
      </Link>
    );
  };

  return (
    <nav
      className="tab-bar fixed bottom-0 left-0 right-0 z-50 border-t border-border"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)", minHeight: "84px" }}
      aria-label="Primary"
    >
      <div className="grid h-[84px] grid-cols-5">
        {tabs.slice(0, 2).map(renderTab)}
        <button
          type="button"
          onPointerDown={() => prefetchCreateSheet()}
          onClick={openCreate}
          className={cn(itemClass(false), "relative z-[1] touch-manipulation")}
          aria-label="Create"
        >
          <span className="flex h-[22px] w-[22px] items-center justify-center rounded-[5px] border border-current">
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          </span>
          <span>Create</span>
        </button>
        {tabs.slice(2).map(renderTab)}
      </div>
    </nav>
  );
};

export default BottomNav;
