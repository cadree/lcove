import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { fromUntyped } from "@/lib/safetyTables";
import type { ReportStatus, ReportTargetType } from "@/lib/reportReasons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

interface ContentReportRow {
  id: string;
  reporter_id: string;
  target_type: ReportTargetType;
  target_id: string;
  reason: string;
  details: string | null;
  status: ReportStatus;
  created_at: string;
  reporter_name?: string | null;
}

export function ContentReportsTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["content-reports"],
    queryFn: async (): Promise<ContentReportRow[]> => {
      const { data, error } = await fromUntyped("content_reports")
        .select("id, reporter_id, target_type, target_id, reason, details, status, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const rows = (data ?? []) as ContentReportRow[];
      const reporterIds = [...new Set(rows.map((row) => row.reporter_id))];
      if (reporterIds.length === 0) return rows;

      const { data: profiles } = await supabase
        .from("profiles_public")
        .select("user_id, display_name")
        .in("user_id", reporterIds);

      const names = new Map((profiles ?? []).map((profile) => [profile.user_id, profile.display_name]));
      return rows.map((row) => ({ ...row, reporter_name: names.get(row.reporter_id) ?? null }));
    },
  });

  const updateStatus = async (id: string, status: "actioned" | "dismissed") => {
    if (!user) return;
    setUpdatingId(id);
    const { error } = await fromUntyped("content_reports")
      .update({
        status,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    setUpdatingId(null);

    if (error) {
      toast.error("Could not update the report");
      return;
    }

    toast.success(status === "actioned" ? "Marked actioned" : "Dismissed");
    queryClient.invalidateQueries({ queryKey: ["content-reports"] });
  };

  const openReports = reports.filter((report) => report.status === "open");
  const closedReports = reports.filter((report) => report.status !== "open");

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((item) => <Skeleton key={item} className="h-24" />)}
      </div>
    );
  }

  return (
    <ScrollArea className="h-[520px]">
      {reports.length === 0 ? (
        <div className="text-center py-12">
          <Flag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No reports</p>
        </div>
      ) : (
        <div className="space-y-6">
          <ReportList
            title="Open"
            reports={openReports}
            updatingId={updatingId}
            onUpdate={updateStatus}
          />
          <ReportList
            title="Reviewed"
            reports={closedReports}
            updatingId={updatingId}
            onUpdate={updateStatus}
          />
        </div>
      )}
    </ScrollArea>
  );
}

function ReportList({
  title,
  reports,
  updatingId,
  onUpdate,
}: {
  title: string;
  reports: ContentReportRow[];
  updatingId: string | null;
  onUpdate: (id: string, status: "actioned" | "dismissed") => void;
}) {
  if (reports.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      {reports.map((report) => (
        <Card key={report.id}>
          <CardContent className="p-3 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={report.status === "open" ? "destructive" : "secondary"}>
                    {report.status}
                  </Badge>
                  <Badge variant="outline">{report.target_type}</Badge>
                  <span className="text-sm font-medium">{report.reason}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {report.reporter_name || "Member"} · {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>
            {report.details && (
              <p className="text-sm text-foreground whitespace-pre-wrap">{report.details}</p>
            )}
            <p className="text-xs text-muted-foreground break-all">Target {report.target_id}</p>
            {report.status === "open" && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => onUpdate(report.id, "actioned")}
                  disabled={updatingId === report.id}
                >
                  Mark actioned
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onUpdate(report.id, "dismissed")}
                  disabled={updatingId === report.id}
                >
                  Dismiss
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
