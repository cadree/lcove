import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { XCircle } from 'lucide-react';

const OnboardingDenied = () => {
  const { signOut } = useAuth();

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
          className="w-24 h-24 mx-auto mb-8 rounded-full bg-muted flex items-center justify-center"
        >
          <XCircle className="w-12 h-12 text-muted-foreground" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="space-y-6"
        >
          <h1 className="font-display text-4xl md:text-5xl text-foreground">
            Not Yet
          </h1>

          <div className="glass-strong rounded-2xl p-8 space-y-4">
            <p className="text-foreground text-lg leading-relaxed">
              ETHER isn't for everyone — and that's by design.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              This community is built for those who resonate with its principles of radical responsibility, 
              creative sovereignty, and harmonized collaboration.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Your answers suggest you may not align with these values at this time.
              That doesn't mean you never will.
            </p>
            <p className="text-primary font-medium">
              Growth is always possible. Come back when you're ready.
            </p>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            <Button
              onClick={() => signOut()}
              variant="outline"
              className="h-12 px-8"
            >
              Sign Out
            </Button>
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default OnboardingDenied;
