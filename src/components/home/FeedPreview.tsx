import { motion } from "framer-motion";
import FeedCard from "@/components/feed/FeedCard";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const sampleFeed = [
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
];

const FeedPreview = () => {
  return (
    <section className="py-24 px-6 bg-secondary/30">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-12"
        >
          <div>
            <h2 className="font-display text-3xl sm:text-4xl font-medium text-foreground mb-2">
              Fresh from the Community
            </h2>
            <p className="text-muted-foreground">
              Chronological. No algorithms. Pure inspiration.
            </p>
          </div>
          <Link to="/feed">
            <Button variant="outline" className="group">
              View All
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </Link>
        </motion.div>

        {/* Feed Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {sampleFeed.map((item, index) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.15 }}
            >
              <FeedCard {...item} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeedPreview;
