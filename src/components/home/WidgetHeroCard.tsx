import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface WidgetHeroCardProps {
  badge?: string;
  headline: string;
  subtext?: string;
  ctaText?: string;
  ctaLink?: string;
  showGlow?: boolean;
}

const WidgetHeroCard = ({ 
  badge,
  headline, 
  subtext, 
  ctaText = "Get Started", 
  ctaLink = "/auth",
  showGlow = true
}: WidgetHeroCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="px-4 pt-4"
    >
      <div className="relative overflow-hidden rounded-[22px] glass-strong h-[150px] p-5 flex flex-col justify-between">
        {/* Background glow */}
        {showGlow && (
          <div className="absolute -top-20 -right-20 w-48 h-48 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
        )}
        
        {/* Top highlight */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/10 to-transparent" />
        
        <div className="relative z-10 space-y-1.5">
          {badge && (
            <span className="inline-block px-2.5 py-0.5 rounded-full bg-primary/15 text-[10px] uppercase tracking-widest text-primary font-medium">
              {badge}
            </span>
          )}
          <h2 className="font-display text-xl sm:text-2xl font-semibold text-foreground leading-tight line-clamp-2">
            {headline}
          </h2>
          {subtext && (
            <p className="text-xs text-muted-foreground line-clamp-1">
              {subtext}
            </p>
          )}
        </div>

        <div className="relative z-10">
          <Link to={ctaLink}>
            <Button 
              size="sm"
              className="h-9 px-5 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-xs shadow-lg glow-pink-sm"
            >
              {ctaText}
            </Button>
          </Link>
        </div>
      </div>
    </motion.div>
  );
};

export default WidgetHeroCard;
