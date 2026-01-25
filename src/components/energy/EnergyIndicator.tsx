import { useState, forwardRef } from "react";
import { motion } from "framer-motion";
import { Zap } from "lucide-react";
import { useEnergy } from "@/hooks/useEnergy";
import { cn } from "@/lib/utils";
import EnergyDetailSheet from "./EnergyDetailSheet";

interface EnergyIndicatorProps {
  className?: string;
}

const EnergyIndicator = forwardRef<HTMLButtonElement, EnergyIndicatorProps>(
  ({ className }, ref) => {
    const { currentEnergy, maxEnergy, energyState, isLoading } = useEnergy();
    const [sheetOpen, setSheetOpen] = useState(false);

    if (isLoading) {
      return <div className="w-9 h-9 rounded-full bg-muted animate-pulse" />;
    }

    const stateColors = {
      critical: "text-destructive bg-destructive/10",
      low: "text-amber-400 bg-amber-400/10",
      medium: "text-primary bg-primary/10",
      high: "text-emerald-400 bg-emerald-400/10",
      full: "text-ether-pink bg-ether-pink/10",
    };

    const stateGlows = {
      critical: "shadow-[0_0_8px_rgba(239,68,68,0.4)]",
      low: "",
      medium: "",
      high: "shadow-[0_0_8px_rgba(16,185,129,0.3)]",
      full: "shadow-[0_0_12px_rgba(255,105,180,0.4)]",
    };

    return (
      <>
        <motion.button
          ref={ref}
          type="button"
          onClick={() => setSheetOpen(true)}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileTap={{ scale: 0.95 }}
          aria-label={`Energy: ${Math.round((currentEnergy / maxEnergy) * 100)}%`}
          className={cn(
            "relative flex items-center justify-center w-9 h-9 rounded-full cursor-pointer transition-colors touch-manipulation",
            stateColors[energyState],
            stateGlows[energyState],
            "hover:opacity-80 active:opacity-70",
            className
          )}
        >
          <motion.div
            animate={energyState === "full" ? { scale: [1, 1.15, 1] } : {}}
            transition={{ repeat: Infinity, duration: 1.5 }}
          >
            <Zap className="w-4 h-4" aria-hidden="true" />
          </motion.div>
          
          {/* Mini percentage badge */}
          <span 
            className="absolute -bottom-0.5 -right-0.5 text-[9px] font-bold bg-background rounded-full px-1 border border-border"
            aria-hidden="true"
          >
            {Math.round((currentEnergy / maxEnergy) * 100)}
          </span>
        </motion.button>

        <EnergyDetailSheet open={sheetOpen} onOpenChange={setSheetOpen} />
      </>
    );
  }
);

EnergyIndicator.displayName = "EnergyIndicator";

export default EnergyIndicator;
