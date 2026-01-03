import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";

// Energy gain amounts by source
export const ENERGY_GAINS = {
  task_complete_easy: 5,
  task_complete_medium: 10,
  task_complete_hard: 20,
  project_milestone: 25,
  project_complete: 50,
  post_update: 5,
  collaboration_join: 10,
  event_attend: 15,
  streak_bonus: 5, // per day of streak
  micro_action: 2,
  deep_work: 30,
} as const;

// Energy spend amounts
export const ENERGY_COSTS = {
  focus_session: 10,
  publish_content: 15,
  initiate_collaboration: 20,
  advanced_feature: 25,
} as const;

// Constants
const PASSIVE_REGEN_RATE = 1; // energy per hour
const OVERNIGHT_REGEN = 30; // bonus energy for 8+ hours away
const LOW_ENERGY_THRESHOLD = 20;
const CRITICAL_ENERGY_THRESHOLD = 10;

interface UserEnergy {
  id: string;
  user_id: string;
  current_energy: number;
  max_energy: number;
  last_regen_at: string;
  last_activity_at: string | null;
  streak_days: number;
  streak_multiplier: number;
  created_at: string;
  updated_at: string;
}

interface EnergyTransaction {
  id: string;
  user_id: string;
  amount: number;
  transaction_type: "earn" | "spend";
  source: string;
  source_id?: string;
  description?: string;
  balance_after: number;
  created_at: string;
}

export function useEnergy() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch user energy state
  const { data: energy, isLoading } = useQuery({
    queryKey: ["user-energy", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      // Try to get existing energy record
      const { data, error } = await supabase
        .from("user_energy")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      // If no record exists, create one
      if (!data) {
        const { data: newEnergy, error: insertError } = await supabase
          .from("user_energy")
          .insert({ user_id: user.id })
          .select()
          .single();

        if (insertError) throw insertError;
        return newEnergy as UserEnergy;
      }

      return data as UserEnergy;
    },
    enabled: !!user?.id,
    staleTime: 30000,
  });

  // Calculate passive regeneration
  const calculateRegeneration = (lastRegenAt: string): number => {
    const lastRegen = new Date(lastRegenAt);
    const now = new Date();
    const hoursPassed = (now.getTime() - lastRegen.getTime()) / (1000 * 60 * 60);

    let regenAmount = Math.floor(hoursPassed * PASSIVE_REGEN_RATE);

    // Overnight bonus (8+ hours)
    if (hoursPassed >= 8) {
      regenAmount += OVERNIGHT_REGEN;
    }

    return regenAmount;
  };

  // Apply regeneration on load
  useEffect(() => {
    if (!energy || !user?.id) return;

    const regenAmount = calculateRegeneration(energy.last_regen_at);
    if (regenAmount > 0 && energy.current_energy < energy.max_energy) {
      const newEnergy = Math.min(energy.current_energy + regenAmount, energy.max_energy);
      
      supabase
        .from("user_energy")
        .update({
          current_energy: newEnergy,
          last_regen_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ["user-energy", user.id] });
        });
    }
  }, [energy?.id]);

  // Earn energy mutation
  const earnEnergy = useMutation({
    mutationFn: async ({
      amount,
      source,
      sourceId,
      description,
    }: {
      amount: number;
      source: string;
      sourceId?: string;
      description?: string;
    }) => {
      if (!user?.id || !energy) throw new Error("No user or energy state");

      const multipliedAmount = Math.floor(amount * energy.streak_multiplier);
      const newBalance = Math.min(energy.current_energy + multipliedAmount, energy.max_energy);

      // Update energy
      const { error: updateError } = await supabase
        .from("user_energy")
        .update({
          current_energy: newBalance,
          last_activity_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      // Log transaction
      const { error: txError } = await supabase.from("energy_transactions").insert({
        user_id: user.id,
        amount: multipliedAmount,
        transaction_type: "earn",
        source,
        source_id: sourceId,
        description,
        balance_after: newBalance,
      });

      if (txError) throw txError;

      return newBalance;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-energy", user?.id] });
    },
  });

  // Spend energy mutation
  const spendEnergy = useMutation({
    mutationFn: async ({
      amount,
      source,
      sourceId,
      description,
    }: {
      amount: number;
      source: string;
      sourceId?: string;
      description?: string;
    }) => {
      if (!user?.id || !energy) throw new Error("No user or energy state");

      // Prevent spending if critically low
      if (energy.current_energy < CRITICAL_ENERGY_THRESHOLD) {
        throw new Error("Energy too low. Take a break and recharge.");
      }

      // Prevent spending more than available
      if (amount > energy.current_energy) {
        throw new Error("Not enough energy for this action.");
      }

      const newBalance = energy.current_energy - amount;

      // Update energy
      const { error: updateError } = await supabase
        .from("user_energy")
        .update({
          current_energy: newBalance,
          last_activity_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      // Log transaction
      const { error: txError } = await supabase.from("energy_transactions").insert({
        user_id: user.id,
        amount: -amount,
        transaction_type: "spend",
        source,
        source_id: sourceId,
        description,
        balance_after: newBalance,
      });

      if (txError) throw txError;

      return newBalance;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-energy", user?.id] });
    },
  });

  // Update streak
  const updateStreak = useMutation({
    mutationFn: async (newStreakDays: number) => {
      if (!user?.id) throw new Error("No user");

      // Calculate multiplier (caps at 2x for 7+ day streak)
      const multiplier = Math.min(1 + newStreakDays * 0.1, 2);

      const { error } = await supabase
        .from("user_energy")
        .update({
          streak_days: newStreakDays,
          streak_multiplier: multiplier,
        })
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-energy", user?.id] });
    },
  });

  // Derived state
  const currentEnergy = energy?.current_energy ?? 100;
  const maxEnergy = energy?.max_energy ?? 100;
  const percentage = Math.round((currentEnergy / maxEnergy) * 100);
  const isLow = currentEnergy <= LOW_ENERGY_THRESHOLD;
  const isCritical = currentEnergy <= CRITICAL_ENERGY_THRESHOLD;
  const isFull = currentEnergy >= maxEnergy;

  const getEnergyState = (): "critical" | "low" | "medium" | "high" | "full" => {
    if (isCritical) return "critical";
    if (isLow) return "low";
    if (percentage >= 80) return "full";
    if (percentage >= 50) return "high";
    return "medium";
  };

  return {
    energy,
    isLoading,
    currentEnergy,
    maxEnergy,
    percentage,
    isLow,
    isCritical,
    isFull,
    energyState: getEnergyState(),
    streakDays: energy?.streak_days ?? 0,
    streakMultiplier: energy?.streak_multiplier ?? 1,
    earnEnergy: earnEnergy.mutateAsync,
    spendEnergy: spendEnergy.mutateAsync,
    updateStreak: updateStreak.mutateAsync,
    isEarning: earnEnergy.isPending,
    isSpending: spendEnergy.isPending,
    canSpend: (amount: number) => currentEnergy >= amount && !isCritical,
  };
}
