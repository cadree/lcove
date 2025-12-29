import { useState } from "react";
import { motion } from "framer-motion";
import { 
  Users, 
  Calendar, 
  FolderKanban, 
  Radio, 
  Compass,
  TrendingUp,
  Sparkles,
  Film,
  Store,
  Wallet
} from "lucide-react";
import HomeTopBar from "@/components/home/HomeTopBar";
import HomeHeroCard from "@/components/home/HomeHeroCard";
import HomeSectionHeader from "@/components/home/HomeSectionHeader";
import HomeMiniCard from "@/components/home/HomeMiniCard";
import HomeListRow from "@/components/home/HomeListRow";
import BottomNav from "@/components/navigation/BottomNav";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { usePlatformStats } from "@/hooks/usePlatformStats";

const quickAccessItems = [
  { title: "Projects", label: "Collaborate", icon: FolderKanban, link: "/projects" },
  { title: "Calendar", label: "Events", icon: Calendar, link: "/calendar" },
  { title: "Community", label: "Connect", icon: Users, link: "/community" },
  { title: "Live", label: "Streaming", icon: Radio, link: "/live" },
];

const exploreItems = [
  { title: "Cinema", subtitle: "Creator networks & films", icon: Film, link: "/cinema" },
  { title: "Mall", subtitle: "Shop creator stores", icon: Store, link: "/mall" },
  { title: "Wallet", subtitle: "Credits & payments", icon: Wallet, link: "/wallet" },
  { title: "Directory", subtitle: "Find collaborators", icon: Users, link: "/directory" },
];

const Index = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { data: stats } = usePlatformStats();

  return (
    <div className="min-h-screen bg-background">
      {/* Subtle ambient gradient */}
      <div className="fixed inset-0 bg-gradient-to-b from-primary/[0.02] via-transparent to-transparent pointer-events-none" />
      
      {/* Top Bar */}
      <HomeTopBar 
        onMenuClick={() => setDrawerOpen(true)} 
        subtitle="Discover"
      />
      
      {/* Main Content */}
      <main className="relative pb-28">
        {/* Hero Card */}
        <HomeHeroCard 
          headline="Create. Connect. Collaborate."
          subtitle="Your creative journey starts here. Join a community built for artists, by artists."
          ctaText="Get Started"
          ctaLink="/auth"
        />

        {/* Stats Row */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex justify-center gap-6 px-4 py-6"
        >
          <div className="text-center">
            <p className="font-display text-xl font-semibold text-foreground">
              {stats?.totalCreatives?.toLocaleString() || "—"}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Creators</p>
          </div>
          <div className="w-px bg-border/50" />
          <div className="text-center">
            <p className="font-display text-xl font-semibold text-foreground">
              {stats?.totalProjects?.toLocaleString() || "—"}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Projects</p>
          </div>
          <div className="w-px bg-border/50" />
          <div className="text-center">
            <p className="font-display text-xl font-semibold text-foreground">
              {stats?.totalCities?.toLocaleString() || "—"}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Cities</p>
          </div>
        </motion.div>

        {/* Quick Access Section */}
        <section className="pt-4">
          <HomeSectionHeader 
            title="Quick Access"
            subtitle="Jump right in"
          />
          <div className="grid grid-cols-2 gap-3 px-4">
            {quickAccessItems.map((item, index) => (
              <HomeMiniCard 
                key={item.title}
                {...item}
                index={index}
              />
            ))}
          </div>
        </section>

        {/* Explore Section */}
        <section className="pt-8">
          <HomeSectionHeader 
            title="Explore"
            subtitle="Discover more"
            link="/feed"
            linkText="See all"
          />
          <div className="space-y-1">
            {exploreItems.map((item, index) => (
              <HomeListRow 
                key={item.title}
                {...item}
                index={index}
              />
            ))}
          </div>
        </section>

        {/* Trending Section */}
        <section className="pt-8">
          <HomeSectionHeader 
            title="Trending Now"
            subtitle="What's hot in the community"
            link="/feed"
          />
          <div className="space-y-1">
            <HomeListRow
              title="New Project Launches"
              subtitle="12 projects started this week"
              meta="New"
              icon={TrendingUp}
              link="/projects"
              index={0}
            />
            <HomeListRow
              title="Featured Creators"
              subtitle="Spotlight on rising talent"
              icon={Sparkles}
              link="/directory"
              index={1}
            />
            <HomeListRow
              title="Upcoming Events"
              subtitle="Don't miss out"
              icon={Calendar}
              link="/calendar"
              index={2}
            />
          </div>
        </section>

        {/* Community Section */}
        <section className="pt-8 pb-4">
          <HomeSectionHeader 
            title="Your Community"
            subtitle="Stay connected"
            link="/community"
          />
          <div className="space-y-1">
            <HomeListRow
              title="Community Feed"
              subtitle="Latest updates & announcements"
              icon={Compass}
              link="/community"
              index={0}
            />
            <HomeListRow
              title="Messages"
              subtitle="Conversations with creators"
              icon={Users}
              link="/messages"
              index={1}
            />
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
                className="block px-4 py-3 rounded-xl text-foreground hover:bg-accent/30 transition-colors"
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
