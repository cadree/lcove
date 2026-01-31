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
import { useAuth } from "@/contexts/AuthContext";
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
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    businessName: "",
    category: "service",
    contactEmail: "",
    contactPhone: "",
    website: "",
    city: "",
    state: "",
    country: "",
    address: "",
    description: "",
    contribution: "",
    memberBenefits: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error("Please sign in to submit an application");
      return;
    }
    
    setLoading(true);

    try {
      const { error } = await supabase.from("partner_applications").insert({
        user_id: user.id,
        business_name: formData.businessName,
        category: formData.category,
        contact_email: formData.contactEmail,
        contact_phone: formData.contactPhone || null,
        website_url: formData.website || null,
        city: formData.city || null,
        state: formData.state || null,
        country: formData.country || null,
        address: formData.address || null,
        description: formData.description || null,
        contribution: formData.contribution || null,
        member_benefits: formData.memberBenefits || null,
        status: "pending",
      });

      if (error) {
        if (error.code === '23505') {
          throw new Error("You already have a pending application");
        }
        throw error;
      }

      toast.success("Application submitted! We'll review it and get back to you soon.");
      onOpenChange(false);
      setFormData({
        businessName: "",
        category: "service",
        contactEmail: "",
        contactPhone: "",
        website: "",
        city: "",
        state: "",
        country: "",
        address: "",
        description: "",
        contribution: "",
        memberBenefits: "",
      });
    } catch (error: any) {
      toast.error(error.message || "Failed to submit application");
    } finally {
      setLoading(false);
    }
  };

  const categories = [
    { value: 'studio', label: 'Studio', icon: '🎬' },
    { value: 'venue', label: 'Venue', icon: '🏛️' },
    { value: 'cafe', label: 'Café', icon: '☕' },
    { value: 'housing', label: 'Housing', icon: '🏠' },
    { value: 'equipment', label: 'Equipment', icon: '📷' },
    { value: 'transport', label: 'Transport', icon: '🚗' },
    { value: 'service', label: 'Service', icon: '✨' },
    { value: 'other', label: 'Other', icon: '📦' },
  ];

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
          <div className="space-y-2">
            <Label htmlFor="businessName">Business Name *</Label>
            <Input
              id="businessName"
              required
              value={formData.businessName}
              onChange={(e) =>
                setFormData({ ...formData, businessName: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category *</Label>
            <Select
              value={formData.category}
              onValueChange={(value) =>
                setFormData({ ...formData, category: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.icon} {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contactEmail">Contact Email *</Label>
              <Input
                id="contactEmail"
                type="email"
                required
                value={formData.contactEmail}
                onChange={(e) =>
                  setFormData({ ...formData, contactEmail: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactPhone">Contact Phone</Label>
              <Input
                id="contactPhone"
                type="tel"
                value={formData.contactPhone}
                onChange={(e) =>
                  setFormData({ ...formData, contactPhone: e.target.value })
                }
              />
            </div>
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) =>
                  setFormData({ ...formData, city: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State/Province</Label>
              <Input
                id="state"
                value={formData.state}
                onChange={(e) =>
                  setFormData({ ...formData, state: e.target.value })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="country">Country</Label>
            <Input
              id="country"
              value={formData.country}
              onChange={(e) =>
                setFormData({ ...formData, country: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Full Address</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) =>
                setFormData({ ...formData, address: e.target.value })
              }
              placeholder="Street address for your location"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">About Your Business</Label>
            <Textarea
              id="description"
              placeholder="Tell us about your business and what you do..."
              rows={3}
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contribution">How will you contribute?</Label>
            <Textarea
              id="contribution"
              placeholder="How can you contribute to our creative community?"
              rows={2}
              value={formData.contribution}
              onChange={(e) =>
                setFormData({ ...formData, contribution: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="memberBenefits">
              Proposed Exclusive Offer for Members
            </Label>
            <Input
              id="memberBenefits"
              placeholder="e.g., 20% off all services"
              value={formData.memberBenefits}
              onChange={(e) =>
                setFormData({ ...formData, memberBenefits: e.target.value })
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
