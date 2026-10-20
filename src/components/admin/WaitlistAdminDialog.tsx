import { useState } from "react";
import { Download, Mail, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { SITE_ORIGIN } from "@/config/launch";
import { WAITLIST_SOURCES, csvCell, founderInvitePath, parseWaitlistImportCsv } from "@/lib/waitlist";
import { toast } from "sonner";

type WaitlistAdminRow = {
  id: string;
  name: string;
  email: string;
  src: string;
  invited_at: string | null;
  invite_token: string | null;
  converted_at: string | null;
};

function inviteUrl(token: string): string {
  return `${SITE_ORIGIN}${founderInvitePath(token)}`;
}

function inviteCsv(rows: WaitlistAdminRow[]): string {
  const header = ["email", "src", "invite_url", "invited_at", "converted_at"];
  const lines = rows
    .filter((row) => row.invite_token)
    .map((row) =>
      [row.email, row.src, inviteUrl(row.invite_token as string), row.invited_at, row.converted_at]
        .map((cell) => csvCell(cell))
        .join(","),
    );
  return [header.join(","), ...lines].join("\n");
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function WaitlistAdminDialog() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<WaitlistAdminRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [src, setSrc] = useState<string>("manifest");
  const [pending, setPending] = useState(false);

  const load = async () => {
    const { data, error } = await supabase.rpc("list_waitlist_admin");
    if (error || !data) {
      toast.error("Could not load the waitlist.");
      return;
    }
    setRows(data as WaitlistAdminRow[]);
  };

  const openDialog = () => {
    setOpen(true);
    void load();
  };

  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const createLinks = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    setPending(true);
    const { data, error } = await supabase.rpc("invite_waitlist", { p_ids: ids });
    setPending(false);
    if (error || !data) {
      toast.error("Could not create invite links.");
      return;
    }
    const byId = new Map(data.map((row) => [row.id, row.invite_token]));
    setRows((current) =>
      current.map((row) =>
        byId.has(row.id)
          ? { ...row, invite_token: byId.get(row.id) ?? row.invite_token, invited_at: new Date().toISOString() }
          : row,
      ),
    );
    const links = data.map((row) => inviteUrl(row.invite_token)).join("\n");
    try {
      await navigator.clipboard.writeText(links);
      toast.success("Invite links copied.");
    } catch {
      toast.success("Invite links are ready to copy.");
    }
  };

  const copyLinks = async () => {
    const links = rows
      .filter((row) => selected.has(row.id) && row.invite_token)
      .map((row) => inviteUrl(row.invite_token as string));
    if (links.length === 0) {
      toast.error("Create invite links first.");
      return;
    }
    try {
      await navigator.clipboard.writeText(links.join("\n"));
      toast.success("Invite links copied.");
    } catch {
      toast.error("Could not copy invite links.");
    }
  };

  const downloadLinks = () => {
    const chosen = rows.filter((row) => selected.has(row.id) && row.invite_token);
    if (chosen.length === 0) {
      toast.error("Create invite links first.");
      return;
    }
    downloadText("waitlist-invites.csv", inviteCsv(chosen));
    toast.success("Invite CSV downloaded.");
  };

  const sendEmails = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    setPending(true);
    const { data, error } = await supabase.functions.invoke("send-waitlist-invites", { body: { ids } });
    setPending(false);
    if (error || !data?.sent) {
      toast.message("Invite emails are off. Nothing was sent.");
      return;
    }
    toast.success("Invite emails sent.");
    void load();
  };

  const importCsv = async (file: File) => {
    const parsed = parseWaitlistImportCsv(await file.text());
    if (parsed.error || parsed.rows.length === 0) {
      toast.error(parsed.error ?? "CSV needs a header and one row.");
      return;
    }
    setPending(true);
    const { error } = await supabase.rpc("import_waitlist", {
      p_src: src,
      p_rows: parsed.rows,
    });
    setPending(false);
    if (error) {
      toast.error("Could not import the CSV.");
      return;
    }
    toast.success("Import finished. Existing emails kept their original source.");
    void load();
  };

  return (
    <>
      <Button variant="outline" onClick={openDialog} className="gap-2">
        <Mail className="h-4 w-4" />
        Waitlist
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Waitlist</DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => void createLinks()} disabled={pending || selected.size === 0}>
              Create invite links
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => void copyLinks()}>
              Copy links
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={downloadLinks} className="gap-1">
              <Download className="h-3.5 w-3.5" />
              Download CSV
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => void sendEmails()} disabled={pending || selected.size === 0}>
              Email this batch
            </Button>
          </div>
          <ul className="max-h-56 space-y-2 overflow-y-auto text-sm">
            {rows.map((row) => (
              <li key={row.id} className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selected.has(row.id)}
                  onChange={() => toggle(row.id)}
                  aria-label={row.email}
                />
                <span>
                  <span className="block text-foreground">{row.name}</span>
                  <span className="text-muted-foreground">{row.email} · {row.src}</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-sm text-foreground">Import CSV</p>
            <Select value={src} onValueChange={setSrc}>
              <SelectTrigger aria-label="Import source">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WAITLIST_SOURCES.map((source) => (
                  <SelectItem key={source} value={source}>{source}</SelectItem>
                ))}
                <SelectItem value="direct">direct</SelectItem>
              </SelectContent>
            </Select>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <Upload className="h-4 w-4" />
              Upload name, email, optional IG
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void importCsv(file);
                }}
              />
            </label>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
