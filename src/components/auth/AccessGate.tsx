import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { motion } from 'framer-motion';
import lcBearLogo from '@/assets/lc-bear-logo.png';

interface AccessGateProps {
  children: React.ReactNode;
}

// Routes that don't require access gate checks
const PUBLIC_ROUTES = ['/', '/auth', '/onboarding', '/locked', '/admin/onboarding', '/denied', '/admin'];

const AccessGate = ({ children }: AccessGateProps) => {
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const navigate = useNavigate();
  const location = useLocation();
  const [showWelcome, setShowWelcome] = useState(false);
  const [hasSeenWelcome, setHasSeenWelcome] = useState(false);

  const isPublicRoute = PUBLIC_ROUTES.includes(location.pathname) || location.pathname.startsWith('/admin/onboarding');

  useEffect(() => {
    // Skip checks for public routes
    if (isPublicRoute) return;
    
    // Wait for auth and profile to load
    if (authLoading || profileLoading) return;

    // If not logged in, redirect to auth
    if (!user) {
      navigate('/auth');
      return;
    }

    // If profile exists, check access
    if (profile) {
      // Check for session flag indicating user just completed onboarding
      const justCompletedOnboarding = sessionStorage.getItem('onboarding_just_completed');
      
      // If onboarding not completed and no session flag, force onboarding
      if (!profile.onboarding_completed && !justCompletedOnboarding) {
        navigate('/onboarding');
        return;
      }
      
      // Clear the session flag only after profile shows onboarding is complete
      if (profile.onboarding_completed && justCompletedOnboarding) {
        sessionStorage.removeItem('onboarding_just_completed');
      }

      // Check access_status
      const accessStatus = profile.access_status || 'pending';
      
      if (accessStatus === 'denied' || accessStatus === 'banned') {
        // Already on locked route is fine
        if (location.pathname !== '/locked') {
          navigate('/locked');
        }
        return;
      }

      // If access is active, show welcome popup once
      if (accessStatus === 'active' && !hasSeenWelcome) {
        const welcomeKey = `welcome_shown_${user.id}`;
        const alreadyShown = localStorage.getItem(welcomeKey);
        if (!alreadyShown) {
          setShowWelcome(true);
          localStorage.setItem(welcomeKey, 'true');
          setHasSeenWelcome(true);
        }
      }
    }
  }, [user, profile, authLoading, profileLoading, isPublicRoute, navigate, location.pathname, hasSeenWelcome]);

  // Show loading state while checking auth/profile
  if (!isPublicRoute && (authLoading || profileLoading)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full"
        />
      </div>
    );
  }

  return (
    <>
      {children}
      
      {/* Welcome Home Popup */}
      {showWelcome && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          onClick={() => setShowWelcome(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
            className="bg-card border border-border rounded-2xl p-8 md:p-12 text-center max-w-md mx-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
              className="w-16 h-16 mx-auto mb-6 rounded-full bg-primary/20 flex items-center justify-center"
            >
              <img src={lcBearLogo} alt="Ether" className="w-10 h-10 object-contain" />
            </motion.div>
            
            <h2 className="font-display text-3xl md:text-4xl text-foreground mb-4">
              Welcome home Familcy
            </h2>
            
            <p className="text-muted-foreground mb-8">
              You've been accepted into the community. This is where you belong.
            </p>
            
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowWelcome(false)}
              className="w-full py-3 px-6 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors"
            >
              Enter
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </>
  );
};

export default AccessGate;
