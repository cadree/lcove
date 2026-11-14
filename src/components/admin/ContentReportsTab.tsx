import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fromUntyped } from "@/lib/safetyTables";
import { callRpc } from "@/lib/rpc";
import { isAiViolationReport, type ReportStatus, type ReportTargetType } from "@/lib/reportReasons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

type ReviewAction = "resolve" | "dismiss" | "hide" | "remove" | "hard_delete";

export function ContentReportsTab() {
  const queryClient = useQueryClient();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [aiOnly, setAiOnly] = useState(false);
  const [hardTarget, setHardTarget] = useState<ContentReportRow | null>(null);
  const [confirmId, setConfirmId] = useState("");

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

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["content-reports"] });
    queryClient.invalidateQueries({ queryKey: ["admin-actions"] });
    queryClient.invalidateQueries({ queryKey: ["admin-dashboard-stats"] });
    queryClient.invalidateQueries({ queryKey: ["admin-user-data"] });
  };

  const review = async (report: ContentReportRow, action: ReviewAction, confirm?: string) => {
    setUpdatingId(report.id);
    try {
      await callRpc("admin_review_report", {
        p_report_id: report.id,
        p_action: action,
        p_reason: report.reason,
        p_confirm: confirm ?? null,
      });
      toast.success(
        action === "dismiss" ? "Dismissed" :
        action === "resolve" ? "Resolved" :
        action === "hide" ? "Hidden" :
        action === "hard_delete" ? "Permanently deleted" :
        "Removed"
      );
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the report");
    } finally {
      setUpdatingId(null);
    }
  };

  const visible = aiOnly ? reports.filter((report) => isAiViolationReport(report.reason)) : reports;
  const openReports = visible
    .filter((report) => report.status === "open")
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const closedReports = visible.filter((report) => report.status !== "open");

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((item) => <Skeleton key={item} className="h-24" />)}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Button size="sm" variant={aiOnly ? "default" : "outline"} onClick={() => setAiOnly((value) => !value)}>
        AI-rule violations
      </Button>
      <ScrollArea className="h-[520px]">
        {visible.length === 0 ? (
          <div className="text-center py-12">
            <Flag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{aiOnly ? "No AI-rule reports" : "No reports"}</p>
          </div>
        ) : (
          <div className="space-y-6">
            <ReportList title="Open" reports={openReports} updatingId={updatingId} onReview={review} onHardDelete={(report) => { setConfirmId(""); setHardTarget(report); }} />
            <ReportList title="Reviewed" reports={closedReports} updatingId={updatingId} />
          </div>
        )}
      </ScrollArea>

      <Dialog open={!!hardTarget} onOpenChange={(open) => { if (!open) setHardTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Permanently delete this {hardTarget?.target_type}?</DialogTitle>
            <DialogDescription>
              The first remove hides it. This deletes the row. Paste the target id to confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Target id</Label>
            <Input value={confirmId} onChange={(event) => setConfirmId(event.target.value.trim())} placeholder={hardTarget?.target_id} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHardTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!hardTarget || confirmId !== hardTarget.target_id || updatingId === hardTarget.id}
              onClick={async () => {
                if (!hardTarget) return;
                await review(hardTarget, "hard_delete", confirmId);
                setHardTarget(null);
              }}
            >
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReportDeadline({ createdAt }: { createdAt: string }) {
  const due = new Date(createdAt).getTime() + 24 * 60 * 60 * 1000;
  const overdue = Date.now() > due;
  return (
    <span className={overdue ? "text-destructive" : undefined}>
      {" "}· {overdue ? "Overdue" : "Act within 24h"}
    </span>
  );
}

function ReportList({
  title,
  reports,
  updatingId,
  onReview,
  onHardDelete,
}: {
  title: string;
  reports: ContentReportRow[];
  updatingId: string | null;
  onReview?: (report: ContentReportRow, action: ReviewAction) => void;
  onHardDelete?: (report: ContentReportRow) => void;
}) {
  if (reports.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      {reports.map((report) => {
        const profile = report.target_type === "profile";
        return (
          <Card key={report.id}>
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={report.status === "open" ? "destructive" : "secondary"}>{report.status}</Badge>
                <Badge variant="outline">{report.target_type}</Badge>
                {isAiViolationReport(report.reason) && <Badge variant="destructive">AI rule</Badge>}
                <span className="text-sm font-medium">{report.reason}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {report.reporter_name || "Member"} · {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
                {report.status === "open" && <ReportDeadline createdAt={report.created_at} />}
              </p>
              {report.details && <p className="text-sm whitespace-pre-wrap">{report.details}</p>}
              <p className="text-xs text-muted-foreground break-all">Target {report.target_id}</p>
              {report.status === "open" && onReview && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" disabled={updatingId === report.id} onClick={() => onReview(report, "resolve")}>
                    Resolve
                  </Button>
                  <Button size="sm" variant="outline" disabled={updatingId === report.id} onClick={() => onReview(report, "dismiss")}>
                    Dismiss
                  </Button>
                  <Button size="sm" variant="outline" disabled={updatingId === report.id} onClick={() => onReview(report, "hide")}>
                    {profile ? "Suspend member" : "Hide"}
                  </Button>
                  <Button size="sm" disabled={updatingId === report.id} onClick={() => onReview(report, "remove")}>
                    {profile ? "Remove member" : "Remove"}
                  </Button>
                  {onHardDelete && (
                    <Button size="sm" variant="destructive" disabled={updatingId === report.id} onClick={() => onHardDelete(report)}>
                      Delete permanently
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
