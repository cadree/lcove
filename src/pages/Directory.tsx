import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import PageLayout from "@/components/layout/PageLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Search, MapPin, Briefcase, Users, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { NewMembersSection } from "@/components/directory/NewMembersSection";
import { computeCityKey, computeCityDisplay } from "@/lib/cityNormalization";

interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  city: string | null;
  city_display: string | null;
  city_key: string | null;
  bio: string | null;
  created_at: string | null;
  passions?: string[];
}

interface CityOption {
  key: string;
  display: string;
}

interface UserPassion {
  user_id: string;
  passions: { name: string } | null;
}

const Directory = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCityKey, setSelectedCityKey] = useState<string | null>(null); // null = All Cities
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    setLoading(true);
    
    // Fetch profiles
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, user_id, display_name, avatar_url, city, city_display, city_key, bio, created_at')
      .eq('onboarding_completed', true)
      .order('created_at', { ascending: false });

    if (profilesError || !profilesData) {
      setLoading(false);
      return;
    }
    
    // Fetch user passions with passion names
    const { data: passionsData } = await supabase
      .from('user_passions')
      .select('user_id, passions(name)');
    
    // Group passions by user_id
    const passionsByUser = new Map<string, string[]>();
    if (passionsData) {
      (passionsData as UserPassion[]).forEach(up => {
        if (up.passions?.name) {
          const existing = passionsByUser.get(up.user_id) || [];
          existing.push(up.passions.name);
          passionsByUser.set(up.user_id, existing);
        }
      });
    }
    
    // Merge passions into profiles
    const profilesWithPassions = profilesData.map(profile => ({
      ...profile,
      passions: passionsByUser.get(profile.user_id) || []
    }));
    
    setProfiles(profilesWithPassions as Profile[]);
    setLoading(false);
  };

  // Build deduplicated city list using city_key (or computed key for old data)
  const cityOptions = useMemo<CityOption[]>(() => {
    const cityMap = new Map<string, string>(); // key -> display
    
    profiles.forEach(profile => {
      // Use city_key if available, otherwise compute from city
      const key = profile.city_key || computeCityKey(profile.city);
      if (!key) return;
      
      // Use city_display if available, otherwise compute from city
      const display = profile.city_display || computeCityDisplay(profile.city);
      if (!display) return;
      
      // Only store first display value seen for each key (they should all be the same after normalization)
      if (!cityMap.has(key)) {
        cityMap.set(key, display);
      }
    });

    // Convert to array and sort alphabetically by display name
    return Array.from(cityMap.entries())
      .map(([key, display]) => ({ key, display }))
      .sort((a, b) => a.display.localeCompare(b.display));
  }, [profiles]);

  // Get the city key for a profile (for filtering)
  const getProfileCityKey = (profile: Profile): string => {
    return profile.city_key || computeCityKey(profile.city);
  };

  // Get the display value for a profile's city
  const getProfileCityDisplay = (profile: Profile): string => {
    return profile.city_display || computeCityDisplay(profile.city) || profile.city || '';
  };

  const filteredProfiles = profiles.filter((profile) => {
    const cityDisplay = getProfileCityDisplay(profile);
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      profile.display_name?.toLowerCase().includes(searchLower) ||
      profile.bio?.toLowerCase().includes(searchLower) ||
      cityDisplay.toLowerCase().includes(searchLower) ||
      profile.passions?.some(passion => passion.toLowerCase().includes(searchLower));
    
    const profileCityKey = getProfileCityKey(profile);
    const matchesCity = selectedCityKey === null || profileCityKey === selectedCityKey;
    
    return matchesSearch && matchesCity;
  });

  const handleProfileClick = (userId: string) => {
    navigate(`/profile/${userId}`);
  };

  return (
    <PageLayout>
      <div className="px-6 pt-6 pb-24">
        {/* Header */}
        <PageHeader
          title="Directory"
          description="Find creatives by name, city, or interests"
          icon={<Users className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />}
          className="mb-6"
        />

        {/* Search Bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative mb-6"
        >
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, city, bio, or passions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-14 pl-12 pr-4 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
          />
        </motion.div>

        {/* City Filter */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex gap-2 overflow-x-auto pb-4 mb-6 scrollbar-hide"
        >
          {/* All Cities button */}
          <Button
            key="all-cities"
            variant={selectedCityKey === null ? "default" : "glass"}
            size="sm"
            onClick={() => setSelectedCityKey(null)}
            className="whitespace-nowrap"
          >
            <MapPin className="w-3 h-3 mr-1" />
            All Cities
          </Button>
          {/* Individual city buttons */}
          {cityOptions.map((cityOption) => (
            <Button
              key={cityOption.key}
              variant={selectedCityKey === cityOption.key ? "default" : "glass"}
              size="sm"
              onClick={() => setSelectedCityKey(cityOption.key)}
              className="whitespace-nowrap"
            >
              <MapPin className="w-3 h-3 mr-1" />
              {cityOption.display}
            </Button>
          ))}
        </motion.div>

        {/* New Members Section */}
        {!loading && <NewMembersSection profiles={profiles} />}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {/* Results Grid */}
        {!loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProfiles.map((profile, index) => (
              <motion.div
                key={profile.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
                onClick={() => handleProfileClick(profile.user_id)}
                className="glass-strong rounded-2xl p-5 hover:bg-accent/20 transition-all duration-300 cursor-pointer group"
              >
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <Avatar className="w-16 h-16 rounded-xl border-2 border-border group-hover:border-primary/50 transition-colors">
                    <AvatarImage src={profile.avatar_url || undefined} />
                    <AvatarFallback className="bg-muted text-muted-foreground text-xl font-medium rounded-xl">
                      {profile.display_name?.charAt(0).toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display text-lg font-medium text-foreground truncate group-hover:text-primary transition-colors">
                      {profile.display_name || 'Anonymous'}
                    </h3>
                    {getProfileCityDisplay(profile) && (
                      <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {getProfileCityDisplay(profile)}
                      </p>
                    )}
                    {profile.bio && (
                      <p className="text-xs text-muted-foreground/70 line-clamp-2">
                        {profile.bio}
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredProfiles.length === 0 && (
          <EmptyState
            icon={Users}
            title="No creatives found"
            description={searchQuery 
              ? "Try adjusting your search or exploring a different city. The right connection might be just around the corner."
              : "Be the first to join this creative community in your city."}
            secondaryAction={searchQuery ? {
              label: "Clear Search",
              onClick: () => {
                setSearchQuery("");
                setSelectedCityKey(null);
              }
            } : undefined}
          />
        )}
      </div>
    </PageLayout>
  );
};

export default Directory;
