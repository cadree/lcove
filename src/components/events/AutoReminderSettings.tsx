import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Clock } from "lucide-react";
import { useAutoReminders } from "@/hooks/useNotificationCampaigns";

export function AutoReminderSettings({ eventId }: { eventId: string }) {
  const { data, upsert } = useAutoReminders(eventId);

  return (
    <Card className="border-border/40 bg-card/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Auto reminders
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <ToggleRow
          label="24 hours before"
          description="Send all confirmed attendees a day-before reminder"
          checked={!!data?.enabled_24h}
          onChange={(v) => upsert.mutate({ enabled_24h: v })}
        />
        <ToggleRow
          label="2 hours before"
          description="Final pre-event reminder"
          checked={!!data?.enabled_2h}
          onChange={(v) => upsert.mutate({ enabled_2h: v })}
        />
        <ToggleRow
          label="At door"
          description="Sent at event start time"
          checked={!!data?.enabled_at_door}
          onChange={(v) => upsert.mutate({ enabled_at_door: v })}
        />
      </CardContent>
    </Card>
  );
}

function ToggleRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/40 p-2.5">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
