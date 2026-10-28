import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function EventReminderToggle({ eventId }: { eventId: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ["event-reminder", eventId, user?.id] as const;

  const reminder = useQuery({
    queryKey,
    enabled: Boolean(user?.id && eventId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_event_reminder_enabled", { p_event_id: eventId });
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase.rpc("set_my_event_reminder", {
        p_event_id: eventId,
        p_enabled: enabled,
      });
      if (error) throw error;
      return enabled;
    },
    onSuccess: (enabled) => {
      queryClient.setQueryData(queryKey, enabled);
    },
    onError: () => {
      toast.error("Could not update reminders");
    },
  });

  if (!user || reminder.isLoading || reminder.isError || reminder.data == null) return null;

  const on = reminder.data === true;
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 px-4 py-3">
      <div>
        <p className="text-sm">Reminders</p>
        <p className="text-xs text-muted-foreground">About a day before, and again an hour before</p>
      </div>
      <Switch
        checked={on}
        disabled={save.isPending}
        aria-label={on ? "Turn off reminders for this event" : "Turn on reminders for this event"}
        onCheckedChange={(checked) => save.mutate(checked)}
      />
    </div>
  );
}
