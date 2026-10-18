import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

export function CinemaReviewTab() {
  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ["admin-cinema-submissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_submissions")
        .select("id, title, content_type, status, created_at, network_id, pitch_notes")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading submissions…</p>;
  }

  if (submissions.length === 0) {
    return <p className="text-sm text-muted-foreground">No cinema submissions waiting for review.</p>;
  }

  return (
    <div className="space-y-3">
      {submissions.map((submission) => (
        <Card key={submission.id}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{submission.title}</p>
                <p className="text-sm text-muted-foreground">
                  {submission.content_type.replace(/_/g, " ")}
                  {submission.pitch_notes ? ` · ${submission.pitch_notes}` : ""}
                </p>
              </div>
              <Badge variant="secondary">{submission.status}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {formatDistanceToNow(new Date(submission.created_at), { addSuffix: true })}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
