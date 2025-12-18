import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import { usePlatformStats } from "@/hooks/usePlatformStats";

const formatStat = (value: number): string => {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}K+`;
  }
  return `${value}+`;
};

const HeroSection = () => {
  const { data: stats, isLoading } = usePlatformStats();

  const displayStats = [
    { value: stats?.totalCreatives || 0, label: "Creatives" },
    { value: stats?.totalProjects || 0, label: "Projects" },
    { value: stats?.totalCities || 0, label: "Cities" },
  ];

  return (
    <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden px-6">
      {/* Background Elements */}
      <div className="absolute inset-0">
        {/* Gradient orbs */}
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px] animate-float" />
        <div className="absolute bottom-40 right-1/4 w-80 h-80 bg-ether-tan/20 rounded-full blur-[100px] animate-float animation-delay-400" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto text-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 glass-strong px-4 py-2 rounded-full mb-8"
        >
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm text-muted-foreground">A Creative Operating System</span>
        </motion.div>

        {/* Main Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="font-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-medium tracking-tight mb-6"
        >
          <span className="text-foreground">Create. </span>
          <span className="text-gradient-pink">Connect.</span>
          <br />
          <span className="text-foreground">Contribute.</span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          A purpose-driven community where creatives collaborate, host events, 
          share work, and build together — without algorithms or hierarchies.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link to="/auth">
            <Button variant="pink" size="xl" className="group">
              Join the Community
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </Button>
          </Link>
          <Link to="/directory">
            <Button variant="glass" size="xl">
              Explore Directory
            </Button>
          </Link>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.7 }}
          className="mt-16 grid grid-cols-3 gap-8 max-w-lg mx-auto"
        >
          {displayStats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl sm:text-3xl font-display font-medium text-foreground">
                {isLoading ? (
                  <span className="animate-pulse">—</span>
                ) : (
                  formatStat(stat.value)
                )}
              </div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
