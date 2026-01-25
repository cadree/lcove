import { useState } from "react";
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
  Heart,
  Folder,
  Settings,
  Briefcase
} from "lucide-react";
import HomeTopBar from "@/components/home/HomeTopBar";
import WidgetStatChip from "@/components/home/WidgetStatChip";
import WidgetAppIcon from "@/components/home/WidgetAppIcon";
import WidgetMiniCard from "@/components/home/WidgetMiniCard";
import WidgetSectionHeader from "@/components/home/WidgetSectionHeader";
import { GlobalFAB } from "@/components/navigation/GlobalFAB";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { usePlatformStats } from "@/hooks/usePlatformStats";
import { Link } from "react-router-dom";

// Primary navigation - most used features
const primaryNav = [
  { title: "Feed", icon: Compass, link: "/feed" },
  { title: "Projects", icon: FolderKanban, link: "/projects" },
  { title: "Messages", icon: MessageCircle, link: "/messages" },
  { title: "Calendar", icon: Calendar, link: "/calendar" },
];

// Discover section - explore content
const discoverCards = [
  { title: "Portfolios", subtitle: "Browse work", tag: "Explore", icon: Folder, link: "/portfolios" },
  { title: "Directory", subtitle: "Find creators", tag: "Connect", icon: Users, link: "/directory" },
  { title: "Live", subtitle: "Watch streams", tag: "Live", icon: Radio, link: "/live" },
  { title: "Cinema", subtitle: "Films & networks", tag: "Watch", icon: Film, link: "/cinema" },
];

// Tools section - manage your work
const toolCards = [
  { title: "Pipeline", subtitle: "Client management", tag: "CRM", icon: Briefcase, link: "/pipeline" },
  { title: "My Store", subtitle: "Sell products", tag: "Shop", icon: Store, link: "/store" },
  { title: "Wallet", subtitle: "Credits & earnings", tag: "Finance", icon: Wallet, link: "/wallet" },
  { title: "Settings", subtitle: "Preferences", tag: "Config", icon: Settings, link: "/settings" },
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
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Subtle ambient gradient */}
      <div className="fixed inset-0 bg-gradient-to-b from-primary/[0.02] via-transparent to-transparent pointer-events-none" />
      
      {/* Top Bar */}
      <HomeTopBar 
        onMenuClick={() => setDrawerOpen(true)} 
        subtitle="Home"
      />
      
      {/* Main Content */}
      <main className="relative pb-28 space-y-6 safe-area-x">
        {/* Stats Row */}
        <WidgetStatChip stats={statChips} />

        {/* Primary Navigation - Quick Launch */}
        <section className="pt-2">
          <WidgetSectionHeader title="Quick Launch" />
          <div className="flex justify-center gap-5 px-4">
            {primaryNav.map((item, index) => (
              <WidgetAppIcon 
                key={item.title}
                {...item}
                index={index}
              />
            ))}
          </div>
        </section>

        {/* Discover Section */}
        <section className="pt-2">
          <WidgetSectionHeader 
            title="Discover"
            link="/directory"
            linkText="See all"
          />
          <div className="grid grid-cols-2 gap-3 px-4">
            {discoverCards.map((item, index) => (
              <WidgetMiniCard 
                key={item.title}
                {...item}
                index={index}
              />
            ))}
          </div>
        </section>

        {/* Tools Section */}
        <section className="pt-2">
          <WidgetSectionHeader 
            title="Your Tools"
          />
          <div className="grid grid-cols-2 gap-3 px-4">
            {toolCards.map((item, index) => (
              <WidgetMiniCard 
                key={item.title}
                {...item}
                index={index}
              />
            ))}
          </div>
        </section>

        {/* Community Fund CTA */}
        <section className="px-4 pt-2">
          <Link to="/fund" className="block">
            <div className="glass rounded-2xl p-4 flex items-center gap-4 hover:bg-accent/30 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Heart className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground">Community Fund</p>
                <p className="text-sm text-muted-foreground">Support creator projects</p>
              </div>
            </div>
          </Link>
        </section>
      </main>

      {/* Global FAB */}
      <GlobalFAB />

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
              { title: "Community Fund", link: "/fund" },
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
