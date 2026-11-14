import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";
import { useCampaignAnalytics } from "@/hooks/useNotificationCampaigns";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { campaignPerformance, recentCampaignLabel, type CampaignTotals } from "@/lib/eventGuests";

interface RecentCampaign {
  id: string;
  title?: string | null;
  type?: string | null;
  created_at: string;
  sent_count?: number;
  recipient_count?: number;
}

interface CampaignAnalyticsPayload {
  totals?: CampaignTotals;
  recent_campaigns?: RecentCampaign[];
}

export function CampaignAnalyticsCard({ eventId }: { eventId?: string }) {
  const { data, isLoading } = useCampaignAnalytics(eventId);

  if (isLoading) return <Skeleton className="h-40 w-full" />;

  const analytics = (data ?? null) as unknown as CampaignAnalyticsPayload | null;
  const rawTotals = (analytics?.totals || {}) as CampaignTotals & { by_channel?: Record<string, number> };
  const totals = campaignPerformance({
    ...rawTotals,
    by_channel: rawTotals.by_channel || (analytics as { by_channel?: Record<string, number> } | null)?.by_channel,
  });
  const recent = analytics?.recent_campaigns || [];

  return (
    <Card className="border-border/40 bg-card/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Campaign performance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-3">
          <Stat label="People" value={totals.people} />
          <Stat label="Emails" value={totals.emails} />
          <Stat label="RSVP'd" value={totals.rsvped} />
          <Stat label="Delivered" value={totals.delivered} />
          <Stat label="Opened" value={totals.opened} />
          <Stat label="Clicked" value={totals.clicked} />
        </div>
        <p className="text-[11px] leading-snug text-muted-foreground">
          {totals.logged} messages logged{totals.channelLine ? ` (${totals.channelLine})` : ""}.
          {" "}Opens and clicks say “Not tracked” until a send includes the tracking pixel or a Resend delivery event.
          RSVP'd counts people who opened the invite link and then RSVP'd. Older invites did not include that link.
          {totals.failed > 0 ? ` ${totals.failed} failed.` : ""}
        </p>

        {recent.length > 0 && (
          <div className="space-y-1.5 pt-2 border-t border-border/40">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Recent</p>
            {recent.slice(0, 5).map((c) => (
              <div key={c.id} className="flex justify-between items-center text-xs py-1">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{c.title || c.type}</p>
                  <p className="text-muted-foreground">{format(new Date(c.created_at), "MMM d, h:mm a")} · {c.type}</p>
                </div>
                <span className="text-muted-foreground shrink-0 ml-2 text-right">{recentCampaignLabel(c.recipient_count, c.sent_count)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-card/40 border border-border/30 p-2">
      <p className="text-lg font-bold">{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
    </div>
  );
}
