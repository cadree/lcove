import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import bearLogo from '@/assets/ether-bear-logo.webp';
import { isKnownPath, isPublicPath } from "@/lib/appRoutes";
import { NO_FAKE_LINE, WELCOME_HOME } from "@/content/copy";

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

  useEffect(() => {
    if (!knownRoute) return;
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
  }, [user, profile, authLoading, profileLoading, isPublicRoute, isLandingRoute, knownRoute, navigate, location.pathname, hasSeenWelcome]);

  if (!knownRoute) {
    return <>{children}</>;
  }

  // Private routes stay behind sign-in. The profile request must not hold the
  // route: onboarding and banned redirects run once that row arrives.
  if (!isPublicRoute && (authLoading || !user)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary motion-reduce:animate-none" />
      </div>
    );
  }

  return (
    <>
      {children}
      
      {/* Welcome Home Popup */}
      {showWelcome && (
        <div
          className="fixed inset-x-0 top-0 z-40 flex animate-fade-in items-center justify-center bg-background/80 backdrop-blur-sm motion-reduce:animate-none"
          style={{ bottom: "calc(84px + env(safe-area-inset-bottom, 0px))" }}
          onClick={() => setShowWelcome(false)}
        >
          <div
            className="file-panel mx-4 max-w-md animate-fade-in p-8 text-center motion-reduce:animate-none md:p-12"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 flex justify-center">
              <img src={bearLogo} alt="Ether" className="mx-auto h-28 w-auto" width={112} height={112} />
            </div>

            <h2 className="ether-title mb-4 text-3xl text-foreground md:text-4xl">
              {WELCOME_HOME}
            </h2>

            <p className="mb-8 text-muted-foreground">
              {NO_FAKE_LINE}
            </p>

            <button
              type="button"
              onClick={() => setShowWelcome(false)}
              className="w-full rounded-xl bg-primary px-6 py-3 font-medium text-primary-foreground transition-transform hover:scale-[1.02] hover:bg-primary/90 active:scale-[0.98] motion-reduce:transform-none"
            >
              Enter
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default AccessGate;