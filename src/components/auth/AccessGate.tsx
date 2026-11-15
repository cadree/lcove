import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import bearLogo from '@/assets/ether-bear-logo.webp';
import { isKnownPath, isPublicPath } from "@/lib/appRoutes";
import { NO_FAKE_LINE, WELCOME_HOME } from "@/content/copy";
import { SignUpPrompt } from "@/components/auth/SignUpPrompt";
import { accessPath } from "@/lib/accessPath";
import { FIRST_RUN_PATH } from "@/lib/firstRun";
import { EVENT_RETURN_KEY, eventReturnPath, rememberEventReturn } from "../../../functions/_shared/eventShare.js";

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
        rememberEventReturn(`${location.pathname}${location.search}`);
        navigate('/onboarding');
        return;
      }

      if (profile.onboarding_completed) {
        const stored = eventReturnPath(sessionStorage.getItem(EVENT_RETURN_KEY));
        if (stored && stored.split("#")[0] === `${location.pathname}${location.search}`) {
          sessionStorage.removeItem(EVENT_RETURN_KEY);
        }
      }
      
      // Clear the session flag only after profile shows onboarding is complete
      if (profile.onboarding_completed && justCompletedOnboarding) {
        sessionStorage.removeItem('onboarding_just_completed');
      }

      const next = accessPath(
        { onboarding_completed: profile.onboarding_completed, access_status: profile.access_status },
        `${location.pathname}${location.search}`,
      );
      if (next === '/pending' && location.pathname !== '/pending') {
        navigate('/pending', { replace: true });
        return;
      }
      if (next === '/denied' && location.pathname !== '/denied') {
        navigate('/denied', { replace: true });
        return;
      }
      if (next === '/locked' && location.pathname !== '/locked') {
        navigate('/locked', { replace: true });
        return;
      }
      if (location.pathname === '/pending' && next !== '/pending') {
        navigate(next === '/feed' ? FIRST_RUN_PATH : next, { replace: true });
        return;
      }
      if ((location.pathname === '/locked' || location.pathname === '/denied') && next !== location.pathname) {
        navigate(profile.onboarding_completed ? '/feed' : '/onboarding', { replace: true });
        return;
      }

      const accessStatus = profile.access_status || 'pending';

      // Welcome only after a human has let the person in.
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
  }, [user, profile, authLoading, profileLoading, isPublicRoute, isLandingRoute, knownRoute, legacyStreamId, navigate, location.pathname, location.search, hasSeenWelcome]);

  if (!knownRoute) {
    return <>{children}</>;
  }

  if (!user && legacyStreamId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary motion-reduce:animate-none" />
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