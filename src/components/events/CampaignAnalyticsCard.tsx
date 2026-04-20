import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";
import { useCampaignAnalytics } from "@/hooks/useNotificationCampaigns";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

export function CampaignAnalyticsCard({ eventId }: { eventId?: string }) {
  const { data, isLoading } = useCampaignAnalytics(eventId);

  if (isLoading) return <Skeleton className="h-40 w-full" />;

  const totals = data?.totals || {};
  const recent = data?.recent_campaigns || [];

  const openRate = totals.sent ? Math.round((totals.opened / totals.sent) * 100) : 0;
  const clickRate = totals.sent ? Math.round((totals.clicked / totals.sent) * 100) : 0;

  return (
    <Card className="border-border/40 bg-card/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Campaign performance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-4 gap-2 text-center">
          <Stat label="Sent" value={totals.sent || 0} />
          <Stat label="Opened" value={`${openRate}%`} />
          <Stat label="Clicked" value={`${clickRate}%`} />
          <Stat label="Failed" value={totals.failed || 0} />
        </div>

        {recent.length > 0 && (
          <div className="space-y-1.5 pt-2 border-t border-border/40">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Recent</p>
            {recent.slice(0, 5).map((c: any) => (
              <div key={c.id} className="flex justify-between items-center text-xs py-1">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{c.title || c.type}</p>
                  <p className="text-muted-foreground">{format(new Date(c.created_at), "MMM d, h:mm a")} · {c.type}</p>
                </div>
                <span className="text-muted-foreground shrink-0 ml-2">{c.sent_count}/{c.recipient_count}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-lg bg-card/40 border border-border/30 p-2">
      <p className="text-lg font-bold">{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
    </div>
  );
}
