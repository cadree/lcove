import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Building2 } from "lucide-react";

interface BrandApplicationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BrandApplicationDialog({
  open,
  onOpenChange,
}: BrandApplicationDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    brandName: "",
    contactName: "",
    email: "",
    website: "",
    partnershipType: "collaborator",
    proposedOffer: "",
    message: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // For now, we'll insert into creator_applications table as a brand application
      // In a full implementation, you'd have a dedicated brand_applications table
      const { error } = await supabase.from("creator_applications").insert({
        name: `${formData.brandName} (Brand) - ${formData.contactName}`,
        email: formData.email,
        portfolio_url: formData.website,
        message: `Partnership Type: ${formData.partnershipType}\n\nProposed Offer: ${formData.proposedOffer}\n\n${formData.message}`,
        status: "pending",
      });

      if (error) throw error;

      toast.success("Application submitted! We'll be in touch soon.");
      onOpenChange(false);
      setFormData({
        brandName: "",
        contactName: "",
        email: "",
        website: "",
        partnershipType: "collaborator",
        proposedOffer: "",
        message: "",
      });
    } catch (error: any) {
      toast.error("Failed to submit application: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Become a Brand Partner</DialogTitle>
              <DialogDescription>
                Partner with our creative community
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="brandName">Brand Name</Label>
              <Input
                id="brandName"
                required
                value={formData.brandName}
                onChange={(e) =>
                  setFormData({ ...formData, brandName: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactName">Contact Name</Label>
              <Input
                id="contactName"
                required
                value={formData.contactName}
                onChange={(e) =>
                  setFormData({ ...formData, contactName: e.target.value })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Business Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              type="url"
              placeholder="https://"
              value={formData.website}
              onChange={(e) =>
                setFormData({ ...formData, website: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="partnershipType">Partnership Type</Label>
            <Select
              value={formData.partnershipType}
              onValueChange={(value) =>
                setFormData({ ...formData, partnershipType: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sponsor">
                  Sponsor - Premium visibility & exclusive perks
                </SelectItem>
                <SelectItem value="collaborator">
                  Collaborator - Joint initiatives & events
                </SelectItem>
                <SelectItem value="supporter">
                  Supporter - Community benefits & discounts
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="proposedOffer">
              Proposed Exclusive Offer for Members
            </Label>
            <Input
              id="proposedOffer"
              placeholder="e.g., 20% off all services"
              value={formData.proposedOffer}
              onChange={(e) =>
                setFormData({ ...formData, proposedOffer: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Additional Message (optional)</Label>
            <Textarea
              id="message"
              placeholder="Tell us about your brand and partnership goals..."
              rows={3}
              value={formData.message}
              onChange={(e) =>
                setFormData({ ...formData, message: e.target.value })
              }
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Submit Application
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
