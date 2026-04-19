import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Minus, Plus, Loader2, Ticket } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTicketTiers, type TicketTier } from "@/hooks/useTicketTiers";

interface Props {
  eventId: string;
  eventTitle: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

interface AttendeeForm { name: string; email: string; phone: string; }

export function TicketCheckoutDialog({ eventId, eventTitle, open, onOpenChange }: Props) {
  const { user } = useAuth();
  const { data: tiers = [], isLoading } = useTicketTiers(eventId);
  const activeTiers = useMemo(() => tiers.filter(t => t.is_active), [tiers]);
  const [tierId, setTierId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [attendees, setAttendees] = useState<AttendeeForm[]>([{ name: "", email: "", phone: "" }]);
  const [submitting, setSubmitting] = useState(false);

  const tier = activeTiers.find(t => t.id === tierId) || activeTiers[0] || null;
  const remaining = tier?.capacity != null ? Math.max(0, tier.capacity - (tier.quantity_sold || 0)) : null;
  const maxQty = remaining != null ? Math.min(20, remaining) : 20;
  const totalCents = (tier?.price_cents || 0) * qty;

  useEffect(() => {
    if (!open) return;
    if (!tierId && activeTiers[0]) setTierId(activeTiers[0].id);
  }, [open, activeTiers, tierId]);

  useEffect(() => {
    setAttendees(prev => {
      const next = [...prev];
      while (next.length < qty) next.push({ name: "", email: "", phone: "" });
      next.length = qty;
      return next;
    });
  }, [qty]);

  const updateAttendee = (i: number, field: keyof AttendeeForm, value: string) => {
    setAttendees(prev => prev.map((a, idx) => idx === i ? { ...a, [field]: value } : a));
  };

  const handleCheckout = async () => {
    if (!tier) { toast.error("No ticket tier selected"); return; }
    for (let i = 0; i < attendees.length; i++) {
      if (!attendees[i].name.trim()) { toast.error(`Enter name for attendee ${i + 1}`); return; }
    }
    if (!user && !attendees[0].email.trim()) { toast.error("Email required for guest checkout"); return; }

    setSubmitting(true);
    try {
      const headers: Record<string, string> = {};
      if (user) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) headers.Authorization = `Bearer ${session.access_token}`;
      }
      const { data, error } = await supabase.functions.invoke("purchase-event-ticket", {
        body: {
          eventId,
          tierId: tier.id,
          attendees: attendees.map(a => ({
            name: a.name.trim(),
            email: a.email.trim().toLowerCase() || undefined,
            phone: a.phone.trim() || undefined,
          })),
        },
        headers,
      });
      if (error) throw error;
      if (data?.free && data?.url) {
        toast.success("Registered!");
        window.location.href = data.url;
        return;
      }
      if (data?.url) {
        const win = window.open(data.url, "_blank");
        if (!win || win.closed) window.location.href = data.url;
        onOpenChange(false);
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (e: any) {
      toast.error(e.message || "Checkout failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Ticket className="w-4 h-4" /> Get tickets · {eventTitle}</DialogTitle>
          <DialogDescription>Choose a tier and add each attendee.</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-6 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
        ) : activeTiers.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No tickets available right now.</p>
        ) : (
          <div className="space-y-4">
            {/* Tier select */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Ticket type</Label>
              {activeTiers.map(t => {
                const left = t.capacity != null ? Math.max(0, t.capacity - (t.quantity_sold || 0)) : null;
                const soldOut = left === 0;
                return (
                  <Card
                    key={t.id}
                    onClick={() => !soldOut && setTierId(t.id)}
                    className={`p-3 cursor-pointer transition-colors ${tierId === t.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"} ${soldOut ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{t.name}</p>
                          {soldOut && <Badge variant="outline" className="text-[10px]">Sold out</Badge>}
                        </div>
                        {t.description && <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>}
                        {left != null && !soldOut && <p className="text-[11px] text-muted-foreground mt-0.5">{left} left</p>}
                      </div>
                      <p className="font-semibold whitespace-nowrap">
                        {t.price_cents === 0 ? "Free" : `$${(t.price_cents / 100).toFixed(2)}`}
                      </p>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Quantity */}
            <div className="flex items-center justify-between">
              <Label>Quantity</Label>
              <div className="flex items-center gap-2">
                <Button size="icon" variant="outline" disabled={qty <= 1} onClick={() => setQty(q => Math.max(1, q - 1))}><Minus className="w-4 h-4" /></Button>
                <span className="w-8 text-center font-medium">{qty}</span>
                <Button size="icon" variant="outline" disabled={qty >= maxQty} onClick={() => setQty(q => Math.min(maxQty, q + 1))}><Plus className="w-4 h-4" /></Button>
              </div>
            </div>

            {/* Attendees */}
            <div className="space-y-3">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Attendees</Label>
              {attendees.map((a, i) => (
                <Card key={i} className="p-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Ticket {i + 1}</p>
                  <Input placeholder="Full name *" value={a.name} onChange={(e) => updateAttendee(i, "name", e.target.value)} maxLength={100} />
                  <Input placeholder={i === 0 ? "Email *" : "Email (optional)"} type="email" value={a.email} onChange={(e) => updateAttendee(i, "email", e.target.value)} maxLength={255} />
                  {i === 0 && <Input placeholder="Phone (optional)" type="tel" value={a.phone} onChange={(e) => updateAttendee(i, "phone", e.target.value)} maxLength={20} />}
                </Card>
              ))}
            </div>

            {/* Total */}
            <div className="flex items-center justify-between pt-2 border-t">
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="text-lg font-semibold">{totalCents === 0 ? "Free" : `$${(totalCents / 100).toFixed(2)}`}</p>
            </div>

            <Button className="w-full" disabled={submitting || !tier} onClick={handleCheckout}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {totalCents === 0 ? "Confirm registration" : "Proceed to payment"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
