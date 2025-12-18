import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import lcBearLogo from "@/assets/lc-bear-logo.png";
import { usePlatformStats } from "@/hooks/usePlatformStats";

const HeroSection = () => {
  const { data: stats } = usePlatformStats();

  return <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden px-6">
      {/* Background Elements */}
      <div className="absolute inset-0">
        {/* Gradient orbs */}
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px] animate-float" />
        <div className="absolute bottom-40 right-1/4 w-80 h-80 bg-ether-tan/20 rounded-full blur-[100px] animate-float animation-delay-400" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto text-center">
        {/* Main Logo */}
        <motion.div initial={{
        opacity: 0,
        scale: 0.8
      }} animate={{
        opacity: 1,
        scale: 1
      }} transition={{
        duration: 0.6
      }} className="mb-6">
          <img src={lcBearLogo} alt="LC Bear Logo" className="w-24 h-24 sm:w-32 sm:h-32 mx-auto object-contain" />
        </motion.div>

        {/* Badge */}
        <motion.div initial={{
        opacity: 0,
        y: 20
      }} animate={{
        opacity: 1,
        y: 0
      }} transition={{
        duration: 0.6,
        delay: 0.1
      }} className="inline-flex items-center gap-2 glass-strong px-4 py-2 rounded-full mb-8">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm text-muted-foreground">A Creative Operating System</span>
        </motion.div>

        {/* Main Headline */}
        <motion.h1 initial={{
        opacity: 0,
        y: 30
      }} animate={{
        opacity: 1,
        y: 0
      }} transition={{
        duration: 0.7,
        delay: 0.1
      }} className="font-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-medium tracking-tight mb-6">
          <span className="text-foreground">Create. </span>
          <span className="text-gradient-pink">Connect.</span>
          <br />
          <span className="text-foreground">Contribute.</span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p initial={{
        opacity: 0,
        y: 20
      }} animate={{
        opacity: 1,
        y: 0
      }} transition={{
        duration: 0.6,
        delay: 0.3
      }} className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
          A purpose-driven community where creatives collaborate, host events, 
          share work, and build together — without algorithms or hierarchies.
        </motion.p>

        {/* CTA Buttons */}
        

        {/* Stats */}
        <motion.div initial={{
        opacity: 0
      }} animate={{
        opacity: 1
      }} transition={{
        duration: 0.8,
        delay: 0.7
      }} className="mt-12 sm:mt-16 grid grid-cols-3 gap-3 sm:gap-8 max-w-lg mx-auto px-2">
          {[{
          value: stats?.totalCreatives || 0,
          label: "Creatives"
        }, {
          value: stats?.totalProjects || 0,
          label: "Projects"
        }, {
          value: stats?.totalCities || 0,
          label: "Cities"
        }].map(stat => <div key={stat.label} className="text-center">
              <div className="text-xl sm:text-2xl md:text-3xl font-display font-medium text-foreground">
                {stat.value}
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground">{stat.label}</div>
            </div>)}
        </motion.div>
      </div>
    </section>;
};
export default HeroSection;