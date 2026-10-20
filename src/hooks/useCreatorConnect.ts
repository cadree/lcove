import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ConnectStatus = "pending" | "needs_info" | "verified";

export interface CreatorConnectState {
  status: ConnectStatus;
  accountId: string | null;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  currently_due: string[];
  disabled_reason: string | null;
}

const emptyState: CreatorConnectState = {
  status: "pending",
  accountId: null,
  charges_enabled: false,
  payouts_enabled: false,
  details_submitted: false,
  currently_due: [],
  disabled_reason: null,
};

async function callConnect(action: "status" | "onboard" | "dashboard") {
  const { data, error } = await supabase.functions.invoke("manage-creator-connect", { body: { action } });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export function useCreatorConnect() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["creator-connect"],
    queryFn: async () => {
      const data = await callConnect("status");
      return { ...emptyState, ...data } as CreatorConnectState;
    },
  });

  const open = useMutation({
    mutationFn: async (action: "onboard" | "dashboard") => {
      const data = await callConnect(action);
      if (!data?.url) throw new Error("Stripe did not return a link");
      window.location.assign(data.url);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creator-connect"] });
    },
  });

  return { ...query, open };
}

export function connectStatusLabel(status: ConnectStatus) {
  if (status === "verified") return "Verified";
  if (status === "needs_info") return "Needs info";
  return "Pending";
}
