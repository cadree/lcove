import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { 
  Home, MessageCircle, FolderKanban, Search, User, 
  Calendar, Wallet, Settings, Bell, Users, Video, 
  ShoppingBag, Kanban, BookOpen, Radio, Store, Heart
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  id: string;
  icon: LucideIcon;
  label: string;
  path: string;
}

export const allNavItems: NavItem[] = [
  { id: "home", icon: Home, label: "Home", path: "/home" },
  { id: "messages", icon: MessageCircle, label: "Messages", path: "/messages" },
  { id: "projects", icon: FolderKanban, label: "Projects", path: "/projects" },
  { id: "directory", icon: Search, label: "Directory", path: "/directory" },
  { id: "profile", icon: User, label: "Profile", path: "/profile" },
  { id: "calendar", icon: Calendar, label: "Calendar", path: "/calendar" },
  { id: "wallet", icon: Wallet, label: "Wallet", path: "/wallet" },
  { id: "settings", icon: Settings, label: "Settings", path: "/settings" },
  { id: "notifications", icon: Bell, label: "Alerts", path: "/notifications" },
  { id: "community", icon: Users, label: "Community", path: "/community" },
  { id: "live", icon: Video, label: "Live", path: "/live" },
  { id: "mall", icon: ShoppingBag, label: "Mall", path: "/mall" },
  { id: "pipeline", icon: Kanban, label: "Pipeline", path: "/pipeline" },
  { id: "boards", icon: BookOpen, label: "Boards", path: "/boards" },
  { id: "cinema", icon: Radio, label: "Cinema", path: "/cinema" },
  { id: "store", icon: Store, label: "Store", path: "/store" },
  { id: "fund", icon: Heart, label: "Fund", path: "/fund" },
];

const defaultNavIds = ["home", "messages", "projects", "directory", "profile"];
const STORAGE_KEY = "ether-nav-customization";

interface NavCustomization {
  enabledIds: string[];
  order: string[];
}

interface NavCustomizationContextType {
  activeNavItems: NavItem[];
  allNavItems: NavItem[];
  enabledIds: string[];
  toggleNavItem: (id: string) => void;
  reorderNavItems: (newOrder: string[]) => void;
  resetToDefault: () => void;
  isItemEnabled: (id: string) => boolean;
}

const NavCustomizationContext = createContext<NavCustomizationContextType | null>(null);

function getStoredCustomization(): NavCustomization {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed;
    }
  } catch (e) {
    console.error("Failed to parse nav customization:", e);
  }
  return {
    enabledIds: defaultNavIds,
    order: defaultNavIds,
  };
}

interface ProviderProps {
  children: ReactNode;
}

export function NavCustomizationProvider(props: ProviderProps) {
  const [customization, setCustomization] = useState<NavCustomization>(getStoredCustomization);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customization));
  }, [customization]);

  const activeNavItems = customization.order
    .filter(id => customization.enabledIds.includes(id))
    .map(id => allNavItems.find(item => item.id === id))
    .filter((item): item is NavItem => item !== undefined)
    .slice(0, 5);

  const toggleNavItem = useCallback((id: string) => {
    setCustomization(prev => {
      const isEnabled = prev.enabledIds.includes(id);
      let newEnabledIds: string[];
      let newOrder = [...prev.order];
      
      if (isEnabled) {
        if (prev.enabledIds.length <= 3) return prev;
        newEnabledIds = prev.enabledIds.filter(i => i !== id);
      } else {
        if (prev.enabledIds.length >= 5) return prev;
        newEnabledIds = [...prev.enabledIds, id];
        if (!newOrder.includes(id)) {
          newOrder.push(id);
        }
      }
      
      return { enabledIds: newEnabledIds, order: newOrder };
    });
  }, []);

  const reorderNavItems = useCallback((newOrder: string[]) => {
    setCustomization(prev => ({
      ...prev,
      order: newOrder,
    }));
  }, []);

  const resetToDefault = useCallback(() => {
    setCustomization({
      enabledIds: defaultNavIds,
      order: defaultNavIds,
    });
  }, []);

  const isItemEnabled = useCallback((id: string) => {
    return customization.enabledIds.includes(id);
  }, [customization.enabledIds]);

  const contextValue: NavCustomizationContextType = {
    activeNavItems,
    allNavItems,
    enabledIds: customization.enabledIds,
    toggleNavItem,
    reorderNavItems,
    resetToDefault,
    isItemEnabled,
  };

  return React.createElement(
    NavCustomizationContext.Provider,
    { value: contextValue },
    props.children
  );
}

export function useNavCustomization() {
  const context = useContext(NavCustomizationContext);
  if (!context) {
    throw new Error("useNavCustomization must be used within NavCustomizationProvider");
  }
  return context;
}
