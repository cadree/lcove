import { motion } from "framer-motion";
import { Users, FolderKanban, Calendar, Coins, Store, Music } from "lucide-react";

const features = [
  {
    icon: Users,
    title: "Modular Profiles",
    description: "Build your creative identity with customizable blocks — portfolio, store, events, music, and more.",
  },
  {
    icon: FolderKanban,
    title: "Project Calls",
    description: "Structured collaboration. Post roles, find talent, build together. No mass DMs.",
  },
  {
    icon: Calendar,
    title: "Community Calendar",
    description: "Discover local events, workshops, and gatherings. City-first, always.",
  },
  {
    icon: Coins,
    title: "LC Credits",
    description: "Earn through contribution, not popularity. Credits unlock access, priority, and tools.",
  },
  {
    icon: Store,
    title: "Creative Stores",
    description: "Sell services, products, and digital goods directly from your profile.",
  },
  {
    icon: Music,
    title: "Artist Integration",
    description: "Connect Spotify & Apple Music. Showcase your sound alongside your visual work.",
  },
];

const FeaturesSection = () => {
  return (
    <section className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-medium text-foreground mb-4">
            Built for Creators, <span className="text-gradient-pink">Not Algorithms</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Every feature serves the community. No follower counts. No engagement bait.
          </p>
        </motion.div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="glass-strong rounded-2xl p-6 hover:bg-accent/30 transition-all duration-300 group"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-display text-xl font-medium text-foreground mb-2">
                {feature.title}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
