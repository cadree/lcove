import { useState } from "react";
import { motion } from "framer-motion";
import { 
  Users, 
  Calendar, 
  FolderKanban, 
  Radio, 
  Film,
  Store,
  Wallet,
  MessageCircle,
  Compass,
  Sparkles
} from "lucide-react";
import HomeTopBar from "@/components/home/HomeTopBar";
import WidgetHeroCard from "@/components/home/WidgetHeroCard";
import WidgetStatChip from "@/components/home/WidgetStatChip";
import WidgetAppIcon from "@/components/home/WidgetAppIcon";
import WidgetMiniCard from "@/components/home/WidgetMiniCard";
import WidgetListRow from "@/components/home/WidgetListRow";
import WidgetSectionHeader from "@/components/home/WidgetSectionHeader";
import BottomNav from "@/components/navigation/BottomNav";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { usePlatformStats } from "@/hooks/usePlatformStats";

const appIcons = [
  { title: "Projects", icon: FolderKanban, link: "/projects" },
  { title: "Calendar", icon: Calendar, link: "/calendar" },
  { title: "Community", icon: Users, link: "/community" },
  { title: "Live", icon: Radio, link: "/live" },
];

const quickAccessCards = [
  { title: "Cinema", subtitle: "Films & networks", tag: "Watch", icon: Film, link: "/cinema" },
  { title: "Mall", subtitle: "Creator stores", tag: "Shop", icon: Store, link: "/mall" },
  { title: "Wallet", subtitle: "Credits & payments", tag: "Manage", icon: Wallet, link: "/wallet" },
  { title: "Messages", subtitle: "Conversations", tag: "Chat", icon: MessageCircle, link: "/messages" },
];

const exploreItems = [
  { title: "Directory", subtitle: "Find collaborators", icon: Users, link: "/directory" },
  { title: "Feed", subtitle: "Community updates", icon: Compass, link: "/feed" },
  { title: "Featured", subtitle: "Spotlight creators", icon: Sparkles, link: "/directory" },
];

const Index = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { data: stats } = usePlatformStats();

  const statChips = [
    { value: stats?.totalCreatives || "—", label: "Creators" },
    { value: stats?.totalProjects || "—", label: "Projects" },
    { value: stats?.totalCities || "—", label: "Cities" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Subtle ambient gradient */}
      <div className="fixed inset-0 bg-gradient-to-b from-primary/[0.02] via-transparent to-transparent pointer-events-none" />
      
      {/* Top Bar */}
      <HomeTopBar 
        onMenuClick={() => setDrawerOpen(true)} 
        subtitle="Home"
      />
      
      {/* Main Content */}
      <main className="relative pb-28 space-y-4">
        {/* Hero Card */}
        <WidgetHeroCard 
          badge="Welcome"
          headline="Create. Connect. Collaborate."
          subtext="Your creative journey starts here"
          ctaText="Get Started"
          ctaLink="/auth"
        />

        {/* Stats Row */}
        <WidgetStatChip stats={statChips} />

        {/* App Icons Section */}
        <section className="pt-2">
          <WidgetSectionHeader title="Quick Launch" />
          <div className="flex justify-center gap-4 px-4">
            {appIcons.map((item, index) => (
              <WidgetAppIcon 
                key={item.title}
                {...item}
                index={index}
              />
            ))}
          </div>
        </section>

        {/* Quick Access Cards */}
        <section className="pt-4">
          <WidgetSectionHeader 
            title="Quick Access"
            link="/feed"
            linkText="More"
          />
          <div className="grid grid-cols-2 gap-3 px-4">
            {quickAccessCards.map((item, index) => (
              <WidgetMiniCard 
                key={item.title}
                {...item}
                index={index}
              />
            ))}
          </div>
        </section>

        {/* Explore Section */}
        <section className="pt-4">
          <WidgetSectionHeader 
            title="Explore"
            link="/feed"
          />
          <div className="space-y-1 px-0">
            {exploreItems.map((item, index) => (
              <WidgetListRow 
                key={item.title}
                {...item}
                index={index}
              />
            ))}
          </div>
        </section>
      </main>

      {/* Bottom Navigation */}
      <BottomNav />

      {/* Menu Drawer */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="font-display">Menu</DrawerTitle>
            <DrawerDescription>Navigate Ether</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-8 space-y-2">
            {[
              { title: "Feed", link: "/feed" },
              { title: "Directory", link: "/directory" },
              { title: "Projects", link: "/projects" },
              { title: "Calendar", link: "/calendar" },
              { title: "Live", link: "/live" },
              { title: "Cinema", link: "/cinema" },
              { title: "Mall", link: "/mall" },
              { title: "Wallet", link: "/wallet" },
              { title: "Settings", link: "/settings" },
            ].map((item) => (
              <a
                key={item.title}
                href={item.link}
                className="block px-4 py-3 rounded-xl text-foreground hover:bg-accent/30 transition-colors tap-target"
                onClick={() => setDrawerOpen(false)}
              >
                {item.title}
              </a>
            ))}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default Index;
