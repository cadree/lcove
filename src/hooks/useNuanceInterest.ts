import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useAdmin";
import { GOLD_LEGACY_NECKLACE_ITEM } from "@/data/nuance";

export interface NuanceInterestRow {
  email: string;
  item: string;
  created_at: string;
}

export class NuanceInterestError extends Error {
  alreadyJoined: boolean;

  constructor(message: string, alreadyJoined = false) {
    super(message);
    this.name = "NuanceInterestError";
    this.alreadyJoined = alreadyJoined;
  }
}

export function useJoinNuanceInterest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (email: string) => {
      const normalized = email.trim().toLowerCase();
      const { error } = await supabase.from("nuance_interest").insert({
        email: normalized,
        item: GOLD_LEGACY_NECKLACE_ITEM,
      });

      if (error) {
        if (error.code === "23505") {
          throw new NuanceInterestError("You're already on this list.", true);
        }
        if (error.code === "42501" || error.message.toLowerCase().includes("row-level security")) {
          throw new NuanceInterestError("Use the email on your Ether account.");
        }
        if (error.code === "42P01" || error.message.toLowerCase().includes("nuance_interest")) {
          throw new NuanceInterestError("The interest list is not available yet.");
        }
        throw new NuanceInterestError("Could not join the list. Try again in a moment.");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nuance-interest"] });
    },
  });
}

export function useNuanceInterestList() {
  const { isAdmin } = useIsAdmin();

  return useQuery({
    queryKey: ["nuance-interest"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nuance_interest")
        .select("email, item, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as NuanceInterestRow[];
    },
  });
}

export function nuanceInterestToCsv(rows: NuanceInterestRow[]): string {
  const header = "email,item,created_at";
  const lines = rows.map((row) =>
    [row.email, row.item, row.created_at].map(csvCell).join(","),
  );
  return [header, ...lines].join("\n");
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
