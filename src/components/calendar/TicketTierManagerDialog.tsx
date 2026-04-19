import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Pencil, Ticket as TicketIcon } from "lucide-react";
import { useTicketTiers, useUpsertTicketTier, useDeleteTicketTier, type TicketTier } from "@/hooks/useTicketTiers";

interface Props {
  eventId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

interface TierForm {
  id?: string;
  name: string;
  description: string;
  price: string;
  capacity: string;
  is_active: boolean;
}

const empty: TierForm = { name: "", description: "", price: "0", capacity: "", is_active: true };

export function TicketTierManagerDialog({ eventId, open, onOpenChange }: Props) {
  const { data: tiers = [], isLoading } = useTicketTiers(eventId);
  const upsert = useUpsertTicketTier();
  const remove = useDeleteTicketTier();
  const [form, setForm] = useState<TierForm | null>(null);

  useEffect(() => { if (!open) setForm(null); }, [open]);

  const startCreate = () => setForm({ ...empty });
  const startEdit = (t: TicketTier) => setForm({
    id: t.id,
    name: t.name,
    description: t.description || "",
    price: ((t.price_cents || 0) / 100).toString(),
    capacity: t.capacity?.toString() || "",
    is_active: t.is_active,
  });

  const save = async () => {
    if (!form || !form.name.trim()) return;
    const priceCents = Math.round(parseFloat(form.price || "0") * 100);
    if (Number.isNaN(priceCents) || priceCents < 0) return;
    const cap = form.capacity.trim() ? parseInt(form.capacity) : null;
    await upsert.mutateAsync({
      id: form.id,
      event_id: eventId,
      name: form.name.trim(),
      description: form.description.trim() || null,
      price_cents: priceCents,
      capacity: cap,
      is_active: form.is_active,
      sort_order: tiers.length,
    });
    setForm(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><TicketIcon className="w-4 h-4" /> Manage Ticket Tiers</DialogTitle>
          <DialogDescription>Create different ticket types (Early bird, VIP, etc.).</DialogDescription>
        </DialogHeader>

        {form ? (
          <div className="space-y-3">
            <div>
              <Label>Tier name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Early Bird" maxLength={80} />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={300} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Price (USD)</Label>
                <Input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </div>
              <div>
                <Label>Capacity (optional)</Label>
                <Input type="number" min="1" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} placeholder="Unlimited" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label>Active (visible to buyers)</Label>
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setForm(null)}>Cancel</Button>
              <Button onClick={save} disabled={upsert.isPending || !form.name.trim()}>{form.id ? "Save changes" : "Create tier"}</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {!isLoading && tiers.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No tiers yet. Add one to start selling.</p>
            )}
            {tiers.map((t) => (
              <Card key={t.id} className="p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{t.name}</p>
                    {!t.is_active && <Badge variant="outline" className="text-[10px]">Inactive</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t.price_cents === 0 ? "Free" : `$${(t.price_cents / 100).toFixed(2)}`}
                    {t.capacity != null && ` · ${t.quantity_sold}/${t.capacity} sold`}
                  </p>
                </div>
                <Button size="icon" variant="ghost" onClick={() => startEdit(t)}><Pencil className="w-4 h-4" /></Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => {
                    if (confirm(`Delete tier "${t.name}"? Existing tickets keep working.`)) {
                      remove.mutate({ id: t.id, event_id: eventId });
                    }
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </Card>
            ))}
            <Button onClick={startCreate} className="w-full gap-2"><Plus className="w-4 h-4" /> Add tier</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
