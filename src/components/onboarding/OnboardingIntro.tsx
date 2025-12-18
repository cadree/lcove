import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

interface Props {
  onNext: () => void;
}

const OnboardingIntro = ({ onNext }: Props) => {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-lg text-center"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-10"
        >
          <h1 className="font-display text-5xl md:text-6xl text-gradient-pink mb-4">
            Before we begin
          </h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-strong rounded-2xl p-8 space-y-6 text-left"
        >
          <p className="text-foreground text-lg leading-relaxed">
            This is not a test.
          </p>
          <p className="text-foreground text-lg leading-relaxed">
            There are no right or wrong answers.
          </p>
          <p className="text-foreground text-lg leading-relaxed">
            This is simply a mirror.
          </p>
          <p className="text-primary text-lg font-medium leading-relaxed">
            Answer honestly, not aspirationally.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-8"
        >
          <Button
            onClick={onNext}
            className="h-14 px-8 text-lg bg-primary hover:bg-primary/90 glow-pink"
          >
            I understand
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default OnboardingIntro;
