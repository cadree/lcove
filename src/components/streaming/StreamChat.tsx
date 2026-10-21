import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fromUntyped } from "@/lib/safetyTables";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ReportDialog } from "@/components/safety/ReportDialog";
import { useUserBlocks } from "@/hooks/useUserBlocks";
import { assertCleanText, OBJECTIONABLE_MESSAGE } from "@/lib/objectionableText";
import { Flag } from "lucide-react";
import { toast } from "sonner";

interface ChatRow {
  id: string;
  stream_id: string;
  user_id: string;
  body: string;
  created_at: string;
  display_name?: string | null;
}

export function StreamChat({ streamId }: { streamId: string }) {
  const { user } = useAuth();
  const { blockedIds } = useUserBlocks();
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [reportId, setReportId] = useState<string | null>(null);

  const { data: messages = [] } = useQuery({
    queryKey: ["stream-chat", streamId],
    queryFn: async () => {
      const { data, error } = await fromUntyped("stream_chat")
        .select("id, stream_id, user_id, body, created_at")
        .eq("stream_id", streamId)
        .order("created_at", { ascending: true })
        .limit(100);
      if (error) throw error;
      const rows = (data || []) as ChatRow[];
      const ids = [...new Set(rows.map((row) => row.user_id))];
      if (ids.length === 0) return rows;
      const { data: profiles } = await supabase
        .from("profiles_public")
        .select("user_id, display_name")
        .in("user_id", ids);
      const names = new Map(profiles?.map((profile) => [profile.user_id, profile.display_name]));
      return rows.map((row) => ({ ...row, display_name: names.get(row.user_id) }));
    },
    enabled: !!streamId && !!user,
  });

  useEffect(() => {
    if (!streamId) return;
    const channel = supabase
      .channel(`stream-chat-${streamId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "stream_chat", filter: `stream_id=eq.${streamId}` },
        () => queryClient.invalidateQueries({ queryKey: ["stream-chat", streamId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId, queryClient]);

  const send = async () => {
    const text = body.trim();
    if (!user || !text) return;
    try {
      assertCleanText(text);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : OBJECTIONABLE_MESSAGE);
      return;
    }
    setBody("");
    const { error } = await fromUntyped("stream_chat").insert({
      stream_id: streamId,
      user_id: user.id,
      body: text.slice(0, 500),
    });
    if (error) setBody(text);
    else queryClient.invalidateQueries({ queryKey: ["stream-chat", streamId] });
  };

  if (!user) return null;

  return (
    <div className="min-w-0 space-y-2 border-t border-border/40 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="max-h-40 overflow-y-auto space-y-1 text-sm">
        {messages.length === 0 && <p className="text-muted-foreground">No chat yet.</p>}
        {messages.filter((message) => !blockedIds.includes(message.user_id)).map((message) => (
          <div key={message.id} className="flex items-start justify-between gap-2">
            <p>
              <span className="font-medium">{message.display_name || "Member"}: </span>
              {message.body}
            </p>
            {message.user_id !== user.id && (
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setReportId(message.id)}>
                <Flag className="h-3 w-3" />
              </Button>
            )}
          </div>
        ))}
      </div>
      <form
        className="flex w-full min-w-0 gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <Input
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Say something"
          maxLength={500}
          className="w-auto min-w-0 flex-1"
        />
        <Button type="submit" className="shrink-0 px-3" disabled={!body.trim()}>Send</Button>
      </form>
      <ReportDialog
        open={!!reportId}
        onOpenChange={(open) => { if (!open) setReportId(null); }}
        targetType="stream_message"
        targetId={reportId || ""}
      />
    </div>
  );
}
