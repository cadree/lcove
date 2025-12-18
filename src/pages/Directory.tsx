import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import PageLayout from "@/components/layout/PageLayout";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Search, MapPin, Briefcase, Users, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  city: string | null;
  bio: string | null;
}

const Directory = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState("All Cities");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [cities, setCities] = useState<string[]>(["All Cities"]);

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, user_id, display_name, avatar_url, city, bio')
      .eq('onboarding_completed', true)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setProfiles(data);
      const uniqueCities = [...new Set(data.map(p => p.city).filter(Boolean))] as string[];
      setCities(["All Cities", ...uniqueCities]);
    }
    setLoading(false);
  };

  const filteredProfiles = profiles.filter((profile) => {
    const matchesSearch = 
      profile.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      profile.bio?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      profile.city?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCity = selectedCity === "All Cities" || profile.city === selectedCity;
    return matchesSearch && matchesCity;
  });

  const handleProfileClick = (userId: string) => {
    navigate(`/profile/${userId}`);
  };

  return (
    <PageLayout>
      <div className="px-6 pt-8 pb-24">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="font-display text-3xl font-medium text-foreground mb-2">Directory</h1>
          <p className="text-muted-foreground">Find creatives by name, city, or interests</p>
        </motion.div>

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
            placeholder="Search by name, city, or bio..."
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
          {cities.map((city) => (
            <Button
              key={city}
              variant={selectedCity === city ? "default" : "glass"}
              size="sm"
              onClick={() => setSelectedCity(city)}
              className="whitespace-nowrap"
            >
              <MapPin className="w-3 h-3 mr-1" />
              {city}
            </Button>
          ))}
        </motion.div>

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
                    {profile.city && (
                      <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {profile.city}
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
                setSelectedCity("All Cities");
              }
            } : undefined}
          />
        )}
      </div>
    </PageLayout>
  );
};

export default Directory;
