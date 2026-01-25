import {
  Compass,
  FolderKanban,
  MessageCircle,
  Calendar,
  Users,
  Radio,
  Film,
  Folder,
  Briefcase,
  Store,
  Wallet,
  Settings,
  Heart,
  Bell,
  User,
  Sparkles,
  ShoppingBag,
  type LucideIcon,
} from "lucide-react";

export type HomeItemCategory = "core" | "discover" | "create" | "business" | "profile";

export interface HomeItem {
  id: string;
  label: string;
  route: string;
  icon: LucideIcon;
  category: HomeItemCategory;
  description?: string;
}

export const homeItems: HomeItem[] = [
  // Core navigation
  { id: "feed", label: "Feed", route: "/feed", icon: Compass, category: "core", description: "Latest updates" },
  { id: "projects", label: "Projects", route: "/projects", icon: FolderKanban, category: "core", description: "Collaborate" },
  { id: "messages", label: "Messages", route: "/messages", icon: MessageCircle, category: "core", description: "Conversations" },
  { id: "calendar", label: "Calendar", route: "/calendar", icon: Calendar, category: "core", description: "Schedule" },
  
  // Discover
  { id: "directory", label: "Directory", route: "/directory", icon: Users, category: "discover", description: "Find creators" },
  { id: "portfolios", label: "Portfolios", route: "/portfolios", icon: Folder, category: "discover", description: "Browse work" },
  { id: "live", label: "Live", route: "/live", icon: Radio, category: "discover", description: "Watch streams" },
  { id: "cinema", label: "Cinema", route: "/cinema", icon: Film, category: "discover", description: "Films & networks" },
  
  // Create
  { id: "pipeline", label: "Pipeline", route: "/pipeline", icon: Briefcase, category: "create", description: "Manage clients" },
  { id: "boards", label: "Boards", route: "/boards", icon: Sparkles, category: "create", description: "Visual planning" },
  
  // Business
  { id: "store", label: "My Store", route: "/store", icon: Store, category: "business", description: "Sell products" },
  { id: "wallet", label: "Wallet", route: "/wallet", icon: Wallet, category: "business", description: "Earnings" },
  { id: "mall", label: "Mall", route: "/mall", icon: ShoppingBag, category: "business", description: "Shop" },
  { id: "fund", label: "Fund", route: "/fund", icon: Heart, category: "business", description: "Community fund" },
  
  // Profile & Settings
  { id: "profile", label: "Profile", route: "/profile", icon: User, category: "profile", description: "Your page" },
  { id: "notifications", label: "Notifications", route: "/notifications", icon: Bell, category: "profile", description: "Updates" },
  { id: "settings", label: "Settings", route: "/settings", icon: Settings, category: "profile", description: "Preferences" },
];

export const categoryLabels: Record<HomeItemCategory, string> = {
  core: "Quick Access",
  discover: "Discover",
  create: "Create",
  business: "Business",
  profile: "You",
};

export const categoryOrder: HomeItemCategory[] = ["core", "discover", "create", "business", "profile"];

export function getItemById(id: string): HomeItem | undefined {
  return homeItems.find((item) => item.id === id);
}

export function getItemsByCategory(category: HomeItemCategory): HomeItem[] {
  return homeItems.filter((item) => item.category === category);
}
