import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import PageLayout from "@/components/layout/PageLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { EtherIdFace } from "@/components/profile/EtherIdFace";
import { supabase } from "@/integrations/supabase/client";
import { shotSessionEnabled } from "@/lib/shotSession";
import type { EtherIdPublic, EtherIdStatus } from "@/lib/etherId";

function shotCard(token: string): EtherIdPublic | null {
  if (!import.meta.env.DEV || !shotSessionEnabled()) return null;
  const status: EtherIdStatus | null = token === "shot-banned"
    ? "Banned"
    : token === "shot-active"
      ? "Active"
      : null;
  if (!status) return null;
  return {
    display_name: "Maya Torres",
    username: "maya",
    avatar_url: null,
    status,
    member_since: "2026-10-01",
    member_since_label: "October 2026",
  };
}

export default function EtherIdVerify() {
  const { token = "" } = useParams();
  const shot = shotCard(token);
  const query = useQuery({
    queryKey: ["ether-id-verify", token],
    enabled: !shot && token.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_ether_id_by_token", { p_token: token });
      if (error) throw error;
      return (data as unknown as EtherIdPublic | null) ?? null;
    },
  });
  const card = shot ?? query.data ?? null;
  const failed = !shot && !query.isLoading && (query.isError || card == null);

  return (
    <PageLayout>
      <div className="mx-auto max-w-[760px] px-4 pb-24 pt-6 sm:px-6">
        <PageHeader
          eyebrow="Live status"
          title="Verify"
          description="This page reads the member's status now. A saved image of the card is not proof."
          showMore={false}
        />
        {query.isLoading && !shot && <p className="text-sm text-muted-foreground">Checking this Ether ID…</p>}
        {failed && (
          <p className="text-sm text-foreground">
            This Ether ID can't be verified. Ask them to open Show my ID and refresh the code.
          </p>
        )}
        {card && <EtherIdFace card={card} />}
      </div>
    </PageLayout>
  );
}
