import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { HostDashboardScreen } from "@/components/events/host/HostDashboardScreen";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatUsd } from "@/lib/ticketFees";

export default function HostHome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [accountId, setAccountId] = useState("personal");

  const { data: profile } = useQuery({
    queryKey: ["host-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("display_name, social_links").eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });
  const { data: memberships = [] } = useQuery({
    queryKey: ["host-orgs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("organization_members").select("organization_id").eq("user_id", user!.id);
      return data || [];
    },
  });
  const orgIds = memberships.map((row) => row.organization_id);
  const { data: orgs = [] } = useQuery({
    queryKey: ["host-org-names", orgIds.join(",")],
    enabled: orgIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("organizations").select("id, name").in("id", orgIds);
      return data || [];
    },
  });
  const { data: events = [] } = useQuery({
    queryKey: ["host-events", user?.id, accountId],
    enabled: !!user,
    queryFn: async () => {
      let query = supabase.from("events").select("id, title, start_date, status, organization_id").eq("creator_id", user!.id);
      if (accountId !== "personal") query = query.eq("organization_id", accountId);
      const { data } = await query;
      return data || [];
    },
  });
  const { data: revenue = 0 } = useQuery({
    queryKey: ["host-revenue", events.map((event) => event.id).join(",")],
    enabled: events.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("ticket_orders").select("subtotal_cents, payment_status").in("event_id", events.map((event) => event.id)).eq("payment_status", "paid");
      return (data || []).reduce((sum, order) => sum + (order.subtotal_cents || 0), 0);
    },
  });
  const { data: followers = 0 } = useQuery({
    queryKey: ["host-followers", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("host_follower_count", { p_user_id: user!.id });
      if (error) return 0;
      return data || 0;
    },
  });
  const { data: attendance = 0 } = useQuery({
    queryKey: ["host-attendance", events.map((event) => event.id).join(",")],
    enabled: events.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("host_event_attendance_counts", { p_event_ids: events.map((event) => event.id) });
      if (error || !data) return 0;
      return data.reduce((sum, row) => sum + (row.going || 0), 0);
    },
  });

  const instagram = useMemo(() => {
    const links = profile?.social_links as { instagram?: string } | null;
    const value = links?.instagram?.trim();
    if (!value) return null;
    return value.startsWith("http") ? value : `https://instagram.com/${value.replace(/^@/, "")}`;
  }, [profile]);

  if (!user) {
    navigate("/auth?redirect=/dashboard/events");
    return null;
  }

  const name = profile?.display_name || "Host";
  const accounts = [
    { id: "personal", label: name },
    ...orgs.map((org) => ({
      id: org.id,
      label: org.name || "Organization",
    })),
  ];

  return (
    <HostDashboardScreen
      name={name}
      accounts={accounts}
      accountId={accountId}
      onAccount={setAccountId}
      instagram={instagram}
      eventCount={events.length}
      stats={[
        { label: "Revenue", value: formatUsd(revenue) },
        { label: "Attendees", value: String(attendance) },
        { label: "Events", value: String(events.length) },
        { label: "Followers", value: String(followers) },
      ]}
      onEvents={() => navigate("/dashboard/events/calendar")}
      onFinances={() => navigate("/dashboard/events/finances")}
      onProfile={() => navigate("/settings")}
      onDoor={() => navigate("/dashboard/events/door")}
      onCreate={() => navigate(accountId === "personal" ? "/dashboard/events/new" : `/dashboard/events/new?org=${accountId}`)}
    />
  );
}
