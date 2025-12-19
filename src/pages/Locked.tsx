import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Lock, LogOut } from 'lucide-react';

const Locked = () => {
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="w-20 h-20 mx-auto mb-8 rounded-full bg-muted flex items-center justify-center"
        >
          <Lock className="w-10 h-10 text-muted-foreground" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-6"
        >
          <h1 className="font-display text-2xl md:text-3xl text-foreground">
            Lcove — this app is no longer available to access.
          </h1>

          <div className="h-px bg-border my-8" />

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <Button
              onClick={handleSignOut}
              variant="outline"
              className="h-12 px-8 gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Locked;
