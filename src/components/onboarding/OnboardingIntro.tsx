import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles } from 'lucide-react';

interface Props {
  onNext: () => void;
}

const OnboardingIntro = ({ onNext }: Props) => {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-background via-background to-primary/5">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-lg text-center"
      >
        {/* Logo/Brand */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mx-auto mb-6 glow-pink">
            <Sparkles className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="font-display text-5xl md:text-6xl text-gradient-pink mb-2">
            Welcome
          </h1>
          <p className="text-muted-foreground text-lg">
            You're about to enter something different
          </p>
        </motion.div>

        {/* Philosophy */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-strong rounded-2xl p-8 space-y-6 text-left mb-8"
        >
          <div className="space-y-4">
            <p className="text-foreground text-lg leading-relaxed">
              This is <span className="text-primary font-medium">not</span> a social network.
            </p>
            <p className="text-foreground text-lg leading-relaxed">
              There are no follower counts. No algorithmic games. No engagement bait.
            </p>
            <p className="text-foreground text-lg leading-relaxed">
              This is a <span className="text-primary font-medium">creative ecosystem</span> — a space for builders, makers, and dreamers who want to create without the noise.
            </p>
          </div>
          
          <div className="border-t border-border/50 pt-6">
            <p className="text-muted-foreground text-sm italic">
              "What you're about to share will help us understand who you are — not to judge, but to connect you with the right people and opportunities."
            </p>
          </div>
        </motion.div>

        {/* Values */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex flex-wrap justify-center gap-3 mb-8"
        >
          {['Trust', 'Clarity', 'Contribution', 'Culture'].map((value, i) => (
            <motion.span
              key={value}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 + i * 0.1 }}
              className="px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium"
            >
              {value}
            </motion.span>
          ))}
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
        >
          <Button
            onClick={onNext}
            className="h-14 px-8 text-lg bg-primary hover:bg-primary/90 glow-pink"
          >
            I'm ready
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <p className="text-muted-foreground text-xs mt-4">
            This will take about 3-5 minutes
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default OnboardingIntro;
