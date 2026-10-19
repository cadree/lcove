import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { motion } from 'framer-motion';
import lcBearLogo from '@/assets/lc-bear-logo.png';

interface AccessGateProps {
  children: React.ReactNode;
}

// Exact paths a logged-out visitor can open.
const PUBLIC_EXACT = new Set([
  '/',
  '/landing',
  '/auth',
  '/onboarding',
  '/locked',
  '/admin/onboarding',
  '/denied',
  '/admin',
  '/fund',
  '/unsubscribe',
  '/privacy',
  '/terms',
  '/guidelines',
  '/community',
  '/nuance',
]);

// Signed-in people leave the public landing for the feed.
const LANDING_ROUTES = ['/', '/landing'];

function isPublicPath(pathname: string) {
  if (PUBLIC_EXACT.has(pathname)) return true;
  return (
    pathname.startsWith('/admin/onboarding') ||
    pathname.startsWith('/event/') ||
    pathname.startsWith('/project/') ||
    pathname.startsWith('/book/') ||
    pathname.startsWith('/sign-contract') ||
    pathname.startsWith('/client/')
  );
}

const AccessGate = ({ children }: AccessGateProps) => {
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const navigate = useNavigate();
  const location = useLocation();
  const [showWelcome, setShowWelcome] = useState(false);
  const [hasSeenWelcome, setHasSeenWelcome] = useState(false);

  const isPublicRoute = isPublicPath(location.pathname);
  const isLandingRoute = LANDING_ROUTES.includes(location.pathname);

  useEffect(() => {
    // Wait for auth to load first
    if (authLoading) return;

    if (user && isLandingRoute) {
      navigate('/feed', { replace: true });
      return;
    }

    // Skip other checks for public routes (unauthenticated users)
    if (isPublicRoute && !user) return;
    
    // Wait for profile to load for authenticated users
    if (profileLoading) return;

    // If not logged in and not on public route, redirect to auth
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

      // Banned accounts stay on the locked screen. Finishing onboarding
      // never denies access, and existing denied rows are opened by migration.
      const accessStatus = profile.access_status || 'pending';
      
      if (accessStatus === 'banned') {
        if (location.pathname !== '/locked') {
          navigate('/locked');
        }
        return;
      }

      if (location.pathname === '/locked') {
        navigate(profile.onboarding_completed ? '/feed' : '/onboarding');
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
  }, [user, profile, authLoading, profileLoading, isPublicRoute, isLandingRoute, navigate, location.pathname, hasSeenWelcome]);

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
            <motion.img
              src={lcBearLogo}
              alt="Ether"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
              className="w-24 h-24 mx-auto mb-6 object-contain"
            />
            
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