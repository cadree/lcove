import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PageLayout from "@/components/layout/PageLayout";
import FeedCard from "@/components/feed/FeedCard";
import { Button } from "@/components/ui/button";
import { Filter, Shuffle } from "lucide-react";

const feedItems = [
  {
    image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&h=800&fit=crop",
    title: "Exploring Generative Art with Processing",
    creator: "Maya Chen",
    creatorAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop",
    category: "Digital Art",
    likes: 234,
    comments: 18,
  },
  {
    image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=800&fit=crop",
    title: "Behind the Scenes: Editorial Shoot",
    creator: "James Wright",
    creatorAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop",
    category: "Photography",
    likes: 189,
    comments: 12,
  },
  {
    image: "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=600&h=800&fit=crop",
    title: "New EP Recording Session Vibes",
    creator: "Luna Rodriguez",
    creatorAvatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop",
    category: "Music",
    likes: 456,
    comments: 34,
  },
  {
    image: "https://images.unsplash.com/photo-1561214115-f2f134cc4912?w=600&h=800&fit=crop",
    title: "Typography in Modern Brand Design",
    creator: "Alex Kim",
    creatorAvatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop",
    category: "Branding",
    likes: 312,
    comments: 28,
  },
  {
    image: "https://images.unsplash.com/photo-1545235617-7a424c1a60cc?w=600&h=800&fit=crop",
    title: "Street Art Documentary Project",
    creator: "Sofia Martinez",
    creatorAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop",
    category: "Film",
    likes: 567,
    comments: 45,
  },
  {
    image: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&h=800&fit=crop",
    title: "Live Performance at Warehouse Gallery",
    creator: "Jordan Cole",
    creatorAvatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop",
    category: "Music",
    likes: 723,
    comments: 52,
  },
];

const categories = ["All", "Digital Art", "Photography", "Music", "Branding", "Film"];

const Feed = () => {
  const [activeCategory, setActiveCategory] = useState("All");
  const [currentIndex, setCurrentIndex] = useState(0);

  const filteredItems = activeCategory === "All" 
    ? feedItems 
    : feedItems.filter(item => item.category === activeCategory);

  return (
    <PageLayout>
      <div className="px-6 pt-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-6"
        >
          <h1 className="font-display text-3xl font-medium text-foreground">Feed</h1>
          <div className="flex gap-2">
            <Button variant="glass" size="icon">
              <Shuffle className="w-4 h-4" />
            </Button>
            <Button variant="glass" size="icon">
              <Filter className="w-4 h-4" />
            </Button>
          </div>
        </motion.div>

        {/* Category Filters */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex gap-2 overflow-x-auto pb-4 mb-6 scrollbar-hide"
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

        {/* Feed Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredItems.map((item, index) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
              >
                <FeedCard {...item} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Empty State */}
        {filteredItems.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <p className="text-muted-foreground text-lg mb-4">
              No posts in this category yet.
            </p>
            <p className="text-muted-foreground/70">
              Be the first to share your work!
            </p>
          </motion.div>
        )}
      </div>
    </PageLayout>
  );
};

export default Feed;
