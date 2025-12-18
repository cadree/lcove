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
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.7 }}
          className="w-full max-w-xs sm:max-w-2xl mx-auto"
        >
          <div className="flex flex-col sm:flex-row sm:justify-center gap-3 sm:gap-0">
            {statItems.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.8 + index * 0.1 }}
                className="group relative flex sm:flex-col items-center justify-between sm:justify-center gap-2 sm:gap-1 py-4 px-6 sm:px-8 md:px-12 sm:border-r sm:border-border/20 sm:last:border-r-0"
              >
                {/* Hover glow effect */}
                <div className="absolute inset-0 rounded-2xl bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl" />
                
                {/* Content */}
                <span className="relative text-xs sm:text-[10px] md:text-xs uppercase tracking-[0.2em] text-muted-foreground/70 sm:order-2 font-medium">
                  {stat.label}
                </span>
                <span className="relative text-2xl sm:text-3xl md:text-5xl font-display font-light tracking-tight text-foreground sm:order-1 tabular-nums">
                  {isLoading ? (
                    <span className="inline-block w-8 h-8 rounded-full bg-muted/30 animate-pulse" />
                  ) : (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-gradient-pink"
                    >
                      {stat.value}
                    </motion.span>
                  )}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;