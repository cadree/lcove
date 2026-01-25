import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Settings2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useHomeUsage } from "@/hooks/useHomeUsage";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const [isEditing, setIsEditing] = useState(false);
  const {
    loading,
    preferences,
    scoredItems,
    pinnedItems,
    mostUsedItems,
    recentItems,
    trackClick,
    togglePin,
    toggleAutoReorder,
    resetPersonalization
  } = useHomeUsage();

  const handleItemClick = (itemId: string) => {
    if (!isEditing) {
      trackClick(itemId);
    }
  };

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Subtle ambient gradient */}
      <div className="fixed inset-0 bg-gradient-to-b from-primary/[0.02] via-transparent to-transparent pointer-events-none" />
      
      {/* Header - Always visible */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-background/95 border-b border-border/30"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 0px)' }}
      >
        <div className="flex items-center justify-between px-4 h-14">
          {/* Left - Profile Avatar */}
          <Link to="/profile" className="tap-target" aria-label="Go to profile">
            <Avatar className="h-9 w-9 ring-2 ring-primary/20 transition-all hover:ring-primary/40">
              <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.display_name || "Profile"} />
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                {profile?.display_name?.[0]?.toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
          </Link>

          {/* Center - Logo */}
          <div className="absolute left-1/2 -translate-x-1/2">
            <img
              alt="Ether"
              className="h-14 w-auto object-contain"
              src="/lovable-uploads/5e878a07-e67b-473c-ae6d-1fcb2027bd79.png"
            />
          </div>

          {/* Right - Actions */}
          <div className="flex items-center gap-1">
            <EnergyIndicator />
            <NotificationBell />
          </div>
        </div>
      </motion.header>

      {/* Spacer for fixed header */}
      <div className="h-14" style={{ marginTop: 'max(env(safe-area-inset-top, 0px), 0px)' }} />

      {/* Main Content */}
      <main className="relative pb-32 safe-area-x rounded-sm">
        {loading ? (
          <div className="space-y-6 p-4">
            <Skeleton className="h-12 w-full rounded-2xl" />
            <div className="space-y-3">
              <Skeleton className="h-4 w-24" />
              <div className="flex gap-2">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-28 rounded-xl" />)}
              </div>
            </div>
            <div className="space-y-3">
              <Skeleton className="h-4 w-20" />
              <div className="grid grid-cols-2 gap-3">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6 pt-4">
            {/* Search */}
            <HomeSearch onNavigate={handleItemClick} />

            {/* Edit Home Button */}
            <div className="px-4">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground gap-2"
                onClick={() => setIsEditing(true)}
              >
                <Settings2 className="h-4 w-4" />
                Edit Home
              </Button>
            </div>

            {/* Pinned Section */}
            {pinnedItems.length > 0 && (
              <HomePinnedSection
                items={pinnedItems}
                onItemClick={handleItemClick}
                isEditing={isEditing}
                onTogglePin={togglePin}
              />
            )}

            {/* Recent / Continue Section */}
            {recentItems.length > 0 && (
              <HomeRecentSection items={recentItems} onItemClick={handleItemClick} />
            )}

            {/* Most Used / For You Section */}
            {mostUsedItems.length > 0 && (
              <HomeMostUsedSection
                items={mostUsedItems}
                onItemClick={handleItemClick}
                isEditing={isEditing}
                onTogglePin={togglePin}
              />
            )}

            {/* Welcome message for new users */}
            {recentItems.length === 0 && mostUsedItems.length === 0 && pinnedItems.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="px-4"
              >
                <div className="rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 p-6 text-center">
                  <h2 className="font-display text-xl font-medium text-foreground mb-2">
                    Welcome to Ether
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Start exploring and your most-used features will appear here
                  </p>
                </div>
              </motion.div>
            )}

            {/* Explore Section */}
            <HomeExploreSection
              items={scoredItems}
              onItemClick={handleItemClick}
              isEditing={isEditing}
              onTogglePin={togglePin}
            />
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <BottomNav />

      {/* Edit Sheet */}
      <HomeEditSheet
        open={isEditing}
        onOpenChange={setIsEditing}
        autoReorder={preferences.auto_reorder}
        onToggleAutoReorder={toggleAutoReorder}
        onReset={resetPersonalization}
      />
    </div>
  );
};

export default Index;