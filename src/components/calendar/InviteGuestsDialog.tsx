import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Send, Plus, X, Loader2, Mail, Phone, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Invitee {
  id: string;
  name: string;
  email: string;
  phone: string;
}

interface InviteGuestsDialogProps {
  eventId: string;
  eventTitle: string;
  children: React.ReactNode;
}

export function InviteGuestsDialog({ eventId, eventTitle, children }: InviteGuestsDialogProps) {
  const [open, setOpen] = useState(false);
  const [invitees, setInvitees] = useState<Invitee[]>([
    { id: crypto.randomUUID(), name: "", email: "", phone: "" },
  ]);
  const [sending, setSending] = useState(false);

  const addInvitee = () => {
    if (invitees.length >= 50) {
      toast.error("Maximum 50 invitations at a time");
      return;
    }
    setInvitees([...invitees, { id: crypto.randomUUID(), name: "", email: "", phone: "" }]);
  };

  const removeInvitee = (id: string) => {
    if (invitees.length <= 1) return;
    setInvitees(invitees.filter((i) => i.id !== id));
  };

  const updateInvitee = (id: string, field: keyof Invitee, value: string) => {
    setInvitees(invitees.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  };

  const handleSend = async () => {
    const validInvitees = invitees.filter((i) => i.email.trim() || i.phone.trim());
    if (validInvitees.length === 0) {
      toast.error("Add at least one email or phone number");
      return;
    }

    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not signed in");

      const { data, error } = await supabase.functions.invoke("send-event-invite", {
        body: {
          eventId,
          invitees: validInvitees.map((i) => ({
            name: i.name.trim() || undefined,
            email: i.email.trim() || undefined,
            phone: i.phone.trim() || undefined,
          })),
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;

      const sentCount = data?.sentCount || 0;
      toast.success(`${sentCount} invitation${sentCount !== 1 ? "s" : ""} sent!`);
      setOpen(false);
      setInvitees([{ id: crypto.randomUUID(), name: "", email: "", phone: "" }]);
    } catch (err: any) {
      toast.error(err.message || "Failed to send invitations");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-serif">
            <UserPlus className="w-5 h-5 text-primary" />
            Invite Guests to {eventTitle}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">
            Send email or SMS invitations to people — they don't need an account to RSVP or buy tickets.
          </p>

          {invitees.map((invitee, index) => (
            <div key={invitee.id} className="relative border border-border rounded-lg p-3 space-y-2">
              {invitees.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeInvitee(invitee.id)}
                  className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              <p className="text-xs font-medium text-muted-foreground">Guest {index + 1}</p>
              <Input
                placeholder="Name (optional)"
                value={invitee.name}
                onChange={(e) => updateInvitee(invitee.id, "name", e.target.value)}
                maxLength={100}
              />
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="Email"
                    className="pl-8"
                    value={invitee.email}
                    onChange={(e) => updateInvitee(invitee.id, "email", e.target.value)}
                    maxLength={255}
                  />
                </div>
                <div className="relative">
                  <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    type="tel"
                    placeholder="Phone"
                    className="pl-8"
                    value={invitee.phone}
                    onChange={(e) => updateInvitee(invitee.id, "phone", e.target.value)}
                    maxLength={20}
                  />
                </div>
              </div>
            </div>
          ))}

          <Button variant="outline" size="sm" className="w-full gap-2" onClick={addInvitee}>
            <Plus className="h-3.5 w-3.5" />
            Add Another Guest
          </Button>

          <Button className="w-full gap-2" onClick={handleSend} disabled={sending}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {sending ? "Sending..." : `Send ${invitees.filter((i) => i.email || i.phone).length} Invitation${invitees.filter((i) => i.email || i.phone).length !== 1 ? "s" : ""}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
