import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { motion } from 'framer-motion';
import bearLogo from '@/assets/ether-bear-logo.webp';
import { isKnownPath, isPublicPath } from "@/lib/appRoutes";
import { NO_FAKE_LINE, WELCOME_HOME } from "@/content/copy";
import { SignUpPrompt } from "@/components/auth/SignUpPrompt";

interface AccessGateProps {
  children: React.ReactNode;
}

// Signed-in people leave the public landing for the feed.
const LANDING_ROUTES = ['/', '/landing'];

const AccessGate = ({ children }: AccessGateProps) => {
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const navigate = useNavigate();
  const location = useLocation();
  const [showWelcome, setShowWelcome] = useState(false);
  const [hasSeenWelcome, setHasSeenWelcome] = useState(false);

  const knownRoute = isKnownPath(location.pathname);
  const isPublicRoute = isPublicPath(location.pathname);
  const isLandingRoute = LANDING_ROUTES.includes(location.pathname);
  const legacyStreamId = location.pathname === "/live"
    ? new URLSearchParams(location.search).get("stream")
    : null;

  useEffect(() => {
    if (!knownRoute) return;
    // Wait for auth to load first
    if (authLoading) return;

    if (user && isLandingRoute) {
      navigate('/feed', { replace: true });
      return;
    }

    if (!user && legacyStreamId) {
      navigate(`/live/${legacyStreamId}`, { replace: true });
      return;
    }

    // Skip other checks for public routes (unauthenticated users)
    if (isPublicRoute && !user) return;
    
    // Wait for profile to load for authenticated users
    if (profileLoading) return;

    // Community routes render a sign-up prompt instead of the page.
    if (!user) return;

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
  }, [user, profile, authLoading, profileLoading, isPublicRoute, isLandingRoute, knownRoute, legacyStreamId, navigate, location.pathname, hasSeenWelcome]);

  if (!knownRoute) {
    return <>{children}</>;
  }

  if (!user && legacyStreamId) {
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

  // Community routes stay behind a sign-up prompt. The profile request must
  // not hold a public page: onboarding and banned redirects run once that row arrives.
  if (!isPublicRoute && !authLoading && !user) {
    return <SignUpPrompt />;
  }

  if (!isPublicRoute && (authLoading || !user)) {
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
          className="fixed inset-x-0 top-0 z-40 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          style={{ bottom: "calc(84px + env(safe-area-inset-bottom, 0px))" }}
          onClick={() => setShowWelcome(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
            className="file-panel p-8 md:p-12 text-center max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
              className="mb-6 flex justify-center"
            >
              <img src={bearLogo} alt="Ether" className="mx-auto h-28 w-auto" />
            </motion.div>
            
            <h2 className="ether-title mb-4 text-3xl text-foreground md:text-4xl">
              {WELCOME_HOME}
            </h2>
            
            <p className="text-muted-foreground mb-8">
              {NO_FAKE_LINE}
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