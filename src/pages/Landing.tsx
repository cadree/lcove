import { Link, useLocation } from "react-router-dom";
import { LandingNav } from "@/components/landing/LandingNav";
import { LandingHero } from "@/components/landing/LandingHero";
import { PersonaCards } from "@/components/landing/PersonaCards";
import { BenefitsCarousel } from "@/components/landing/BenefitsCarousel";
import { TestimonialsSection } from "@/components/landing/TestimonialsSection";
import { TrustSection } from "@/components/landing/TrustSection";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { GENERATIVE_AI_RULE } from "@/content/copy";
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
        <section className="pb-8">
          <div className="mx-auto max-w-md px-4 text-center sm:px-6 lg:max-w-lg">
            <Link to="/guidelines" className="text-sm leading-relaxed text-muted-foreground underline">
              {GENERATIVE_AI_RULE}
            </Link>
          </div>
        </section>
        <PersonaCards joinSearch={location.search} />
        <BenefitsCarousel />
        <TestimonialsSection />
        <TrustSection />
      </main>

      <LandingFooter />
    </div>
  );
};

export default Landing;
