import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { isKnownPath, isPublicPath } from "@/lib/appRoutes";
import { SignUpPrompt } from "@/components/auth/SignUpPrompt";
import { accessPath } from "@/lib/accessPath";
import { FIRST_RUN_PATH, welcomeStep, type WelcomeStatus } from "@/lib/firstRun";
import { callRpc } from "@/lib/rpc";
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

    }
  }, [user, profile, authLoading, profileLoading, isPublicRoute, isLandingRoute, knownRoute, legacyStreamId, navigate, location.pathname, location.search]);

  // An approved creative registers the card once. Without a card they are sent
  // to /welcome; with one, the gate finishes the welcome and never redirects,
  // so a missed "Continue to Explore" tap cannot trap them. Legacy members
  // without an acceptance event are not interrupted.
  useEffect(() => {
    if (!user?.id || authLoading || profileLoading || !profile?.onboarding_completed || profile.access_status !== 'active') return;
    if (location.pathname === FIRST_RUN_PATH) return;
    let cancelled = false;
    callRpc<WelcomeStatus>('get_my_familcy_welcome_status')
      .then((status) => {
        if (cancelled) return;
        const step = welcomeStep(status, location.pathname, location.search);
        if (step.kind === 'redirect') navigate(step.to, { replace: true });
        if (step.kind === 'finish') void callRpc<void>('complete_my_familcy_welcome').catch(() => undefined);
      })
      .catch(() => { /* A temporary lookup failure must not erase approval. */ });
    return () => { cancelled = true; };
  }, [user?.id, authLoading, profileLoading, profile?.onboarding_completed, profile?.access_status, location.pathname, location.search, navigate]);

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

  return <>{children}</>;
};

export default AccessGate;
