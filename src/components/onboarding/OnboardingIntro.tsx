import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { HERO_TAGLINE, NO_FAKE_LINE, QUIZ_INTRO_COPY } from '@/content/copy';

interface Props {
  onNext: () => void;
}

const OnboardingIntro = ({ onNext }: Props) => {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-lg text-center"
      >
        <h1 className="ether-title text-4xl text-foreground md:text-5xl">
          {HERO_TAGLINE}
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-foreground">
          {QUIZ_INTRO_COPY}
        </p>
        <p className="mt-4 text-foreground">
          {NO_FAKE_LINE}
        </p>
        <Button
          onClick={onNext}
          className="mt-10 h-14 px-8 text-lg"
        >
          Continue
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </motion.div>
    </div>
  );
};

export default OnboardingIntro;
