import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ExternalLink,
  Gift,
  Copy,
  Mail,
  Globe,
  Instagram,
  Twitter,
} from "lucide-react";
import { toast } from "sonner";
import type { BrandPartnership } from "@/hooks/useBrandPartnerships";

interface BrandPartnerSheetProps {
  partner: BrandPartnership | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const typeLabels: Record<string, string> = {
  sponsor: "Sponsor",
  collaborator: "Collaborator",
  supporter: "Supporter",
};

const typeColors: Record<string, string> = {
  sponsor: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  collaborator: "bg-primary/10 text-primary border-primary/20",
  supporter: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
};

export function BrandPartnerSheet({
  partner,
  open,
  onOpenChange,
}: BrandPartnerSheetProps) {
  if (!partner) return null;

  const socialLinks = (partner.social_links || {}) as Record<string, string>;

  const copyOfferCode = () => {
    if (partner.offer_code) {
      navigator.clipboard.writeText(partner.offer_code);
      toast.success("Offer code copied!");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="text-left">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center overflow-hidden shrink-0">
              {partner.brand_logo_url ? (
                <img
                  src={partner.brand_logo_url}
                  alt={partner.brand_name}
                  className="w-full h-full object-contain p-2"
                />
              ) : (
                <span className="text-3xl font-bold text-muted-foreground">
                  {partner.brand_name.charAt(0)}
                </span>
              )}
            </div>
            <div>
              <SheetTitle className="text-xl">{partner.brand_name}</SheetTitle>
              <Badge
                variant="outline"
                className={`mt-2 ${typeColors[partner.partnership_type]}`}
              >
                {typeLabels[partner.partnership_type]}
              </Badge>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-6">
          {/* Exclusive Offer */}
          {partner.exclusive_offer && (
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                <Gift className="h-5 w-5 text-primary" />
                <h3 className="font-medium text-primary">Exclusive Community Offer</h3>
              </div>
              <p className="text-sm mb-3">{partner.exclusive_offer}</p>

              {partner.offer_code && (
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-background rounded-lg text-sm font-mono">
                    {partner.offer_code}
                  </code>
                  <Button size="sm" variant="outline" onClick={copyOfferCode}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {partner.offer_terms && (
                <p className="text-xs text-muted-foreground mt-2">
                  {partner.offer_terms}
                </p>
              )}
            </div>
          )}

          {/* About */}
          {(partner.description || partner.about_business) && (
            <div>
              <h3 className="font-medium mb-2">About</h3>
              <p className="text-sm text-muted-foreground">
                {partner.about_business || partner.description}
              </p>
            </div>
          )}

          <Separator />

          {/* Links */}
          <div className="space-y-3">
            {partner.website_url && (
              <Button
                variant="outline"
                className="w-full justify-start"
                asChild
              >
                <a
                  href={partner.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Globe className="h-4 w-4 mr-2" />
                  Visit Website
                  <ExternalLink className="h-3.5 w-3.5 ml-auto" />
                </a>
              </Button>
            )}

            {partner.contact_email && (
              <Button
                variant="outline"
                className="w-full justify-start"
                asChild
              >
                <a href={`mailto:${partner.contact_email}`}>
                  <Mail className="h-4 w-4 mr-2" />
                  Contact Partner
                </a>
              </Button>
            )}

            {socialLinks.instagram && (
              <Button
                variant="outline"
                className="w-full justify-start"
                asChild
              >
                <a
                  href={socialLinks.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Instagram className="h-4 w-4 mr-2" />
                  Instagram
                  <ExternalLink className="h-3.5 w-3.5 ml-auto" />
                </a>
              </Button>
            )}

            {socialLinks.twitter && (
              <Button
                variant="outline"
                className="w-full justify-start"
                asChild
              >
                <a
                  href={socialLinks.twitter}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Twitter className="h-4 w-4 mr-2" />
                  Twitter
                  <ExternalLink className="h-3.5 w-3.5 ml-auto" />
                </a>
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
