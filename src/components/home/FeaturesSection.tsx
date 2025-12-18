import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Users, FolderKanban, Calendar, Coins, Store, Music, Heart, ArrowRight, Film, Handshake, Radio, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFundStats } from "@/hooks/useFundStats";

const features = [
  {
    icon: Users,
    title: "Modular Profiles",
    description: "Build your creative identity with customizable blocks — portfolio, store, events, music, and more.",
    link: "/profile",
  },
  {
    icon: FolderKanban,
    title: "Project Calls",
    description: "Structured collaboration. Post roles, find talent, build together. No mass DMs.",
    link: "/projects",
  },
  {
    icon: Film,
    title: "Creator Networks",
    description: "Launch your own streaming network. Share films, series, and content with subscribers.",
    link: "/cinema",
  },
  {
    icon: Calendar,
    title: "Community Calendar",
    description: "Discover local events, workshops, and gatherings. City-first, always.",
    link: "/calendar",
  },
  {
    icon: Radio,
    title: "Live Streaming",
    description: "Go live with DJ sets, art sessions, film premieres, and virtual events.",
    link: "/live",
  },
  {
    icon: Handshake,
    title: "Partners",
    description: "Studios, venues, and businesses offering exclusive benefits to LC members.",
    link: "/partners",
  },
  {
    icon: Coins,
    title: "LC Credits",
    description: "Earn through contribution, not popularity. Credits unlock access, priority, and tools.",
    link: "/wallet",
  },
  {
    icon: Store,
    title: "Creative Stores",
    description: "Sell services, products, and digital goods directly from your profile.",
    link: "/mall",
  },
  {
    icon: Megaphone,
    title: "Community Updates",
    description: "Stay in the loop with announcements, spotlights, and fund transparency reports.",
    link: "/community",
  },
];

const formatCurrency = (value: number): string => {
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K+`;
  }
  return `$${value}`;
};

const FeaturesSection = () => {
  const { data: fundStats, isLoading } = useFundStats();

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
            >
              <Link to={feature.link} className="block h-full">
                <div className="glass-strong rounded-2xl p-6 hover:bg-accent/30 transition-all duration-300 group h-full cursor-pointer">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-display text-xl font-medium text-foreground mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Community Fund Highlight Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-12"
        >
          <Link to="/fund" className="block">
            <div className="glass-strong rounded-2xl p-8 bg-gradient-to-br from-primary/10 via-transparent to-ether-tan/10 hover:from-primary/15 hover:to-ether-tan/15 transition-all duration-300 group">
              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center flex-shrink-0">
                  <Heart className="w-8 h-8 text-primary-foreground fill-primary-foreground" />
                </div>
                <div className="flex-1 text-center md:text-left">
                  <h3 className="font-display text-2xl font-medium text-foreground mb-2">
                    Community Fund
                  </h3>
                  <p className="text-muted-foreground max-w-xl">
                    100% transparent. Every dollar, every decision, fully visible. See how member contributions 
                    fund grants, events, and creative opportunities.
                  </p>
                </div>
                <Button variant="outline" className="group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                  View Fund
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>
              
              {/* Mini Stats - Real-time data */}
              <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-border/50">
                <div className="text-center">
                  <p className="text-2xl font-display font-medium text-foreground">
                    {isLoading ? (
                      <span className="animate-pulse">—</span>
                    ) : (
                      formatCurrency(fundStats?.lifetime.totalCollected || 0)
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">Raised</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-display font-medium text-foreground">
                    {isLoading ? (
                      <span className="animate-pulse">—</span>
                    ) : (
                      fundStats?.lifetime.grantsAwarded || 0
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">Grants Awarded</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-display font-medium text-foreground">
                    {isLoading ? (
                      <span className="animate-pulse">—</span>
                    ) : (
                      fundStats?.lifetime.creatorsSupported || 0
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">Creators Supported</p>
                </div>
              </div>
            </div>
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

export default FeaturesSection;
