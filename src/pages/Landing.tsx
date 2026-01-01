import { useState } from "react";
import { LandingNav } from "@/components/landing/LandingNav";
import { LandingHero } from "@/components/landing/LandingHero";
import { PersonaCards } from "@/components/landing/PersonaCards";
import { BenefitsGrid } from "@/components/landing/BenefitsGrid";
import { TestimonialsSection } from "@/components/landing/TestimonialsSection";
import { StatsRow } from "@/components/landing/StatsRow";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { TrustSection } from "@/components/landing/TrustSection";
import { FinalCTA } from "@/components/landing/FinalCTA";
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
        <BenefitsGrid />
        <HowItWorks />
        <TestimonialsSection />
        <TrustSection />
        <FinalCTA onOpenCreatorApplication={() => setCreatorDialogOpen(true)} />
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
