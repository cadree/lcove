import { useState } from "react";
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
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import {
  ExternalLink,
  Gift,
  Copy,
  Mail,
  Globe,
  Instagram,
  Twitter,
  ChevronLeft,
  ChevronRight,
  X,
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
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (!partner) return null;

  const socialLinks = (partner.social_links || {}) as Record<string, string>;
  const galleryImages = partner.gallery_images || [];

  const copyOfferCode = () => {
    if (partner.offer_code) {
      navigator.clipboard.writeText(partner.offer_code);
      toast.success("Offer code copied!");
    }
  };

  const openLightbox = (index: number) => setLightboxIndex(index);
  const closeLightbox = () => setLightboxIndex(null);
  const prevImage = () => {
    if (lightboxIndex !== null && lightboxIndex > 0) setLightboxIndex(lightboxIndex - 1);
  };
  const nextImage = () => {
    if (lightboxIndex !== null && lightboxIndex < galleryImages.length - 1) setLightboxIndex(lightboxIndex + 1);
  };

  return (
    <>
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

            {/* Gallery */}
            {galleryImages.length > 0 && (
              <div>
                <h3 className="font-medium mb-3">Gallery</h3>
                <div className="grid grid-cols-3 gap-2">
                  {galleryImages.map((url, index) => (
                    <button
                      key={index}
                      onClick={() => openLightbox(index)}
                      className="relative aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer group"
                    >
                      <img
                        src={url}
                        alt={`${partner.brand_name} gallery ${index + 1}`}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    </button>
                  ))}
                </div>
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

      {/* Lightbox Dialog */}
      <Dialog open={lightboxIndex !== null} onOpenChange={() => closeLightbox()}>
        <DialogContent className="max-w-3xl p-0 bg-black/95 border-none">
          <div className="relative flex items-center justify-center min-h-[50vh]">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 z-10 text-white hover:bg-white/20"
              onClick={closeLightbox}
            >
              <X className="h-5 w-5" />
            </Button>

            {lightboxIndex !== null && lightboxIndex > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-2 z-10 text-white hover:bg-white/20"
                onClick={prevImage}
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
            )}

            {lightboxIndex !== null && (
              <img
                src={galleryImages[lightboxIndex]}
                alt={`${partner.brand_name} gallery ${lightboxIndex + 1}`}
                className="max-h-[80vh] max-w-full object-contain"
              />
            )}

            {lightboxIndex !== null && lightboxIndex < galleryImages.length - 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 z-10 text-white hover:bg-white/20"
                onClick={nextImage}
              >
                <ChevronRight className="h-6 w-6" />
              </Button>
            )}

            {lightboxIndex !== null && (
              <span className="absolute bottom-3 text-white/60 text-sm">
                {lightboxIndex + 1} / {galleryImages.length}
              </span>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
