import { Calendar, FolderKanban, SunMedium, Wallet, type LucideIcon } from "lucide-react";

export interface StudioShortcut {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
}

export const studioShortcuts: StudioShortcut[] = [
  { id: "today", label: "Today", path: "/today", icon: SunMedium },
  { id: "projects", label: "Projects", path: "/projects", icon: FolderKanban },
  { id: "calendar", label: "Calendar", path: "/calendar", icon: Calendar },
  { id: "wallet", label: "Wallet", path: "/wallet", icon: Wallet },
];
