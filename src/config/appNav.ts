import {
  Calendar,
  Crown,
  FolderKanban,
  Heart,
  Radio,
  Shirt,
  ShoppingBag,
  Store,
  Video,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface AppNavItem {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
}

/** Destinations that used to compete for the bottom bar. They live in More. */
export const moreNavItems: AppNavItem[] = [
  { id: "projects", label: "Projects", path: "/projects", icon: FolderKanban },
  { id: "calendar", label: "Calendar", path: "/calendar", icon: Calendar },
  { id: "store", label: "Store", path: "/store", icon: Store },
  { id: "mall", label: "Mall", path: "/mall", icon: ShoppingBag },
  { id: "wallet", label: "Wallet", path: "/wallet", icon: Wallet },
  { id: "fund", label: "Fund", path: "/fund", icon: Heart },
  { id: "membership", label: "Membership", path: "/membership", icon: Crown },
  { id: "live", label: "Live", path: "/live", icon: Video },
  { id: "cinema", label: "Cinema", path: "/cinema", icon: Radio },
  { id: "nuance", label: "Nuance", path: "/nuance", icon: Shirt },
];
