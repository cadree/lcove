import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import PageLayout from "@/components/layout/PageLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Search, Users, Loader2, Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserBlocks } from "@/hooks/useUserBlocks";
import { FriendsDrawer } from "@/components/friends/FriendsDrawer";
import { cityFilterOptions, cityMatchesFilter, cityMatchesQuery } from "@/lib/cityNormalization";
import { dedupeProfilesByUserId } from "@/lib/directoryProfiles";
import { DIRECTORY_RENDER_PAGE, listEnterDelay, nextRenderedCount } from "@/lib/feedWindow";
import { abortAfter } from "@/lib/requestDeadline";

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
  skills?: string[];
}

interface CityOption {
  key: string;
  display: string;
}

interface UserPassion {
  user_id: string;
  custom_name: string | null;
  passions: { name: string } | { name: string }[] | null;
}

interface UserSkill {
  user_id: string;
  skills: { name: string } | null;
}

function passionLabel(row: UserPassion): string | null {
  const custom = row.custom_name?.trim();
  if (custom) return custom;
  const related = Array.isArray(row.passions) ? row.passions[0] : row.passions;
  const name = related?.name?.trim();
  return name || null;
}

const Directory = () => {
  const navigate = useNavigate();
  const { blockedIds } = useUserBlocks();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCityKey, setSelectedCityKey] = useState<string | null>(null); // null = All Cities
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [shown, setShown] = useState(DIRECTORY_RENDER_PAGE);

  useEffect(() => {
    void fetchProfiles();
  }, []);

  useEffect(() => {
    setShown(DIRECTORY_RENDER_PAGE);
  }, [searchQuery, selectedCityKey]);

  const fetchProfiles = async () => {
    setLoading(true);
    setLoadError(false);
    const signal = abortAfter();
    
    // Fetch profiles using profiles_public view to protect sensitive fields
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles_public')
      .select('id, user_id, display_name, avatar_url, city, city_display, city_key, bio, created_at')
      .eq('onboarding_completed', true)
      .order('created_at', { ascending: false })
      .abortSignal(signal);

    if (profilesError || !profilesData) {
      setLoadError(true);
      setLoading(false);
      return;
    }
    
    // Fetch user passions with passion names
    const { data: passionsData } = await supabase
      .from('user_passions')
      .select('user_id, custom_name, passions(name)')
      .abortSignal(signal);
    
    // Fetch user skills with skill names
    const { data: skillsData } = await supabase
      .from('user_skills')
      .select('user_id, skills(name)')
      .abortSignal(signal);
    
    // Group passions by user_id
    const passionsByUser = new Map<string, string[]>();
    if (passionsData) {
      (passionsData as UserPassion[]).forEach(up => {
        const name = passionLabel(up);
        if (!name) return;
        const existing = passionsByUser.get(up.user_id) || [];
        existing.push(name);
        passionsByUser.set(up.user_id, existing);
      });
    }
    
    // Group skills by user_id
    const skillsByUser = new Map<string, string[]>();
    if (skillsData) {
      (skillsData as UserSkill[]).forEach(us => {
        if (us.skills?.name) {
          const existing = skillsByUser.get(us.user_id) || [];
          existing.push(us.skills.name);
          skillsByUser.set(us.user_id, existing);
        }
      });
    }
    
    // Merge passions and skills into profiles
    const profilesWithDetails = profilesData.map(profile => ({
      ...profile,
      passions: passionsByUser.get(profile.user_id) || [],
      skills: skillsByUser.get(profile.user_id) || []
    }));
    
    setProfiles(dedupeProfilesByUserId(profilesWithDetails as Profile[]));
    setLoading(false);
  };

  // Group filter chips from the strings already stored. "Charlotte" and
  // "Charlotte, NC" share a chip. Stored city fields are left unchanged.
  const cityOptions = useMemo<CityOption[]>(() => {
    return cityFilterOptions(profiles.flatMap((profile) => [profile.city_display, profile.city]));
  }, [profiles]);

  const profileMatchesSelectedCity = (profile: Profile): boolean => {
    if (selectedCityKey === null) return true;
    return [profile.city_display, profile.city].some((value) => cityMatchesFilter(value, selectedCityKey));
  };

  // Get the display value for a profile's city
  const getProfileCityDisplay = (profile: Profile): string => {
    return profile.city || profile.city_display || '';
  };

  const filteredProfiles = profiles.filter((profile) => {
    if (blockedIds.includes(profile.user_id)) return false;
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      profile.display_name?.toLowerCase().includes(searchLower) ||
      profile.bio?.toLowerCase().includes(searchLower) ||
      cityMatchesQuery(profile.city, searchQuery) ||
      cityMatchesQuery(profile.city_display, searchQuery) ||
      profile.passions?.some(passion => passion.toLowerCase().includes(searchLower)) ||
      profile.skills?.some(skill => skill.toLowerCase().includes(searchLower));
    
    const matchesCity = profileMatchesSelectedCity(profile);
    
    return matchesSearch && matchesCity;
  });
  const visibleProfiles = filteredProfiles.slice(0, shown);

  const handleProfileClick = (userId: string) => {
    navigate(`/profile/${userId}`);
  };

  return (
    <PageLayout>
      <div className="px-6 pt-6 pb-24">
        {/* Header */}
        <PageHeader
          eyebrow="People"
          title="Directory"
          description="Find creatives by name, city, or interests"
          className="mb-4"
          actions={
            <FriendsDrawer>
              <Button variant="outline" size="icon" title="Friends" aria-label="Friends">
                <Heart className="w-4 h-4" />
              </Button>
            </FriendsDrawer>
          }
        />

        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="SEARCH NAME, CITY, CRAFT"
            aria-label="Search by name, city, passions, or skills"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-11 w-full rounded-[14px] border border-border bg-input pl-10 pr-4 font-mono text-[11px] uppercase tracking-[0.14em] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(var(--scan))]"
          />
        </div>

        <div className="mb-5 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            type="button"
            onClick={() => setSelectedCityKey(null)}
            aria-pressed={selectedCityKey === null}
            className={`mono-label inline-flex h-11 shrink-0 items-center rounded-full border px-3 text-[11px] ${
              selectedCityKey === null
                ? "border-[hsl(var(--scan))] text-foreground shadow-[inset_0_0_12px_rgba(121,195,207,0.35)]"
                : "border-border text-muted-foreground"
            }`}
          >
            All cities
          </button>
          {cityOptions.map((cityOption) => (
            <button
              key={cityOption.key}
              type="button"
              onClick={() => setSelectedCityKey(cityOption.key)}
              aria-pressed={selectedCityKey === cityOption.key}
              className={`mono-label inline-flex h-11 shrink-0 items-center rounded-full border px-3 text-[11px] ${
                selectedCityKey === cityOption.key
                  ? "border-[hsl(var(--scan))] text-foreground shadow-[inset_0_0_12px_rgba(121,195,207,0.35)]"
                  : "border-border text-muted-foreground"
              }`}
            >
              {cityOption.display}
            </button>
          ))}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12" role="status">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="sr-only">Loading directory</span>
          </div>
        )}

        {!loading && loadError && (
          <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground">The directory did not load.</p>
            <Button type="button" variant="outline" className="mt-3 min-h-11" onClick={() => void fetchProfiles()}>
              Try again
            </Button>
          </div>
        )}

        {/* Results Grid */}
        {!loading && !loadError && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleProfiles.map((profile, index) => (
              <motion.div
                key={profile.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: listEnterDelay(index) }}
                onClick={() => handleProfileClick(profile.user_id)}
                className="file-panel group cursor-pointer p-4"
              >
                <div className="flex items-start gap-3">
                  <span className="rounded-full bg-[conic-gradient(from_120deg,#FF9FC8,#79C3CF,#FF9FC8)] p-[2px]">
                    <Avatar className="h-14 w-14 rounded-full border-2 border-card">
                      <AvatarImage src={profile.avatar_url || undefined} className="rounded-full" />
                      <AvatarFallback className="rounded-full bg-card font-body text-lg font-extrabold text-foreground">
                        {profile.display_name?.charAt(0).toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="mono-label text-[8px] text-[hsl(var(--scan))]">// Profile</p>
                    <div className="flex min-w-0 items-center gap-2">
                    <h3 className="truncate font-body text-[15px] font-extrabold text-foreground">
                      {profile.display_name || 'Anonymous'}
                    </h3>
                    {profile.created_at && Date.now() - new Date(profile.created_at).getTime() < 14 * 24 * 60 * 60 * 1000 && (
                      <span className="mono-label shrink-0 text-[8px] text-[hsl(var(--brand))]">New</span>
                    )}
                  </div>
                    <p className="mono-label mt-1 text-[8px] text-muted-foreground">
                      {getProfileCityDisplay(profile) || "City open"}
                    </p>
                    {profile.bio && (
                      <p className="mt-1 line-clamp-2 font-body text-xs text-muted-foreground">
                        {profile.bio}
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
        {!loading && !loadError && shown < filteredProfiles.length && (
          <Button type="button" variant="outline" className="mt-4 min-h-11 w-full" onClick={() => setShown((count) => nextRenderedCount(count, filteredProfiles.length, DIRECTORY_RENDER_PAGE))}>
            Show more
          </Button>
        )}

        {/* Empty State */}
        {!loading && !loadError && filteredProfiles.length === 0 && (
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
