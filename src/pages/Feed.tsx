import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PageLayout from "@/components/layout/PageLayout";
import StoriesRow from "@/components/stories/StoriesRow";
import PostCreator from "@/components/feed/PostCreator";
import FeedPost from "@/components/feed/FeedPost";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Filter, Shuffle, Loader2, Sparkles } from "lucide-react";
import { usePosts } from "@/hooks/usePosts";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";

const categories = ["All", "Photo", "Video", "Text"];

const Feed = () => {
  const [activeCategory, setActiveCategory] = useState("All");
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const { posts, isLoading } = usePosts();

  const filteredPosts = activeCategory === "All" 
    ? posts 
    : posts.filter(post => {
        if (activeCategory === "Photo") return post.media_type === 'photo';
        if (activeCategory === "Video") return post.media_type === 'video';
        if (activeCategory === "Text") return post.media_type === 'text' || (!post.media_url && post.content);
        return true;
      });

  return (
    <PageLayout>
      <div className="px-4 sm:px-6 pt-4">
        {/* Stories Row */}
        <StoriesRow />

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center justify-between mb-5 mt-3"
        >
          <h1 className="font-display text-3xl sm:text-4xl font-medium text-foreground">
            Feed
          </h1>
          <div className="flex gap-2">
            <Button variant="glass" size="icon" className="w-10 h-10">
              <Shuffle className="w-4 h-4" />
            </Button>
            <Button variant="glass" size="icon" className="w-10 h-10">
              <Filter className="w-4 h-4" />
            </Button>
          </div>
        </motion.div>

        {/* Post Creator */}
        {user && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
          >
            <PostCreator 
              avatarUrl={profile?.avatar_url} 
              displayName={profile?.display_name} 
            />
          </motion.div>
        )}

        {/* Category Filters */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex gap-2 overflow-x-auto pb-4 mb-5 scrollbar-hide"
        >
          {categories.map((category, index) => (
            <motion.div
              key={category}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + index * 0.05 }}
            >
              <Button
                variant={activeCategory === category ? "default" : "glass"}
                size="sm"
                onClick={() => setActiveCategory(category)}
                className="whitespace-nowrap"
              >
                {category}
              </Button>
            </motion.div>
          ))}
        </motion.div>

        {/* Feed */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-5 pb-32">
            <AnimatePresence mode="popLayout">
              {filteredPosts.map((post, index) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <FeedPost post={post} />
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Empty State */}
            {filteredPosts.length === 0 && (
              <EmptyState
                icon={Sparkles}
                title={activeCategory === "All" ? "The feed is waiting for you" : `No ${activeCategory.toLowerCase()} posts yet`}
                description="This is your space to share what you're creating, thinking, or discovering. Your voice matters here."
                action={user ? {
                  label: "Share Something",
                  onClick: () => document.querySelector<HTMLTextAreaElement>('[placeholder*="Share"]')?.focus()
                } : undefined}
              />
            )}
          </div>
        )}
      </div>
    </PageLayout>
  );
};

export default Feed;
