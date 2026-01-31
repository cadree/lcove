import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Gift } from "lucide-react";
import type { BrandPartnership } from "@/hooks/useBrandPartnerships";

interface BrandPartnerCardProps {
  partner: BrandPartnership;
  onClick: () => void;
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

export function BrandPartnerCard({ partner, onClick }: BrandPartnerCardProps) {
  return (
    <Card
      className="card-premium hover:border-primary/30 transition-all duration-300 cursor-pointer group"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Logo */}
          <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center overflow-hidden shrink-0">
            {partner.brand_logo_url ? (
              <img
                src={partner.brand_logo_url}
                alt={partner.brand_name}
                className="w-full h-full object-contain p-2"
              />
            ) : (
              <span className="text-2xl font-bold text-muted-foreground">
                {partner.brand_name.charAt(0)}
              </span>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium truncate">{partner.brand_name}</h3>
              <Badge
                variant="outline"
                className={`text-xs shrink-0 ${typeColors[partner.partnership_type]}`}
              >
                {typeLabels[partner.partnership_type]}
              </Badge>
            </div>

            {partner.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                {partner.description}
              </p>
            )}

            {partner.exclusive_offer && (
              <div className="flex items-center gap-1.5 text-sm text-primary">
                <Gift className="h-3.5 w-3.5" />
                <span className="truncate">{partner.exclusive_offer}</span>
              </div>
            )}
          </div>

          {/* Arrow */}
          <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
}
