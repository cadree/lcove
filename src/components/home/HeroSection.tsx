import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import lcBearLogo from "@/assets/lc-bear-logo.png";
import { usePlatformStats } from "@/hooks/usePlatformStats";

const HeroSection = () => {
  const { data: stats, isLoading } = usePlatformStats();

  const statItems = [
    { value: stats?.totalCreatives ?? 0, label: "Creatives" },
    { value: stats?.totalProjects ?? 0, label: "Projects" },
    { value: stats?.totalCities ?? 0, label: "Cities" },
  ];

  return (
    <section className="relative min-h-[100svh] sm:min-h-[85vh] flex items-center justify-center overflow-hidden px-4 sm:px-6 py-16 sm:py-0">
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Gradient orbs - smaller on mobile */}
        <div className="absolute top-10 sm:top-20 left-1/4 w-48 sm:w-96 h-48 sm:h-96 bg-primary/20 rounded-full blur-[80px] sm:blur-[120px] animate-float" />
        <div className="absolute bottom-20 sm:bottom-40 right-1/4 w-40 sm:w-80 h-40 sm:h-80 bg-ether-tan/20 rounded-full blur-[60px] sm:blur-[100px] animate-float animation-delay-400" />
      </div>

      <div className="relative z-10 w-full max-w-4xl mx-auto text-center flex flex-col items-center">
        {/* Main Logo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          className="mb-4 sm:mb-6"
        >
          <img
            src={lcBearLogo}
            alt="LC Bear Logo"
            className="w-16 h-16 sm:w-24 sm:h-24 md:w-32 md:h-32 mx-auto object-contain"
          />
        </motion.div>

        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="inline-flex items-center gap-1.5 sm:gap-2 glass-strong px-3 sm:px-4 py-1.5 sm:py-2 rounded-full mb-6 sm:mb-8"
        >
          <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
          <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
            A Creative Operating System
          </span>
        </motion.div>

        {/* Main Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="font-display text-3xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-medium tracking-tight mb-4 sm:mb-6 leading-tight"
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
          className="text-sm sm:text-lg md:text-xl text-muted-foreground max-w-xs sm:max-w-xl md:max-w-2xl mx-auto mb-8 sm:mb-10 leading-relaxed px-2 sm:px-0"
        >
          A purpose-driven community where creatives collaborate, host events,
          share work, and build together — without algorithms or hierarchies.
        </motion.p>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.7 }}
          className="w-full max-w-xs sm:max-w-lg mx-auto"
        >
          {/* Mobile: Vertical stack, Desktop: Horizontal row */}
          <div className="flex flex-col sm:flex-row sm:justify-center gap-4 sm:gap-8">
            {statItems.map((stat) => (
              <div
                key={stat.label}
                className="flex sm:flex-col items-center justify-between sm:justify-center gap-2 sm:gap-0 py-2 sm:py-0 border-b sm:border-b-0 border-border/30 last:border-b-0"
              >
                <span className="text-xs sm:text-sm text-muted-foreground sm:order-2">
                  {stat.label}
                </span>
                <span className="text-lg sm:text-2xl md:text-3xl font-display font-medium text-foreground sm:order-1">
                  {isLoading ? "—" : stat.value}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;