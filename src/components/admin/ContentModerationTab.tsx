import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { callRpc } from "@/lib/rpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ContentKind = "post" | "event" | "product";

interface ContentRow {
  id: string;
  kind: ContentKind;
  title: string | null;
  owner_id: string | null;
  owner_name: string | null;
  state: "visible" | "hidden" | "removed";
  created_at: string;
}

const KINDS: { id: ContentKind; label: string }[] = [
  { id: "post", label: "Posts" },
  { id: "event", label: "Events" },
  { id: "product", label: "Products" },
];

export function ContentModerationTab() {
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<ContentKind>("post");
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [hardTarget, setHardTarget] = useState<ContentRow | null>(null);
  const [confirmId, setConfirmId] = useState("");

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ["admin-content", kind, submitted],
    queryFn: () => callRpc<ContentRow[]>("admin_list_content", {
      p_kind: kind,
      p_query: submitted || null,
      p_limit: 40,
    }),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-content"] });
    queryClient.invalidateQueries({ queryKey: ["admin-actions"] });
    queryClient.invalidateQueries({ queryKey: ["admin-dashboard-stats"] });
  };

  const act = async (row: ContentRow, action: "hide" | "unhide" | "remove" | "restore") => {
    setPendingId(row.id);
    try {
      await callRpc("admin_moderate_content", {
        p_kind: row.kind,
        p_id: row.id,
        p_action: action,
        p_reason: null,
        p_confirm: null,
      });
      toast.success(action === "hide" ? "Hidden" : action === "remove" ? "Removed" : "Updated");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update that");
    } finally {
      setPendingId(null);
    }
  };

  const hardDelete = async () => {
    if (!hardTarget) return;
    setPendingId(hardTarget.id);
    try {
      await callRpc("admin_moderate_content", {
        p_kind: hardTarget.kind,
        p_id: hardTarget.id,
        p_action: "hard_delete",
        p_reason: "Permanently deleted by admin",
        p_confirm: confirmId,
      });
      toast.success("Permanently deleted");
      setHardTarget(null);
      setConfirmId("");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete that");
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {KINDS.map((item) => (
          <Button
            key={item.id}
            size="sm"
            variant={kind === item.id ? "default" : "outline"}
            onClick={() => setKind(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(query.trim());
        }}
      >
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search title or paste an id"
        />
        <Button type="submit" variant="outline">Search</Button>
      </form>
      {error && (
        <p className="text-sm text-destructive">{error instanceof Error ? error.message : "Could not load content"}</p>
      )}
      <ScrollArea className="h-[480px]">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Nothing matches</p>
        ) : (
          <div className="space-y-2">
            {rows.map((row) => (
              <Card key={row.id}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{row.title || "Untitled"}</div>
                      <p className="text-xs text-muted-foreground">
                        {row.owner_name || "Unknown"} · {row.id}
                      </p>
                    </div>
                    <Badge variant={row.state === "visible" ? "secondary" : "destructive"}>{row.state}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {row.state === "visible" && (
                      <Button size="sm" variant="outline" disabled={pendingId === row.id} onClick={() => act(row, "hide")}>
                        Hide
                      </Button>
                    )}
                    {row.state === "hidden" && (
                      <Button size="sm" variant="outline" disabled={pendingId === row.id} onClick={() => act(row, "unhide")}>
                        Unhide
                      </Button>
                    )}
                    {row.state !== "removed" && (
                      <Button size="sm" variant="outline" disabled={pendingId === row.id} onClick={() => act(row, "remove")}>
                        Remove
                      </Button>
                    )}
                    {row.state !== "visible" && (
                      <Button size="sm" variant="outline" disabled={pendingId === row.id} onClick={() => act(row, "restore")}>
                        Restore
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={pendingId === row.id}
                      onClick={() => {
                        setConfirmId("");
                        setHardTarget(row);
                      }}
                    >
                      Delete permanently
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>

      <Dialog open={!!hardTarget} onOpenChange={(open) => { if (!open) setHardTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Permanently delete this {hardTarget?.kind}?</DialogTitle>
            <DialogDescription>
              This removes the row. It cannot be restored. Paste the id to confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Content id</Label>
            <Input value={confirmId} onChange={(event) => setConfirmId(event.target.value.trim())} placeholder={hardTarget?.id} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHardTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!hardTarget || confirmId !== hardTarget.id || pendingId === hardTarget.id}
              onClick={hardDelete}
            >
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
