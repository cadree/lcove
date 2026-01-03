import { motion, AnimatePresence } from "framer-motion";
import { Zap, TrendingUp, Info } from "lucide-react";
import { useEnergy, ENERGY_GAINS } from "@/hooks/useEnergy";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface EnergyBarProps {
  variant?: "compact" | "full";
  className?: string;
  showTooltip?: boolean;
}

const EnergyBar = ({ variant = "compact", className, showTooltip = true }: EnergyBarProps) => {
  const {
    currentEnergy,
    maxEnergy,
    percentage,
    energyState,
    streakDays,
    streakMultiplier,
    isLoading,
  } = useEnergy();

  if (isLoading) {
    return (
      <div className={cn("animate-pulse", className)}>
        <div className="h-6 w-24 rounded-full bg-muted" />
      </div>
    );
  }

  // Color classes based on energy state
  const stateColors = {
    critical: {
      bar: "bg-gradient-to-r from-destructive/60 to-destructive",
      glow: "shadow-[0_0_12px_rgba(239,68,68,0.4)]",
      text: "text-destructive",
      icon: "text-destructive",
    },
    low: {
      bar: "bg-gradient-to-r from-amber-500/70 to-amber-400",
      glow: "shadow-[0_0_10px_rgba(245,158,11,0.3)]",
      text: "text-amber-400",
      icon: "text-amber-400",
    },
    medium: {
      bar: "bg-gradient-to-r from-primary/70 to-primary",
      glow: "",
      text: "text-muted-foreground",
      icon: "text-primary",
    },
    high: {
      bar: "bg-gradient-to-r from-emerald-500/70 to-emerald-400",
      glow: "shadow-[0_0_10px_rgba(16,185,129,0.3)]",
      text: "text-emerald-400",
      icon: "text-emerald-400",
    },
    full: {
      bar: "bg-gradient-to-r from-ether-pink/70 via-ether-pink to-ether-pink-glow",
      glow: "shadow-[0_0_16px_rgba(255,105,180,0.5)]",
      text: "text-ether-pink",
      icon: "text-ether-pink",
    },
  };

  const colors = stateColors[energyState];

  const tooltipContent = (
    <div className="space-y-3 p-1">
      <div className="flex items-center gap-2">
        <Zap className={cn("w-4 h-4", colors.icon)} />
        <span className="font-medium">Energy: {currentEnergy}/{maxEnergy}</span>
      </div>
      
      {streakDays > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <TrendingUp className="w-3 h-3 text-ether-pink" />
          <span>{streakDays} day streak ({streakMultiplier}x bonus)</span>
        </div>
      )}

      <div className="border-t border-border pt-2">
        <p className="text-xs text-muted-foreground mb-2">Earn energy by:</p>
        <ul className="text-xs space-y-1 text-muted-foreground">
          <li>• Completing tasks (+{ENERGY_GAINS.task_complete_easy}-{ENERGY_GAINS.task_complete_hard})</li>
          <li>• Finishing milestones (+{ENERGY_GAINS.project_milestone})</li>
          <li>• Posting updates (+{ENERGY_GAINS.post_update})</li>
          <li>• Collaborating (+{ENERGY_GAINS.collaboration_join})</li>
          <li>• Deep work sessions (+{ENERGY_GAINS.deep_work})</li>
        </ul>
      </div>

      <p className="text-xs text-muted-foreground italic">
        Energy regenerates naturally over time.
      </p>
    </div>
  );

  const barContent = (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "flex items-center gap-2",
        variant === "full" && "flex-col items-stretch gap-1",
        className
      )}
    >
      {/* Icon and label */}
      <div className="flex items-center gap-1.5">
        <motion.div
          animate={energyState === "full" ? { scale: [1, 1.1, 1] } : {}}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          <Zap className={cn("w-4 h-4", colors.icon)} />
        </motion.div>
        {variant === "full" && (
          <span className={cn("text-sm font-medium", colors.text)}>
            {currentEnergy}/{maxEnergy}
          </span>
        )}
      </div>

      {/* Bar container */}
      <div
        className={cn(
          "relative overflow-hidden rounded-full bg-muted/50",
          variant === "compact" ? "h-2 w-20" : "h-3 w-full",
          colors.glow
        )}
      >
        {/* Animated fill */}
        <motion.div
          className={cn("absolute inset-y-0 left-0 rounded-full", colors.bar)}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />

        {/* Shimmer effect for full energy */}
        <AnimatePresence>
          {energyState === "full" && (
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: "200%" }}
              exit={{ opacity: 0 }}
              transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
              className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent"
            />
          )}
        </AnimatePresence>
      </div>

      {/* Compact percentage */}
      {variant === "compact" && (
        <span className={cn("text-xs tabular-nums", colors.text)}>
          {percentage}%
        </span>
      )}

      {/* Info icon for full variant */}
      {variant === "full" && showTooltip && (
        <Info className="w-3 h-3 text-muted-foreground" />
      )}
    </motion.div>
  );

  if (!showTooltip) {
    return barContent;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="cursor-help">{barContent}</div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        {tooltipContent}
      </TooltipContent>
    </Tooltip>
  );
};

export default EnergyBar;
