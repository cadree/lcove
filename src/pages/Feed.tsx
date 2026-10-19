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
import { useFavorites } from "@/hooks/useFavorites";
import { QuestCard } from "@/components/novi/QuestCard";
import { useNoviQuests } from "@/hooks/useNoviQuests";
import { nextQuest } from "@/lib/noviQuests";
import bearLogo from "@/assets/ether-bear-logo.png";
const Feed = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeCategory, setActiveCategory] = useState("All");
  const [postTypeFilter, setPostTypeFilter] = useState<'all' | 'regular' | 'portfolio'>('all');
  const [regionFilter, setRegionFilter] = useState<string | null>(null);
  const [shuffledPosts, setShuffledPosts] = useState<typeof posts>([]);
  const [isShuffled, setIsShuffled] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [lane, setLane] = useState<"for-you" | "friends" | "city" | "live">("for-you");
  const { favorites } = useFavorites();
  const { quests } = useNoviQuests();
  const openQuest = nextQuest(quests);
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
  const favoriteIds = new Set(favorites);
  const lanePosts = filteredPosts.filter((post) => {
    if (lane === "friends") return favoriteIds.has(post.user_id);
    if (lane === "city") return !!profile?.city && (post.profile?.city === profile.city || post.profile?.city_display === profile.city_display);
    if (lane === "live") return false;
    return true;
  });
  return <PageLayout>
      <div className="px-4 sm:px-6 pt-3">
        <header className="mb-3 flex min-h-11 items-center justify-between gap-3">
          <Link to="/feed" className="inline-flex min-h-11 items-center" aria-label="Ether home">
            <img src={bearLogo} alt="" className="h-14 w-auto" />
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

        <StoriesRow />

        <div className="mb-3 flex gap-2 overflow-x-auto scrollbar-hide" role="tablist" aria-label="Feed">
          {([
            ["for-you", "For you"],
            ["friends", "Friends"],
            ["city", "City"],
            ["live", "Live"],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={lane === id}
              onClick={() => setLane(id)}
              className={`mono-label inline-flex h-11 shrink-0 items-center border-b-2 px-2 text-[11px] ${
                lane === id ? "border-[hsl(var(--bubble))] text-foreground" : "border-transparent text-muted-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {openQuest && <div className="mb-4"><QuestCard quest={openQuest} /></div>}

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
        {lane === "live" && (
          <Link to="/live" className="file-panel mb-4 flex min-h-11 items-center justify-between px-4">
            <span>
              <span className="mono-label block text-[8px] text-[hsl(var(--brand))]">Live</span>
              <span className="font-body text-[15px] font-extrabold">Open the live room</span>
            </span>
            <span className="mono-label rounded-full bg-[hsl(var(--brand))] px-2 py-1 text-[8px] text-[#0A0A0A]">Live</span>
          </Link>
        )}
        {!isLoading && lane !== "live" && !lanePosts.some((post) => post.media_url && post.media_type !== "text") && (
          <article className="file-panel mb-5 overflow-hidden">
            <p className="mono-label px-4 pt-3 text-[8px] text-[hsl(var(--brand))]">File // open</p>
            <div className="relative mx-4 mb-4 mt-3 aspect-[3/4] overflow-hidden rounded-[14px] border border-border bg-[radial-gradient(circle_at_28%_18%,rgba(255,159,200,0.42),transparent_52%),linear-gradient(180deg,hsl(var(--panel-2)),hsl(var(--panel)))]">
              <div className="absolute inset-x-0 bottom-0 p-4">
                <p className="kicker">// Feed</p>
                <p className="ether-title mt-1 text-[28px]">The file is open</p>
                <p className="lore mt-1 text-[16px] text-foreground/85">A hero lands here when a post carries a picture.</p>
              </div>
            </div>
          </article>
        )}
        {isLoading ? <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div> : <div className="space-y-5 pb-32">
            <AnimatePresence mode="popLayout">
              {lanePosts.map((post, index) => <motion.div key={post.id} initial={{
            opacity: 0,
            y: 20
          }} animate={{
            opacity: 1,
            y: 0
          }} transition={{
            delay: index * 0.05
          }}>
                  <FeedPost post={post} hero={index === 0 && lane === "for-you"} />
                </motion.div>)}
            </AnimatePresence>

            {lanePosts.length === 0 && posts.length === 0 && user && lane !== "live" && <FirstRunEmpty title="Your feed is empty" description="Start with a post, look through the directory, or read community updates." actions={[{
          label: "Share something",
          onClick: () => document.querySelector<HTMLTextAreaElement>('[placeholder*="mind"]')?.focus()
        }, {
          label: "Browse directory",
          to: "/directory"
        }, {
          label: "Community updates",
          to: "/community"
        }]} />}

            {lanePosts.length === 0 && !(posts.length === 0 && user) && lane !== "live" && <EmptyState icon={Sparkles} title={lane === "for-you" && activeCategory === "All" ? "The feed is waiting for you" : `No ${lane === "for-you" ? activeCategory.toLowerCase() : lane} posts yet`} description="This is your space to share what you're creating, thinking, or discovering. Your voice matters here." action={user ? {
          label: "Share Something",
          onClick: () => document.querySelector<HTMLTextAreaElement>('[placeholder*="mind"]')?.focus()
        } : undefined} />}
          </div>}
      </div>
    </PageLayout>;
};
export default Feed;