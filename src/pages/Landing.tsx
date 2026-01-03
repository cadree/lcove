import { useState } from "react";
import { LandingNav } from "@/components/landing/LandingNav";
import { LandingHero } from "@/components/landing/LandingHero";
import { PersonaCards } from "@/components/landing/PersonaCards";
import { BenefitsCarousel } from "@/components/landing/BenefitsCarousel";
import { TestimonialsSection } from "@/components/landing/TestimonialsSection";
import { StatsRow } from "@/components/landing/StatsRow";
import { TrustSection } from "@/components/landing/TrustSection";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { CreatorApplicationDialog } from "@/components/landing/CreatorApplicationDialog";

const Landing = () => {
  const [creatorDialogOpen, setCreatorDialogOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <LandingNav />
      
      <main className="pt-20">
        <LandingHero />
        <StatsRow />
        <PersonaCards />
        <BenefitsCarousel />
        <TestimonialsSection />
        <TrustSection />
      </main>
      
      <LandingFooter />
      
      <CreatorApplicationDialog 
        open={creatorDialogOpen} 
        onOpenChange={setCreatorDialogOpen} 
      />
    </div>
  );
};

export default Landing;
