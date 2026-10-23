import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  type ConnectStatus,
  connectSetupAction,
  connectStatusCopy,
  connectStatusLabel,
  resolveConnectStatus,
  withdrawalsEnabled,
} from "@/lib/creatorConnectStatus";
import { shotSessionEnabled } from "@/lib/shotSession";

export type { ConnectStatus };
export { connectSetupAction, connectStatusCopy, connectStatusLabel, resolveConnectStatus, withdrawalsEnabled };

export interface CreatorConnectState {
  status: ConnectStatus;
  accountId: string | null;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  transfers_active: boolean;
  can_accept_charges: boolean;
  currently_due: string[];
  disabled_reason: string | null;
}

const emptyState: CreatorConnectState = {
  status: "pending",
  accountId: null,
  charges_enabled: false,
  payouts_enabled: false,
  details_submitted: false,
  transfers_active: false,
  can_accept_charges: false,
  currently_due: [],
  disabled_reason: null,
};

function shotConnectState(): CreatorConnectState {
  const mode = typeof localStorage !== "undefined" ? localStorage.getItem("ether-shot-connect") : null;
  if (mode === "pending") return { ...emptyState };
  if (mode === "verified") {
    return {
      ...emptyState,
      status: "verified",
      accountId: "acct_shot_verified",
      charges_enabled: true,
      payouts_enabled: true,
      details_submitted: true,
      transfers_active: true,
      can_accept_charges: true,
    };
  }
  return {
    ...emptyState,
    status: "accepting",
    accountId: "acct_shot_accepting",
    charges_enabled: true,
    payouts_enabled: false,
    details_submitted: true,
    transfers_active: true,
    can_accept_charges: true,
    disabled_reason: "other",
  };
}

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
      if (shotSessionEnabled()) return shotConnectState();
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
