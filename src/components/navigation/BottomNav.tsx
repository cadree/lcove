import { NavLink, useLocation } from "react-router-dom";
import { Compass, Home, MessageCircle, Plus, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCreateFlow } from "@/components/create/CreateFlowContext";

const tabs = [
  { id: "home", label: "Home", to: "/feed", icon: Home, match: (path: string) => path === "/feed" },
  {
    id: "explore",
    label: "Explore",
    to: "/explore",
    icon: Compass,
    match: (path: string) => ["/explore", "/directory", "/portfolios", "/community"].includes(path),
  },
  { id: "messages", label: "Messages", to: "/messages", icon: MessageCircle, match: (path: string) => path.startsWith("/messages") },
  { id: "profile", label: "Profile", to: "/profile", icon: User, match: (path: string) => path.startsWith("/profile") },
];

const BottomNav = () => {
  const location = useLocation();
  const { openCreate } = useCreateFlow();

  const itemClass = (active: boolean) =>
    cn(
      "flex flex-col items-center justify-center gap-0.5 min-h-14 min-w-11 text-[11px] leading-none",
      active ? "text-[hsl(var(--ether-pink))]" : "text-muted-foreground"
    );

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      aria-label="Primary"
    >
      <div className="grid grid-cols-5">
        {tabs.slice(0, 2).map((tab) => {
          const active = tab.match(location.pathname);
          return (
            <NavLink key={tab.id} to={tab.to} className={itemClass(active)} aria-current={active ? "page" : undefined}>
              <tab.icon className="h-5 w-5" strokeWidth={1.5} />
              <span>{tab.label}</span>
            </NavLink>
          );
        })}

        <button type="button" onClick={openCreate} className={itemClass(false)} aria-label="Create">
          <Plus className="h-5 w-5" strokeWidth={1.5} />
          <span>Create</span>
        </button>

        {tabs.slice(2).map((tab) => {
          const active = tab.match(location.pathname);
          return (
            <NavLink key={tab.id} to={tab.to} className={itemClass(active)} aria-current={active ? "page" : undefined}>
              <tab.icon className="h-5 w-5" strokeWidth={1.5} />
              <span>{tab.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
