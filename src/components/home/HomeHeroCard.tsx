import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

interface HomeHeroCardProps {
  headline?: string;
  subtitle?: string;
  ctaText?: string;
  ctaLink?: string;
}

const HomeHeroCard = ({
  headline = "Create. Connect. Collaborate.",
  subtitle = "Your creative journey starts here. Join a community built for artists, by artists.",
  ctaText = "Get Started",
  ctaLink = "/auth"
}: HomeHeroCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
      className="px-4 pt-6"
    >
      <div className="relative overflow-hidden rounded-3xl glass-strong p-6 sm:p-8 shadow-elevated">
        {/* Glow effect */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-primary/10 rounded-full blur-2xl" />
        
        {/* Subtle border highlight */}
        <div className="absolute inset-0 rounded-3xl border border-primary/10" />
        
        {/* Content */}
        <div className="relative z-10 space-y-4">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20"
          >
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-medium text-primary">Creator Platform</span>
          </motion.div>

          {/* Headline */}
          <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-semibold text-foreground leading-tight">
            {headline}
          </h1>

          {/* Subtitle */}
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-md">
            {subtitle}
          </p>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="pt-2"
          >
            <Link to={ctaLink}>
              <Button variant="pink" size="lg" className="rounded-full group">
                {ctaText}
                <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};

export default HomeHeroCard;
