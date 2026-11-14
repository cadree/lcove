import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { callRpc } from "@/lib/rpc";

interface AdminDashboardStats {
  signups_total: number;
  signups_7d: number;
  signups_30d: number;
  posts_total: number;
  posts_visible: number;
  events_total: number;
  events_upcoming: number;
  reports_total: number;
  reports_open: number;
  reports_ai_open: number;
  revenue_cents: number;
  revenue_by_source: Record<string, number>;
}

function money(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((cents || 0) / 100);
}

export function AdminStats() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-dashboard-stats"],
    queryFn: () => callRpc<AdminDashboardStats>("admin_dashboard_stats"),
  });

  if (isLoading) {
    return (
      <div className="px-4 py-4 grid grid-cols-2 md:grid-cols-5 gap-3">
        {[1, 2, 3, 4, 5].map((item) => <Skeleton key={item} className="h-20" />)}
      </div>
    );
  }

  if (error || !data) {
    return (
      <p className="px-4 py-4 text-sm text-destructive">
        {error instanceof Error ? error.message : "Stats are unavailable"}
      </p>
    );
  }

  const cards = [
    { label: "Signups", value: data.signups_total, detail: `${data.signups_7d} this week · ${data.signups_30d} in 30 days` },
    { label: "Posts", value: data.posts_total, detail: `${data.posts_visible} visible` },
    { label: "Events", value: data.events_total, detail: `${data.events_upcoming} upcoming` },
    { label: "Reports", value: data.reports_open, detail: `${data.reports_total} total · ${data.reports_ai_open} open AI-rule` },
    { label: "Stripe revenue", value: money(data.revenue_cents), detail: "Charges already stored" },
  ];

  return (
    <div className="px-4 py-4 grid grid-cols-2 md:grid-cols-5 gap-3">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{card.value}</div>
            <div className="text-sm text-muted-foreground">{card.label}</div>
            <div className="text-xs text-muted-foreground mt-1">{card.detail}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
