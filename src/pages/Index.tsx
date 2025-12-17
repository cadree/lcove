import PageLayout from "@/components/layout/PageLayout";
import HeroSection from "@/components/home/HeroSection";
import FeaturesSection from "@/components/home/FeaturesSection";
import FeedPreview from "@/components/home/FeedPreview";
import CTASection from "@/components/home/CTASection";

const Index = () => {
  return (
    <PageLayout>
      <HeroSection />
      <FeaturesSection />
      <FeedPreview />
      <CTASection />
    </PageLayout>
  );
};

export default Index;
