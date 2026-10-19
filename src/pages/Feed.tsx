import { useState, useMemo, useEffect, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import PageLayout from "@/components/layout/PageLayout";
import StoriesRow from "@/components/stories/StoriesRow";
import PostCreator from "@/components/feed/PostCreator";
import FeedPost from "@/components/feed/FeedPost";
import { FeedFilters } from "@/components/feed/FeedFilters";
import { FriendsDrawer } from "@/components/friends/FriendsDrawer";
import { EmptyState } from "@/components/ui/empty-state";
import FirstRunEmpty from "@/components/onboarding/FirstRunEmpty";
import { Button } from "@/components/ui/button";
import { Bell, Filter, Loader2, Shuffle, Sparkles, Users } from "lucide-react";
import { usePosts } from "@/hooks/usePosts";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { cityFilterOptions, cityMatchesFilter } from "@/lib/cityNormalization";
const Feed = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeCategory, setActiveCategory] = useState("All");
  const [postTypeFilter, setPostTypeFilter] = useState<'all' | 'regular' | 'portfolio'>('all');
  const [regionFilter, setRegionFilter] = useState<string | null>(null);
  const [shuffledPosts, setShuffledPosts] = useState<typeof posts>([]);
  const [isShuffled, setIsShuffled] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const {
    user
  } = useAuth();
  const {
    profile
  } = useProfile(user?.id);
  const {
    posts,
    isLoading
  } = usePosts();
  const postCreatorRef = useRef<HTMLTextAreaElement>(null);

  // Handle action params from FAB
  useEffect(() => {
    if (searchParams.get('action') === 'create-post' && user) {
      // Focus the post creator after a brief delay
      setTimeout(() => {
        const textarea = document.querySelector<HTMLTextAreaElement>('[placeholder*="mind"]');
        if (textarea) {
          textarea.focus();
          textarea.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
        }
      }, 300);
      // Clear the action param
      setSearchParams({}, {
        replace: true
      });
    }
  }, [searchParams, user, setSearchParams]);

  // Fetch all distinct cities from profiles
  const {
    data: availableRegions = []
  } = useQuery({
    queryKey: ["all-regions"],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from("profiles_public").select("city, city_display");
      if (error) throw error;

      return cityFilterOptions((data || []).flatMap((profile) => [profile.city, profile.city_display]));
    }
  });
  const handleShuffle = () => {
    const shuffled = [...posts].sort(() => Math.random() - 0.5);
    setShuffledPosts(shuffled);
    setIsShuffled(true);
  };
  const postsToDisplay = isShuffled ? shuffledPosts : posts;
  const filteredPosts = postsToDisplay.filter(post => {
    // Media type filter
    let matchesCategory = activeCategory === "All";
    if (!matchesCategory) {
      if (activeCategory === "Photo") matchesCategory = post.media_type === 'photo';else if (activeCategory === "Video") matchesCategory = post.media_type === 'video';else if (activeCategory === "Text") matchesCategory = post.media_type === 'text' || !post.media_url && !!post.content;
    }

    // Post type filter
    let matchesPostType = postTypeFilter === 'all';
    if (!matchesPostType) {
      matchesPostType = post.post_type === postTypeFilter;
    }

    // Region filter - check both city and city_display for compatibility
    let matchesRegion = regionFilter === null;
    if (!matchesRegion) {
      matchesRegion = cityMatchesFilter(post.profile?.city, regionFilter)
        || cityMatchesFilter(post.profile?.city_display, regionFilter);
    }
    return matchesCategory && matchesPostType && matchesRegion;
  });
  return <PageLayout>
      <div className="px-4 sm:px-6 pt-3">
        <header className="mb-3 flex min-h-11 items-center justify-between gap-3">
          <Link to="/feed" className="ether-title inline-flex min-h-11 items-center text-[22px] tracking-[0.22em]" aria-label="Ether home">
            Ether
          </Link>
          <div className="flex items-center">
            <FriendsDrawer>
              <Button variant="ghost" size="icon" aria-label="Friends">
                <Users className="h-5 w-5" />
              </Button>
            </FriendsDrawer>
            <Link to="/notifications" aria-label="Notifications" className="inline-flex">
              <Button variant="ghost" size="icon" aria-label="Notifications">
                <Bell className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </header>

        {/* Stories Row */}
        <StoriesRow />

        {/* Room for the Novi quest card. Quests ship in a later phase. */}
        <div data-novi-quest-slot="" />

        <div className="mb-4 mt-2 flex items-center justify-end gap-2">
          <div className="flex gap-2">
            <Button variant={isShuffled ? "default" : "outline"} size="icon" onClick={handleShuffle} title="Shuffle feed" aria-label="Shuffle feed">
              <Shuffle className="w-4 h-4" />
            </Button>
            <Button variant={showFilters ? "default" : "outline"} size="icon" onClick={() => setShowFilters(!showFilters)} title="Toggle filters" aria-label="Toggle filters">
              <Filter className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Post Creator */}
        {user && <motion.div initial={{
        opacity: 0,
        y: 10
      }} animate={{
        opacity: 1,
        y: 0
      }} transition={{
        delay: 0.1,
        duration: 0.4
      }}>
            <PostCreator avatarUrl={profile?.avatar_url} displayName={profile?.display_name} />
          </motion.div>}

        {/* Filters */}
        <AnimatePresence>
          {showFilters && <motion.div initial={{
          opacity: 0,
          height: 0
        }} animate={{
          opacity: 1,
          height: "auto"
        }} exit={{
          opacity: 0,
          height: 0
        }} transition={{
          duration: 0.2
        }}>
              <FeedFilters activeCategory={activeCategory} setActiveCategory={setActiveCategory} postTypeFilter={postTypeFilter} setPostTypeFilter={setPostTypeFilter} regionFilter={regionFilter} setRegionFilter={setRegionFilter} availableRegions={availableRegions} />
            </motion.div>}
        </AnimatePresence>

        {/* Feed */}
        {isLoading ? <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div> : <div className="space-y-5 pb-32">
            <AnimatePresence mode="popLayout">
              {filteredPosts.map((post, index) => <motion.div key={post.id} initial={{
            opacity: 0,
            y: 20
          }} animate={{
            opacity: 1,
            y: 0
          }} transition={{
            delay: index * 0.05
          }}>
                  <FeedPost post={post} />
                </motion.div>)}
            </AnimatePresence>

            {filteredPosts.length === 0 && posts.length === 0 && user && <FirstRunEmpty title="Your feed is empty" description="Start with a post, look through the directory, or read community updates." actions={[{
          label: "Share something",
          onClick: () => document.querySelector<HTMLTextAreaElement>('[placeholder*="mind"]')?.focus()
        }, {
          label: "Browse directory",
          to: "/directory"
        }, {
          label: "Community updates",
          to: "/community"
        }]} />}

            {filteredPosts.length === 0 && !(posts.length === 0 && user) && <EmptyState icon={Sparkles} title={activeCategory === "All" ? "The feed is waiting for you" : `No ${activeCategory.toLowerCase()} posts yet`} description="This is your space to share what you're creating, thinking, or discovering. Your voice matters here." action={user ? {
          label: "Share Something",
          onClick: () => document.querySelector<HTMLTextAreaElement>('[placeholder*="mind"]')?.focus()
        } : undefined} />}
          </div>}
      </div>
    </PageLayout>;
};
export default Feed;