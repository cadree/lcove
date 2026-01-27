import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useHomeUsage } from "@/hooks/useHomeUsage";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import EnergyIndicator from "@/components/energy/EnergyIndicator";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { HomeSearch } from "@/components/home/HomeSearch";
import { HomeRecentSection } from "@/components/home/HomeRecentSection";
import { HomeMostUsedSection } from "@/components/home/HomeMostUsedSection";
import { HomePinnedSection } from "@/components/home/HomePinnedSection";
import { HomeExploreSection } from "@/components/home/HomeExploreSection";
import { HomeEditSheet } from "@/components/home/HomeEditSheet";
import BottomNav from "@/components/navigation/BottomNav";

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const [isEditing, setIsEditing] = useState(false);

  const home = useHomeUsage();

  const handleBack = () => {
    navigate("/menu");
  };

  const handleItemClick = (itemId: string) => {
    if (!isEditing) home.trackClick(itemId);
  };

  return (
    <div className="min-h-screen bg-background overflow-x-hidden pb-24">
      <div className="fixed inset-0 bg-gradient-to-b from-primary/[0.02] via-transparent to-transparent pointer-events-none" />

      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-background/95 border-b border-border/30"
        style={{ paddingTop: "max(env(safe-area-inset-top, 0px), 0px)" }}
      >
        <div className="flex items-center justify-between px-4 h-14 relative">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-foreground"
              onClick={handleBack}
              aria-label="Go back"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>

            <Link to="/profile" className="tap-target" aria-label="Go to profile">
              <Avatar className="h-9 w-9 ring-2 ring-primary/20 transition-all hover:ring-primary/40">
                <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.display_name || "Profile"} />
                <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                  {profile?.display_name?.[0]?.toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
            </Link>
          </div>

          <div className="absolute left-1/2 -translate-x-1/2">
            <img
              alt="Ether"
              className="h-14 w-auto object-contain"
              src="/lovable-uploads/5e878a07-e67b-473c-ae6d-1fcb2027bd79.png"
            />
          </div>

          <div className="flex items-center gap-1">
            <EnergyIndicator />
            <NotificationBell />
          </div>
        </div>
      </motion.header>

      <main className="pt-[calc(3.5rem+env(safe-area-inset-top))] px-4 space-y-6">
        <HomeSearch />

        <HomeEditSheet 
          open={isEditing} 
          onOpenChange={setIsEditing} 
          autoReorder={home.preferences.auto_reorder}
          onToggleAutoReorder={home.toggleAutoReorder}
          onReset={home.resetPersonalization}
        />

        <HomePinnedSection
          items={home.pinnedItems}
          isEditing={isEditing}
          onTogglePin={home.togglePin}
          onItemClick={handleItemClick}
        />

        <HomeRecentSection items={home.recentItems} onItemClick={handleItemClick} />

        <HomeMostUsedSection items={home.mostUsedItems} isEditing={isEditing} onItemClick={handleItemClick} />

        {home.loading ? (
          <div className="text-sm text-muted-foreground px-1">Loading…</div>
        ) : (
          <HomeExploreSection items={home.scoredItems} onItemClick={handleItemClick} />
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default Index;
