import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PageLayout from "@/components/layout/PageLayout";
import StoriesRow from "@/components/stories/StoriesRow";
import PostCreator from "@/components/feed/PostCreator";
import FeedPost from "@/components/feed/FeedPost";
import { Button } from "@/components/ui/button";
import { Filter, Shuffle, Loader2 } from "lucide-react";
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
          className="flex items-center justify-between mb-4 mt-2"
        >
          <h1 className="font-display text-2xl sm:text-3xl font-medium text-foreground">Feed</h1>
          <div className="flex gap-2">
            <Button variant="glass" size="icon" className="w-9 h-9">
              <Shuffle className="w-4 h-4" />
            </Button>
            <Button variant="glass" size="icon" className="w-9 h-9">
              <Filter className="w-4 h-4" />
            </Button>
          </div>
        </motion.div>

        {/* Post Creator */}
        {user && (
          <PostCreator 
            avatarUrl={profile?.avatar_url} 
            displayName={profile?.display_name} 
          />
        )}

        {/* Category Filters */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex gap-2 overflow-x-auto pb-4 mb-4 scrollbar-hide"
        >
          {categories.map((category) => (
            <Button
              key={category}
              variant={activeCategory === category ? "default" : "glass"}
              size="sm"
              onClick={() => setActiveCategory(category)}
              className="whitespace-nowrap"
            >
              {category}
            </Button>
          ))}
        </motion.div>

        {/* Feed */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 pb-32">
            <AnimatePresence mode="popLayout">
              {filteredPosts.map((post) => (
                <FeedPost key={post.id} post={post} />
              ))}
            </AnimatePresence>

            {/* Empty State */}
            {filteredPosts.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-16"
              >
                <p className="text-muted-foreground text-lg mb-2">
                  {activeCategory === "All" 
                    ? "No posts yet" 
                    : `No ${activeCategory.toLowerCase()} posts yet`}
                </p>
                <p className="text-muted-foreground/70 text-sm">
                  Be the first to share something with the community!
                </p>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </PageLayout>
  );
};

export default Feed;
