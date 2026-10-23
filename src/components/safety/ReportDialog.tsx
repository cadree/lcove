import { useState } from "react";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { fromUntyped } from "@/lib/safetyTables";
import { AI_CONTENT_RULE_ALLOWED, AI_CONTENT_RULE_FORBIDDEN } from "@/lib/aiContentRule";
import { REPORT_REASONS, type ReportReason, type ReportTargetType } from "@/lib/reportReasons";

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetType: ReportTargetType;
  targetId: string;
}

export function ReportDialog({ open, onOpenChange, targetType, targetId }: ReportDialogProps) {
  const { user } = useAuth();
  const [reason, setReason] = useState<ReportReason>("Harassment or abuse");
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);

  const handleSubmit = async () => {
    if (!user) {
      toast.error("Sign in to report");
      return;
    }
    if (!targetId) return;

    setSending(true);
    const { error } = await fromUntyped("content_reports").insert({
      reporter_id: user.id,
      target_type: targetType,
      target_id: targetId,
      reason,
      details: details.trim() || null,
      status: "open",
    });
    setSending(false);

    if (error) {
      if (error.code === "23505") {
        toast.error("You already reported this");
      } else {
        toast.error("Could not send the report");
      }
      return;
    }

    toast.success("Report sent");
    setDetails("");
    setReason("Harassment or abuse");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report</DialogTitle>
          <DialogDescription>
            Reports go to admins. {AI_CONTENT_RULE_ALLOWED} {AI_CONTENT_RULE_FORBIDDEN}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="report-reason">Reason</Label>
            <Select value={reason} onValueChange={(value) => setReason(value as ReportReason)}>
              <SelectTrigger id="report-reason">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPORT_REASONS.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="report-details">Details</Label>
            <Textarea
              id="report-details"
              value={details}
              maxLength={2000}
              placeholder="What should an admin know?"
              onChange={(event) => setDetails(event.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={sending || !targetId}>
            <Flag className="w-4 h-4 mr-2" />
            {sending ? "Sending..." : "Send report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
