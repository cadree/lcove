import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { WAITLIST_SOURCES, csvCell } from "@/lib/waitlist";
import { toast } from "sonner";

type WaitlistExportRow = {
  src: string;
  name: string;
  email: string;
  ig_handle: string | null;
  what_do_you_make: string | null;
  email_me: boolean;
  ref_code: string;
  referred_by: string | null;
  founding: boolean;
  created_at: string;
};

export function rowsToWaitlistCsv(rows: WaitlistExportRow[]): string {
  const header = [
    "src",
    "name",
    "email",
    "ig_handle",
    "what_do_you_make",
    "email_me",
    "ref_code",
    "referred_by",
    "founding",
    "created_at",
  ];
  const lines = rows.map((row) =>
    [
      row.src,
      row.name,
      row.email,
      row.ig_handle,
      row.what_do_you_make,
      row.email_me ? "true" : "false",
      row.ref_code,
      row.referred_by,
      row.founding ? "true" : "false",
      row.created_at,
    ]
      .map((cell) => csvCell(cell))
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

export function WaitlistExportButton() {
  const [src, setSrc] = useState("all");
  const [pending, setPending] = useState(false);

  const download = async () => {
    setPending(true);
    const { data, error } = await supabase.rpc("export_waitlist", {
      p_src: src === "all" ? undefined : src,
      p_week: new Date().toISOString().slice(0, 10),
    });
    setPending(false);
    if (error || !data) {
      toast.error("Could not export the waitlist.");
      return;
    }
    const csv = rowsToWaitlistCsv(data as WaitlistExportRow[]);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `waitlist-${src}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Waitlist CSV downloaded.");
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={src} onValueChange={setSrc}>
        <SelectTrigger className="w-[140px]" aria-label="Waitlist source">
          <SelectValue placeholder="Source" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All sources</SelectItem>
          {WAITLIST_SOURCES.map((source) => (
            <SelectItem key={source} value={source}>
              {source}
            </SelectItem>
          ))}
          <SelectItem value="direct">direct</SelectItem>
        </SelectContent>
      </Select>
      <Button type="button" variant="outline" className="gap-2" disabled={pending} onClick={() => void download()}>
        <Download className="h-4 w-4" />
        Waitlist CSV
      </Button>
    </div>
  );
}
