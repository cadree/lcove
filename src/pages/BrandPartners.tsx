import { useState } from "react";
import PageLayout from "@/components/layout/PageLayout";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { BrandPartnerCard } from "@/components/brandpartners/BrandPartnerCard";
import { BrandPartnerSheet } from "@/components/brandpartners/BrandPartnerSheet";
import { BrandApplicationForm } from "@/components/brandpartners/BrandApplicationForm";
import { useBrandPartnerships, type BrandPartnership } from "@/hooks/useBrandPartnerships";
import { Gift } from "lucide-react";
import { motion } from "framer-motion";

type FilterType = "all" | "sponsor" | "collaborator" | "supporter";

export default function BrandPartners() {
  const [filter, setFilter] = useState<FilterType>("all");
  const [selectedPartner, setSelectedPartner] = useState<BrandPartnership | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

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
      <div className="container max-w-4xl py-6 px-4">
        <h1 className="text-2xl font-display font-medium mb-6">Brand Partners</h1>
        
        {/* Application Form - Always Visible */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <BrandApplicationForm />
        </motion.div>

        {/* Current Partners Section */}
        <div className="space-y-4">
          <h2 className="text-lg font-display font-medium text-muted-foreground">
            Current Partners
          </h2>

          {/* Filter Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
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
              title="No partners yet"
              description={
                filter === "all"
                  ? "Be the first brand to partner with us using the form above!"
                  : `No ${filter}s yet. Check back soon!`
              }
            />
          )}
        </div>

        <BrandPartnerSheet
          partner={selectedPartner}
          open={sheetOpen}
          onOpenChange={setSheetOpen}
        />
      </div>
    </PageLayout>
  );
}
