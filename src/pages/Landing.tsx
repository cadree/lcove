import { useLocation } from "react-router-dom";
import { LandingNav } from "@/components/landing/LandingNav";
import { LandingHero } from "@/components/landing/LandingHero";
import { FeaturePreview } from "@/components/landing/FeaturePreview";
import { BenefitsCarousel } from "@/components/landing/BenefitsCarousel";
import { TrustSection } from "@/components/landing/TrustSection";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { HERO_TAGLINE } from "@/content/copy";
import { PageMeta } from "@/components/seo/PageMeta";

const Landing = () => {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <PageMeta title="Ether" description={HERO_TAGLINE} />
      <LandingNav />

      <main className="pt-20">
        <LandingHero />
        <FeaturePreview joinSearch={location.search} />
        <BenefitsCarousel />
        <TrustSection />
      </main>

      <LandingFooter />
    </div>
  );
};

export default Landing;
