import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sparkles, ArrowRight } from 'lucide-react';

interface Props {
  accessLevel: 'level_1' | 'level_2' | 'level_3' | null;
}

const OnboardingCompletion = ({ accessLevel }: Props) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-lg text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="w-24 h-24 mx-auto mb-8 rounded-full bg-primary/20 flex items-center justify-center"
        >
          <Sparkles className="w-12 h-12 text-primary" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="space-y-6"
        >
          <h1 className="font-display text-4xl md:text-5xl text-foreground">
            Welcome to <span className="text-gradient-pink">ETHER</span>
          </h1>

          <div className="glass-strong rounded-2xl p-8 space-y-4 text-left">
            <p className="text-foreground text-lg leading-relaxed italic">
              If this experience felt familiar rather than foreign,
              <br />
              you are in the right place.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              ETHER is not something you join.
              <br />
              It's something you <span className="text-primary font-medium">recognize</span>.
            </p>
          </div>

          {accessLevel === 'level_3' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="bg-primary/10 border border-primary/20 rounded-xl p-4"
            >
              <p className="text-primary text-sm font-medium">
                ✦ Your responses indicate Lucuviant potential — advanced features and leadership paths await.
              </p>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            <Button
              onClick={() => navigate('/feed')}
              className="h-14 px-8 text-lg bg-primary hover:bg-primary/90 glow-pink"
            >
              Enter ETHER
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default OnboardingCompletion;
