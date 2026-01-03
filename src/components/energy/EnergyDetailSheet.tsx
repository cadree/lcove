import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, TrendingUp, Flame, Trophy, Lock, CheckCircle2, Clock, Calendar } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useEnergy, ENERGY_GAINS } from "@/hooks/useEnergy";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";

interface EnergyDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Momentum badges configuration
const MOMENTUM_BADGES = [
  { id: "first_spark", name: "First Spark", description: "Earn your first energy", icon: Zap, requirement: 1, type: "energy_earned" },
  { id: "getting_started", name: "Getting Started", description: "Complete 5 tasks", icon: CheckCircle2, requirement: 5, type: "tasks_completed" },
  { id: "on_fire", name: "On Fire", description: "Maintain a 3-day streak", icon: Flame, requirement: 3, type: "streak" },
  { id: "unstoppable", name: "Unstoppable", description: "Maintain a 7-day streak", icon: Flame, requirement: 7, type: "streak" },
  { id: "energy_master", name: "Energy Master", description: "Reach 100% energy", icon: Zap, requirement: 100, type: "max_energy" },
  { id: "deep_focus", name: "Deep Focus", description: "Complete 3 deep work sessions", icon: Clock, requirement: 3, type: "deep_work" },
  { id: "collaborator", name: "Collaborator", description: "Join 5 collaborations", icon: TrendingUp, requirement: 5, type: "collaborations" },
  { id: "consistent", name: "Consistent", description: "Maintain a 14-day streak", icon: Calendar, requirement: 14, type: "streak" },
  { id: "legend", name: "Legend", description: "Maintain a 30-day streak", icon: Trophy, requirement: 30, type: "streak" },
];

const EnergyDetailSheet = ({ open, onOpenChange }: EnergyDetailSheetProps) => {
  const { user } = useAuth();
  const {
    currentEnergy,
    maxEnergy,
    percentage,
    energyState,
    streakDays,
    streakMultiplier,
  } = useEnergy();

  // Fetch recent energy transactions
  const { data: transactions = [] } = useQuery({
    queryKey: ["energy-transactions", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("energy_transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && open,
  });

  // Calculate stats for badges
  const totalEarned = transactions
    .filter((t: any) => t.transaction_type === "earn")
    .reduce((sum: number, t: any) => sum + t.amount, 0);
  
  const tasksCompleted = transactions
    .filter((t: any) => t.source?.includes("task_complete")).length;
  
  const deepWorkSessions = transactions
    .filter((t: any) => t.source === "deep_work").length;
  
  const collaborations = transactions
    .filter((t: any) => t.source === "collaboration_join").length;

  // Check badge unlock status
  const getBadgeStatus = (badge: typeof MOMENTUM_BADGES[0]) => {
    switch (badge.type) {
      case "energy_earned": return totalEarned >= badge.requirement;
      case "tasks_completed": return tasksCompleted >= badge.requirement;
      case "streak": return streakDays >= badge.requirement;
      case "max_energy": return percentage >= badge.requirement;
      case "deep_work": return deepWorkSessions >= badge.requirement;
      case "collaborations": return collaborations >= badge.requirement;
      default: return false;
    }
  };

  const getBadgeProgress = (badge: typeof MOMENTUM_BADGES[0]) => {
    switch (badge.type) {
      case "energy_earned": return Math.min(totalEarned / badge.requirement * 100, 100);
      case "tasks_completed": return Math.min(tasksCompleted / badge.requirement * 100, 100);
      case "streak": return Math.min(streakDays / badge.requirement * 100, 100);
      case "max_energy": return Math.min(percentage / badge.requirement * 100, 100);
      case "deep_work": return Math.min(deepWorkSessions / badge.requirement * 100, 100);
      case "collaborations": return Math.min(collaborations / badge.requirement * 100, 100);
      default: return 0;
    }
  };

  const unlockedBadges = MOMENTUM_BADGES.filter(getBadgeStatus);
  const lockedBadges = MOMENTUM_BADGES.filter(b => !getBadgeStatus(b));

  // State colors
  const stateColors = {
    critical: "from-destructive/60 to-destructive",
    low: "from-amber-500/70 to-amber-400",
    medium: "from-primary/70 to-primary",
    high: "from-emerald-500/70 to-emerald-400",
    full: "from-ether-pink/70 via-ether-pink to-ether-pink-glow",
  };

  const getSourceLabel = (source: string) => {
    const labels: Record<string, string> = {
      task_complete_easy: "Easy Task",
      task_complete_medium: "Medium Task",
      task_complete_hard: "Hard Task",
      project_milestone: "Milestone",
      project_complete: "Project Complete",
      post_update: "Posted Update",
      collaboration_join: "Collaboration",
      event_attend: "Event",
      streak_bonus: "Streak Bonus",
      micro_action: "Quick Action",
      deep_work: "Deep Work",
      focus_session: "Focus Session",
      publish_content: "Published Content",
      initiate_collaboration: "Started Collab",
      regen: "Regeneration",
    };
    return labels[source] || source;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0">
        <SheetHeader className="p-6 pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-ether-pink" />
            Energy & Momentum
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-100px)]">
          <div className="px-6 pb-6 space-y-6">
            {/* Main Energy Bar */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Current Energy</span>
                <span className="text-2xl font-bold tabular-nums">
                  {currentEnergy} <span className="text-sm text-muted-foreground font-normal">/ {maxEnergy}</span>
                </span>
              </div>
              
              <div className="relative h-4 rounded-full bg-muted/50 overflow-hidden">
                <motion.div
                  className={cn("absolute inset-y-0 left-0 rounded-full bg-gradient-to-r", stateColors[energyState])}
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
                {energyState === "full" && (
                  <motion.div
                    initial={{ x: "-100%" }}
                    animate={{ x: "200%" }}
                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                    className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                  />
                )}
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className={cn(
                  "flex items-center gap-1.5",
                  energyState === "critical" && "text-destructive",
                  energyState === "low" && "text-amber-400",
                  energyState === "full" && "text-ether-pink"
                )}>
                  {energyState === "critical" && "Low energy - take a break"}
                  {energyState === "low" && "Energy running low"}
                  {energyState === "medium" && "Good energy level"}
                  {energyState === "high" && "High energy!"}
                  {energyState === "full" && "Maximum energy!"}
                </span>
                <span className="text-muted-foreground">{percentage}%</span>
              </div>
            </div>

            {/* Streak */}
            {streakDays > 0 && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-ether-pink/10 border border-ether-pink/20">
                <div className="w-10 h-10 rounded-full bg-ether-pink/20 flex items-center justify-center">
                  <Flame className="w-5 h-5 text-ether-pink" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{streakDays} Day Streak</p>
                  <p className="text-xs text-muted-foreground">
                    {streakMultiplier}x energy multiplier active
                  </p>
                </div>
              </div>
            )}

            <Separator />

            {/* Unlocked Badges */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Trophy className="w-4 h-4 text-ether-pink" />
                Momentum Badges ({unlockedBadges.length}/{MOMENTUM_BADGES.length})
              </h3>
              
              {unlockedBadges.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {unlockedBadges.map((badge) => {
                    const Icon = badge.icon;
                    return (
                      <motion.div
                        key={badge.id}
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-ether-pink/10 border border-ether-pink/20"
                      >
                        <div className="w-10 h-10 rounded-full bg-ether-pink/20 flex items-center justify-center">
                          <Icon className="w-5 h-5 text-ether-pink" />
                        </div>
                        <span className="text-xs font-medium text-center line-clamp-1">{badge.name}</span>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Complete activities to unlock badges
                </p>
              )}
            </div>

            {/* Locked Badges */}
            {lockedBadges.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Badges to Unlock
                </h3>
                
                <div className="space-y-2">
                  {lockedBadges.map((badge) => {
                    const Icon = badge.icon;
                    const progress = getBadgeProgress(badge);
                    return (
                      <div
                        key={badge.id}
                        className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/50"
                      >
                        <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center">
                          <Icon className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{badge.name}</p>
                          <p className="text-xs text-muted-foreground">{badge.description}</p>
                          <Progress value={progress} className="h-1 mt-1.5" />
                        </div>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {Math.round(progress)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <Separator />

            {/* Recent Activity */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Recent Activity</h3>
              
              {transactions.length > 0 ? (
                <div className="space-y-2">
                  {transactions.slice(0, 10).map((tx: any) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/20"
                    >
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center",
                          tx.transaction_type === "earn" ? "bg-emerald-500/20" : "bg-amber-500/20"
                        )}>
                          <Zap className={cn(
                            "w-3 h-3",
                            tx.transaction_type === "earn" ? "text-emerald-400" : "text-amber-400"
                          )} />
                        </div>
                        <div>
                          <p className="text-sm">{getSourceLabel(tx.source)}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(tx.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                      <Badge variant={tx.transaction_type === "earn" ? "default" : "secondary"}>
                        {tx.transaction_type === "earn" ? "+" : ""}{tx.amount}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No activity yet. Complete tasks to earn energy!
                </p>
              )}
            </div>

            {/* How to Earn */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium">How to Earn Energy</h3>
              <div className="grid grid-cols-1 gap-2 text-xs">
                <div className="p-2 rounded-lg bg-muted/20 flex justify-between">
                  <span className="text-muted-foreground">Complete a task</span>
                  <span className="font-medium text-emerald-400">+{ENERGY_GAINS.task_complete}</span>
                </div>
                <div className="p-2 rounded-lg bg-muted/20 flex justify-between">
                  <span className="text-muted-foreground">Plan event or meeting</span>
                  <span className="font-medium text-emerald-400">+{ENERGY_GAINS.event_create}</span>
                </div>
                <div className="p-2 rounded-lg bg-muted/20 flex justify-between">
                  <span className="text-muted-foreground">Create a project</span>
                  <span className="font-medium text-emerald-400">+{ENERGY_GAINS.project_create}</span>
                </div>
                <div className="p-2 rounded-lg bg-muted/20 flex justify-between">
                  <span className="text-muted-foreground">Join a project</span>
                  <span className="font-medium text-emerald-400">+{ENERGY_GAINS.project_join}</span>
                </div>
                <div className="p-2 rounded-lg bg-muted/20 flex justify-between">
                  <span className="text-muted-foreground">Attend an event</span>
                  <span className="font-medium text-emerald-400">+{ENERGY_GAINS.event_attend}</span>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

export default EnergyDetailSheet;
