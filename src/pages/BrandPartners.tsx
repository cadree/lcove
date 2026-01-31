import { useState } from "react";
import PageLayout from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { BrandPartnerCard } from "@/components/brandpartners/BrandPartnerCard";
import { BrandPartnerSheet } from "@/components/brandpartners/BrandPartnerSheet";
import { BrandApplicationDialog } from "@/components/brandpartners/BrandApplicationDialog";
import { useBrandPartnerships, type BrandPartnership } from "@/hooks/useBrandPartnerships";
import { Building2, Handshake, Gift } from "lucide-react";
import { motion } from "framer-motion";

type FilterType = "all" | "sponsor" | "collaborator" | "supporter";

export default function BrandPartners() {
  const [filter, setFilter] = useState<FilterType>("all");
  const [selectedPartner, setSelectedPartner] = useState<BrandPartnership | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [applicationOpen, setApplicationOpen] = useState(false);

  const { data: partners, isLoading } = useBrandPartnerships();

  const filteredPartners = partners?.filter(
    (p) => filter === "all" || p.partnership_type === filter
  );

  const handlePartnerClick = (partner: BrandPartnership) => {
    setSelectedPartner(partner);
    setSheetOpen(true);
  };

  return (
    <PageLayout>
      <div className="container max-w-2xl py-6 px-4">
        <h1 className="text-2xl font-display font-medium mb-6">Brand Partners</h1>
        
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="mb-6 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center shrink-0">
                  <Handshake className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-display font-medium mb-1">
                    Exclusive Community Offers
                  </h2>
                  <p className="text-muted-foreground text-sm mb-4">
                    Our brand partners offer exclusive deals and benefits just for
                    Ether community members. Discover special discounts, early access,
                    and more.
                  </p>
                  <Button onClick={() => setApplicationOpen(true)}>
                    <Building2 className="h-4 w-4 mr-2" />
                    Become a Partner
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
          <Badge
            variant={filter === "all" ? "default" : "secondary"}
            className="cursor-pointer shrink-0"
            onClick={() => setFilter("all")}
          >
            All Partners
          </Badge>
          <Badge
            variant={filter === "sponsor" ? "default" : "secondary"}
            className="cursor-pointer shrink-0"
            onClick={() => setFilter("sponsor")}
          >
            Sponsors
          </Badge>
          <Badge
            variant={filter === "collaborator" ? "default" : "secondary"}
            className="cursor-pointer shrink-0"
            onClick={() => setFilter("collaborator")}
          >
            Collaborators
          </Badge>
          <Badge
            variant={filter === "supporter" ? "default" : "secondary"}
            className="cursor-pointer shrink-0"
            onClick={() => setFilter("supporter")}
          >
            Supporters
          </Badge>
        </div>

        {/* Partners List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ) : filteredPartners && filteredPartners.length > 0 ? (
          <div className="space-y-3">
            {filteredPartners.map((partner, index) => (
              <motion.div
                key={partner.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <BrandPartnerCard
                  partner={partner}
                  onClick={() => handlePartnerClick(partner)}
                />
              </motion.div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Gift}
            title="No partners found"
            description={
              filter === "all"
                ? "Be the first brand to partner with us!"
                : `No ${filter}s yet. Check back soon!`
            }
            action={{
              label: "Apply to Partner",
              onClick: () => setApplicationOpen(true),
            }}
          />
        )}

        <BrandPartnerSheet
          partner={selectedPartner}
          open={sheetOpen}
          onOpenChange={setSheetOpen}
        />

        <BrandApplicationDialog
          open={applicationOpen}
          onOpenChange={setApplicationOpen}
        />
      </div>
    </PageLayout>
  );
}
