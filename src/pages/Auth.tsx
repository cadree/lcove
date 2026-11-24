import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { z } from 'zod';
import { Capacitor } from '@capacitor/core';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { PENDING_SIGNUP_KEY, applyPendingSignupProfile, inviteTokenFromMetadata } from '@/lib/pendingSignup';
import { displayNameError } from '@/lib/displayName';
import { normalizedMemberReferralCode, type MemberReferralPreview } from '@/lib/memberReferrals';
import { callRpc } from '@/lib/rpc';
import { captureSignupAttribution } from '@/lib/signupAttribution';
import { WAITLIST_MODE } from '@/config/launch';
import { PageMeta } from '@/components/seo/PageMeta';
import { EMAIL_CONFIRMED_BODY, EMAIL_CONFIRMED_TITLE, HERO_TAGLINE, VERIFY_SIGNAL_BODY, VERIFY_SIGNAL_TITLE } from '@/content/copy';
import { getAuthRedirectUrl } from '@/lib/capacitorStorage';
import { RESEND_COOLDOWN_MS } from '@/lib/resendCooldown';
import { BANNED_ACCOUNT_HELP, classifySignup, emailSendingHelp, isBannedAuthError, resendWaitRemaining, retryAfterSeconds, signupEmailDeliveryFailed, signupLimitNextStep, SIGNUP_NOT_SENT_NOTE } from '@/lib/signupRecovery';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { logAuthEvent, logAuthError } from '@/lib/authDebug';
import { Eye, EyeOff, Mail, Lock, ArrowRight, ArrowLeft, User, Wifi, WifiOff } from 'lucide-react';
import { EtherWordmark } from '@/components/brand/EtherWordmark';
import { eventReturnPath, rememberEventReturn } from '../../functions/_shared/eventShare.js';

const signupSchema = z.object({
  email: z.string().email('Please enter a valid email').max(255),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
  // Same rule as onboarding, so a name sign-up accepts never stalls step 1.
  displayName: z.string().superRefine((value, ctx) => {
    const message = displayNameError(value);
    if (message) ctx.addIssue({ code: z.ZodIssueCode.custom, message });
  }),
});

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email').max(255),
  password: z.string().min(6, 'Password must be at least 6 characters').max(100),
});

const emailSchema = z.object({
  email: z.string().email('Please enter a valid email').max(255),
});

const passwordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
});

type AuthMode = 'login' | 'signup' | 'forgot' | 'reset' | 'confirm-email' | 'confirmed-signin' | 'account-exists';

/**
 * Map Supabase auth errors to user-friendly messages
 */
const getAuthErrorMessage = (error: Error & { code?: string; status?: number }): { title: string; description: string } => {
  const limitHelp = emailSendingHelp(error);
  if (limitHelp) return limitHelp;
  if (isBannedAuthError(error)) return { ...BANNED_ACCOUNT_HELP };
  if (signupEmailDeliveryFailed(error)) {
    return {
      title: 'Email couldn’t be sent',
      description: 'We couldn’t send your code just now. Try Resend code in a minute, or sign in if you already verified your email.',
    };
  }
  const message = error.message.toLowerCase();
  
  // Network errors
  if (message.includes('load failed') || message.includes('failed to fetch')) {
    return {
      title: 'Connection Error',
      description: 'Unable to reach the server. Please check your internet connection and try again.',
    };
  }
  if (message.includes('network') || message.includes('networkerror')) {
    return {
      title: 'Network Error',
      description: 'Your device appears to be offline. Please check your connection.',
    };
  }
  if (message.includes('timeout')) {
    return {
      title: 'Request Timeout',
      description: 'The server took too long to respond. Please try again.',
    };
  }
  
  // Auth errors
  if (message.includes('invalid login credentials')) {
    return {
      title: 'Invalid Credentials',
      description: 'Email or password is incorrect. Please try again.',
    };
  }
  if (message.includes('otp_expired') || message.includes('token has expired') || message.includes('invalid token') || message.includes('token is expired')) {
    return { title: 'Code expired', description: 'Request a new verification code below, or sign in if your email is already confirmed.' };
  }
  if (message.includes('email not confirmed')) {
    return {
      title: 'Email Not Confirmed',
      description: 'Please check your email and click the confirmation link.',
    };
  }
  if (message.includes('already registered') || message.includes('already exists')) {
    return {
      title: 'Account Exists',
      description: 'This email is already registered. Please log in instead.',
    };
  }
  if (message.includes('rate limit') || message.includes('too many requests')) {
    return {
      title: 'Too Many Attempts',
      description: 'Please wait a moment before trying again.',
    };
  }
  if (message.includes('password') && message.includes('weak')) {
    return {
      title: 'Weak Password',
      description: 'Please choose a stronger password with at least 8 characters.',
    };
  }
  
  // Default fallback with actual error for debugging
  return {
    title: 'Authentication Error',
    description: error.message || 'An unexpected error occurred. Please try again.',
  };
};

const Auth = () => {
  const [searchParams] = useSearchParams();
  const isResetMode = searchParams.get('reset') === 'true';
  const tab = searchParams.get('tab');
  
  const [mode, setMode] = useState<AuthMode>(
    isResetMode ? 'reset' : tab === 'join' ? 'signup' : 'login',
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; displayName?: string }>({});
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [confirmationSentAt, setConfirmationSentAt] = useState<number | null>(null);
  const [emailCode, setEmailCode] = useState('');
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [resendNow, setResendNow] = useState(() => Date.now());
  const [isResending, setIsResending] = useState(false);
  // Server-side wait (from a 429), which can be longer than the local cooldown.
  const [resendBlockedUntil, setResendBlockedUntil] = useState<number | null>(null);
  // Stays on screen; a toast disappears before people read it.
  const [recoveryNote, setRecoveryNote] = useState<string | null>(null);
  const [isSendingLink, setIsSendingLink] = useState(false);
  const inviteToken = searchParams.get('invite')?.trim() ?? '';
  const referralCode = normalizedMemberReferralCode(searchParams.get('ref'));
  const [referralPreview, setReferralPreview] = useState<MemberReferralPreview | null>(null);
  const [referralChecking, setReferralChecking] = useState(Boolean(referralCode));
  const [inviteEmail, setInviteEmail] = useState<string | null>(null);
  const [inviteState, setInviteState] = useState<'none' | 'checking' | 'ready' | 'inactive'>(
    inviteToken ? 'checking' : 'none',
  );

  const { signIn, signUp, user, loading: authLoading, resetPassword, updatePassword } = useAuth();
  const [termsAccepted, setTermsAccepted] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (confirmationSentAt == null && resendBlockedUntil == null) return;
    setResendNow(Date.now());
    const id = window.setInterval(() => setResendNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [confirmationSentAt, resendBlockedUntil]);

  const resendWaitMs = resendWaitRemaining(confirmationSentAt, resendBlockedUntil, resendNow, RESEND_COOLDOWN_MS);

  const confirmedRedirectPath = inviteToken
    ? `/auth?confirmed=1&invite=${encodeURIComponent(inviteToken)}`
    : '/auth?confirmed=1';

  /** Respect the server's wait after a 429 so the button counts down instead of failing again. */
  const noteEmailLimit = (error: { message?: string } | null | undefined) => {
    const seconds = retryAfterSeconds(error);
    setResendBlockedUntil(Date.now() + (seconds ?? 60) * 1000);
  };

  const handleResendConfirmation = async () => {
    if (isResending || resendWaitMs > 0) return;
    if (!emailSchema.safeParse({ email }).success) {
      setErrors({ email: 'Enter your signup email to request a new code.' });
      return;
    }
    setErrors({});
    setRecoveryNote(null);
    setIsResending(true);
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: getAuthRedirectUrl(confirmedRedirectPath),
      },
    });
    setIsResending(false);
    if (error) {
      const { title, description } = getAuthErrorMessage(error);
      if (emailSendingHelp(error)) noteEmailLimit(error);
      setRecoveryNote(description);
      toast({ title, description, variant: 'destructive' });
      return;
    }
    setEmailCode('');
    setMode('confirm-email');
    setConfirmationSentAt(Date.now());
    setResendBlockedUntil(null);
    // Auth answers 200 here even when the email is already verified and nothing
    // was sent, so say what to do if no code shows up.
    setRecoveryNote('If this email still needs verifying, a new 6-digit code is on its way (check spam). Nothing after a minute? It may already be verified: sign in, or email yourself a sign-in link.');
    toast({
      title: 'Check your email',
      description: 'If your email still needs verification, we sent a new code.',
    });
  };

  /** Works for a verified email that never finished joining: one tap from the inbox back into the app. */
  const handleSendSignInLink = async () => {
    if (isSendingLink || resendWaitMs > 0) return;
    if (!emailSchema.safeParse({ email }).success) {
      setErrors({ email: 'Enter your email to get a sign-in link.' });
      return;
    }
    setErrors({});
    setIsSendingLink(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo: getAuthRedirectUrl(confirmedRedirectPath) },
    });
    setIsSendingLink(false);
    if (error) {
      logAuthError('Sign-in link failed', error);
      const { title, description } = getAuthErrorMessage(error);
      if (emailSendingHelp(error)) noteEmailLimit(error);
      setRecoveryNote(description);
      toast({ title, description, variant: 'destructive' });
      return;
    }
    logAuthEvent('Sign-in link sent');
    setConfirmationSentAt(Date.now());
    setRecoveryNote(`Sign-in link sent to ${email}. Open it on this phone or in this browser to pick up where you left off. If you hadn’t verified yet, the email has a code instead.`);
    toast({ title: 'Check your email', description: 'We sent you a sign-in link.' });
  };


  const handleVerifyEmailCode = async () => {
    const token = emailCode.replace(/\s+/g, '');
    if (token.length < 6 || isVerifyingCode || !email) return;
    setIsVerifyingCode(true);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'signup',
    });
    setIsVerifyingCode(false);
    if (error) {
      const { title, description } = getAuthErrorMessage(error);
      toast({ title, description, variant: 'destructive' });
      return;
    }
    logAuthEvent('Signup email code verified');
  };

  // Log platform info on mount. mode is read from a ref so this stays mount-only.
  const modeRef = useRef(mode);
  modeRef.current = mode;
  useEffect(() => {
    logAuthEvent('Auth page mounted', {
      platform: Capacitor.getPlatform(),
      isNative: Capacitor.isNativePlatform(),
      isOnline: navigator.onLine,
      mode: modeRef.current,
    });
  }, []);

  useEffect(() => {
    if (!referralCode) return;
    let cancelled = false;
    setReferralChecking(true);
    callRpc<MemberReferralPreview | null>('preview_member_referral', { p_code: referralCode })
      .then((preview) => { if (!cancelled) setReferralPreview(preview); })
      .catch(() => { if (!cancelled) setReferralPreview(null); })
      .finally(() => { if (!cancelled) setReferralChecking(false); });
    return () => { cancelled = true; };
  }, [referralCode]);

  useEffect(() => {
    if (!inviteToken) return;
    let cancelled = false;
    setInviteState('checking');
    supabase.rpc('preview_waitlist_invite', { p_token: inviteToken }).then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data) {
        setInviteState('inactive');
        return;
      }
      const existing = sessionStorage.getItem(PENDING_SIGNUP_KEY);
      let parsed: { displayName?: string; phone?: string } = {};
      try {
        parsed = existing ? JSON.parse(existing) : {};
      } catch {
        parsed = {};
      }
      sessionStorage.setItem(PENDING_SIGNUP_KEY, JSON.stringify({ ...parsed, inviteToken }));
      setInviteEmail(data);
      setEmail(data);
      setMode('signup');
      setInviteState('ready');
    });
    return () => {
      cancelled = true;
    };
  }, [inviteToken]);

  useEffect(() => {
    if (!user || mode === 'reset' || mode === 'forgot') return;
    if (inviteToken && inviteState === 'checking') return;
    let cancelled = false;
    applyPendingSignupProfile(user.id, inviteTokenFromMetadata(user.user_metadata), user.user_metadata).then((result) => {
      if (cancelled) return;
      if (result === 'invite-failed') {
        toast({
          title: 'Invite not applied',
          description: 'Sign up with the invited email.',
          variant: 'destructive',
        });
        return;
      }
      const vouchReturn = searchParams.get('redirect') || '';
      if (/^\/vouch\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(vouchReturn)) {
        navigate(vouchReturn, { replace: true });
        return;
      }
      const eventReturn = eventReturnPath(searchParams.get('redirect'));
      if (eventReturn) {
        rememberEventReturn(eventReturn);
        logAuthEvent('User authenticated, returning to the event');
        navigate(eventReturn, { replace: true });
        return;
      }
      logAuthEvent('User authenticated, continuing to onboarding');
      navigate('/onboarding', { replace: searchParams.get('confirmed') === '1' });
    });
    return () => {
      cancelled = true;
    };
  }, [user, navigate, mode, inviteToken, inviteState, searchParams]);

  useEffect(() => {
    captureSignupAttribution(window.location.search, window.location.pathname, window.localStorage);
  }, []);

  useEffect(() => {
    if (isResetMode) {
      setMode('reset');
      return;
    }
    if (tab === 'join') setMode('signup');
    else if (tab === 'signin' || tab === 'login') setMode('login');
  }, [isResetMode, tab]);

  const confirmedRedirect = searchParams.get('confirmed') === '1';
  useEffect(() => {
    if (!confirmedRedirect || authLoading || user) return;
    setMode('confirmed-signin');
  }, [confirmedRedirect, authLoading, user]);

  const validateForm = () => {
    if (mode === 'forgot') {
      const result = emailSchema.safeParse({ email });
      if (!result.success) {
        setErrors({ email: result.error.errors[0]?.message });
        return false;
      }
    } else if (mode === 'reset') {
      const result = passwordSchema.safeParse({ password });
      if (!result.success) {
        setErrors({ password: result.error.errors[0]?.message });
        return false;
      }
    } else if (mode === 'signup') {
      const result = signupSchema.safeParse({ email, password, displayName });
      if (!result.success) {
        const fieldErrors: { email?: string; password?: string; displayName?: string } = {};
        result.error.errors.forEach((err) => {
          const field = err.path[0] as string;
          fieldErrors[field as keyof typeof fieldErrors] = err.message;
        });
        setErrors(fieldErrors);
        return false;
      }
    } else {
      const result = loginSchema.safeParse({ email, password });
      if (!result.success) {
        const fieldErrors: { email?: string; password?: string } = {};
        result.error.errors.forEach((err) => {
          if (err.path[0] === 'email') fieldErrors.email = err.message;
          if (err.path[0] === 'password') fieldErrors.password = err.message;
        });
        setErrors(fieldErrors);
        return false;
      }
    }
    setErrors({});
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (mode === 'signup' && !termsAccepted) return;
    if (!validateForm()) return;

    // Check online status before attempting auth
    if (!navigator.onLine) {
      toast({
        title: 'No Internet Connection',
        description: 'Please check your connection and try again.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    logAuthEvent(`Auth attempt: ${mode}`, { email: email.replace(/(.{2}).*(@.*)/, '$1***$2') });

    try {
      if (mode === 'login' || mode === 'confirmed-signin') {
        const { error } = await signIn(email, password);
        if (error) {
          logAuthError('Login failed', error);
          const { title, description } = getAuthErrorMessage(error);
          toast({ title, description, variant: 'destructive' });
          if (error.message.toLowerCase().includes('email not confirmed')) {
            // Right password, never verified: send a fresh code straight away.
            setMode('confirm-email');
            setConfirmationSentAt(null);
            void handleResendConfirmation();
          }
        } else {
          logAuthEvent('Login successful');
        }
      } else if (mode === 'signup') {
        if (WAITLIST_MODE && inviteState !== 'ready') return;
        if (inviteEmail && email.trim().toLowerCase() !== inviteEmail.toLowerCase()) {
          setErrors({ email: 'Use the invited email.' });
          return;
        }
        sessionStorage.setItem(PENDING_SIGNUP_KEY, JSON.stringify({
          displayName: displayName.trim(),
          ...(inviteToken ? { inviteToken } : {}),
        }));
        const { error, session, user: signupUser } = await signUp(email, password, inviteToken || undefined, { displayName: displayName.trim() }, referralCode || undefined);
        const outcome = classifySignup({ error, session, user: signupUser });
        setRecoveryNote(null);
        if (outcome.kind === 'existing-account') {
          // A verified email signing up again: Auth sends nothing. Try the
          // password they just typed; it is often the same one.
          logAuthEvent('Signup hit an existing account');
          sessionStorage.setItem(PENDING_SIGNUP_KEY, JSON.stringify(inviteToken ? { inviteToken } : {}));
          const { error: signInError } = await signIn(email, password);
          if (!signInError) {
            toast({ title: 'Welcome back', description: 'This email already has an account, so we signed you in to continue.' });
          } else if (isBannedAuthError(signInError)) {
            // A closed account: no code will ever come, so stay on Join and say so.
            logAuthEvent('Signup hit a closed account');
            setPassword('');
            setRecoveryNote(BANNED_ACCOUNT_HELP.description);
            toast({ ...BANNED_ACCOUNT_HELP, variant: 'destructive' });
          } else if (signInError.message.toLowerCase().includes('email not confirmed')) {
            setMode('confirm-email');
            setConfirmationSentAt(null);
            void handleResendConfirmation();
          } else {
            setPassword('');
            setMode('account-exists');
          }
        } else if (outcome.kind === 'rate-limited') {
          logAuthError('Signup email limited', error);
          noteEmailLimit(error);
          setEmailCode('');
          if (signupLimitNextStep(outcome.retryAfterSeconds) === 'stay-on-join') {
            setRecoveryNote(SIGNUP_NOT_SENT_NOTE);
          } else {
            setRecoveryNote(getAuthErrorMessage(error!).description);
            setMode('confirm-email');
          }
        } else if (outcome.kind === 'email-failed') {
          logAuthError('Signup email failed', error);
          const { title, description } = getAuthErrorMessage(error!);
          toast({ title, description, variant: 'destructive' });
          setRecoveryNote(description);
          setConfirmationSentAt(null);
          setMode('confirm-email');
        } else if (outcome.kind === 'error') {
          logAuthError('Signup failed', error);
          const { title, description } = getAuthErrorMessage(error!);
          toast({ title, description, variant: 'destructive' });
        } else if (outcome.kind === 'code-sent') {
          logAuthEvent('Signup needs email confirmation');
          setEmailCode('');
          setConfirmationSentAt(Date.now());
          setResendBlockedUntil(null);
          setMode('confirm-email');
        } else {
          logAuthEvent('Signup successful');
        }
      } else if (mode === 'forgot') {
        const { error } = await resetPassword(email);
        if (error) {
          logAuthError('Password reset failed', error);
          const { title, description } = getAuthErrorMessage(error);
          toast({ title, description, variant: 'destructive' });
        } else {
          logAuthEvent('Password reset email sent');
          setResetEmailSent(true);
          toast({
            title: 'Check your email',
            description: 'We sent you a password reset link.',
          });
        }
      } else if (mode === 'reset') {
        const { error } = await updatePassword(password);
        if (error) {
          logAuthError('Password update failed', error);
          const { title, description } = getAuthErrorMessage(error);
          toast({ title, description, variant: 'destructive' });
        } else {
          logAuthEvent('Password updated successfully');
          toast({
            title: 'Password updated',
            description: 'You can now log in with your new password.',
          });
          setMode('login');
          setPassword('');
          navigate('/auth');
        }
      }
    } catch (err) {
      logAuthError('Unexpected auth error', err);
      toast({
        title: 'Unexpected Error',
        description: 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getTitle = () => {
    switch (mode) {
      case 'forgot': return 'Reset Password';
      case 'reset': return 'New Password';
      case 'confirm-email': return VERIFY_SIGNAL_TITLE;
      case 'confirmed-signin': return EMAIL_CONFIRMED_TITLE;
      case 'account-exists': return 'You already have an account';
      default: return '';
    }
  };

  const getSubtitle = () => {
    switch (mode) {
      case 'login': return 'Sign in';
      case 'signup': return 'Create an account. Free to join.';
      case 'forgot': return resetEmailSent ? 'Check your inbox' : 'Enter your email to reset';
      case 'reset': return 'Create your new password';
      case 'confirm-email': return VERIFY_SIGNAL_BODY;
      case 'confirmed-signin': return EMAIL_CONFIRMED_BODY;
      case 'account-exists': return 'Pick up where you left off.';
    }
  };

  // html already pads the safe areas; padding them here too pushed the form a notch lower, toward the keyboard.
  return (
    <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-start px-4 pb-4 pt-6">
      <PageMeta title="Sign in · Ether" description={HERO_TAGLINE} />
      {/* Offline indicator */}
      {!isOnline && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed top-4 left-4 right-4 bg-destructive/90 text-destructive-foreground px-4 py-2 rounded-lg flex items-center justify-center gap-2 z-50"
        >
          <WifiOff className="h-4 w-4" />
          <span className="text-sm">No internet connection</span>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-5">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="mb-4"
          >
            <EtherWordmark className="mx-auto w-[11rem] max-w-full" />
          </motion.div>
          <motion.h1
            className="ether-title text-3xl text-foreground mb-2"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            {getTitle() || getSubtitle()}
          </motion.h1>
          {getTitle() ? (
          <motion.p
            className="text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            {getSubtitle()}
          </motion.p>
          ) : null}
        </div>

        <motion.div
          className="file-panel p-5"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          {inviteState === 'inactive' && (
            <p className="mb-4 text-center text-sm text-destructive" role="status">
              This invite is not active.
            </p>
          )}

          {(mode === 'login' || mode === 'signup' || mode === 'confirmed-signin') && (
            <div className="mb-4 flex rounded-[16px] border border-border p-1">
              <button
                onClick={() => setMode('login')}
                className={`mono-label flex-1 min-h-11 rounded-[14px] text-[12px] transition-all ${
                  mode === 'login' 
                    ? 'bg-gradient-to-br from-[#FFD6E8] to-[#FF9FC8] text-[#0A0A0A]' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Sign in
              </button>
              <button
                onClick={() => setMode('signup')}
                className={`mono-label flex-1 min-h-11 rounded-[14px] text-[12px] transition-all ${
                  mode === 'signup' 
                    ? 'bg-gradient-to-br from-[#FFD6E8] to-[#FF9FC8] text-[#0A0A0A]' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Join
              </button>
            </div>
          )}

          {(mode === 'forgot' || mode === 'reset') && (
            <button
              onClick={() => {
                setMode('login');
                setResetEmailSent(false);
                setPassword('');
              }}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 text-sm"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to login
            </button>
          )}

          {mode === 'confirm-email' ? (
            <div className="text-center py-2">
              <p className="text-sm text-muted-foreground mb-4">
                {email ? <>Verification for <span className="text-primary">{email}</span>.</> : 'Enter your signup email to request a fresh verification code.'}
              </p>
              {(
                <Input type="email" autoComplete="email" aria-label="Signup email" placeholder="Your signup email"
                  className="mb-3 h-12" value={email} onChange={(event) => setEmail(event.target.value)} />
              )}
              <label htmlFor="email-code" className="sr-only">6-digit code</label>
              <Input
                id="email-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={8}
                value={emailCode}
                onChange={(e) => setEmailCode(e.target.value.replace(/[^0-9]/g, ''))}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleVerifyEmailCode(); }}
                placeholder="6-digit code"
                className="mb-3 h-12 text-center tracking-[0.4em] text-lg"
              />
              <Button
                type="button"
                className="w-full mb-3"
                onClick={() => void handleVerifyEmailCode()}
                disabled={isVerifyingCode || emailCode.replace(/\s+/g, '').length < 6}
              >
                {isVerifyingCode ? 'Verifying' : 'Verify'}
              </Button>
              {recoveryNote && (
                <p role="status" className="mb-3 text-sm leading-relaxed text-muted-foreground">{recoveryNote}</p>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleResendConfirmation()}
                disabled={isResending || resendWaitMs > 0 || !emailSchema.safeParse({ email }).success}
                className="w-full mb-3"
              >
                {resendWaitMs > 0
                  ? `Resend (${Math.ceil(resendWaitMs / 1000)}s)`
                  : 'Resend code'}
              </Button>
              <Button
                variant="outline"
                onClick={() => { setRecoveryNote(null); setMode('login'); }}
                className="h-auto min-h-11 w-full whitespace-normal text-balance break-words px-3 py-3 leading-snug tracking-[0.08em]"
              >
                Already verified? Sign in to finish your application
              </Button>
              <button
                type="button"
                onClick={() => void handleSendSignInLink()}
                disabled={isSendingLink || resendWaitMs > 0 || !emailSchema.safeParse({ email }).success}
                className="mt-3 min-h-11 w-full text-sm text-muted-foreground underline underline-offset-4 disabled:opacity-50"
              >
                {isSendingLink ? 'Sending link' : 'No code coming? Email me a sign-in link'}
              </button>
              <button
                type="button"
                onClick={() => { setRecoveryNote(null); setMode('signup'); }}
                className="min-h-11 w-full text-sm text-muted-foreground underline underline-offset-4"
              >
                Back to Join
              </button>
            </div>
          ) : mode === 'account-exists' ? (
            <div className="space-y-3 text-center py-2">
              <p className="text-sm leading-relaxed text-muted-foreground">
                <span className="text-primary">{email}</span> is already on Ether. Sign in with the password you used before.
                If you never finished joining, you&apos;ll go straight back to your application.
              </p>
              {recoveryNote && (
                <p role="status" className="text-sm leading-relaxed text-foreground">{recoveryNote}</p>
              )}
              <Button type="button" className="w-full" onClick={() => { setRecoveryNote(null); setPassword(''); setMode('login'); }}>
                Sign in
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => void handleSendSignInLink()}
                disabled={isSendingLink || resendWaitMs > 0}
              >
                {isSendingLink
                  ? 'Sending link'
                  : resendWaitMs > 0
                    ? `Email me a sign-in link (${Math.ceil(resendWaitMs / 1000)}s)`
                    : 'Email me a sign-in link'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => { setRecoveryNote(null); setResetEmailSent(false); setMode('forgot'); }}
              >
                Forgot password? Reset it
              </Button>
              <button
                type="button"
                onClick={() => { setRecoveryNote(null); setMode('signup'); }}
                className="min-h-11 w-full text-sm text-muted-foreground underline underline-offset-4"
              >
                Use a different email
              </button>
            </div>
          ) : resetEmailSent && mode === 'forgot' ? (
            <div className="text-center py-4">
              <Mail className="h-12 w-12 text-primary mx-auto mb-4" />
              <p className="text-foreground mb-2">Reset link sent!</p>
              <p className="text-sm text-muted-foreground mb-4">
                Check your email at <span className="text-primary">{email}</span> for the reset link.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setResetEmailSent(false);
                  setEmail('');
                }}
                className="w-full"
              >
                Try another email
              </Button>
            </div>
          ) : mode === 'signup' && WAITLIST_MODE && inviteState !== 'ready' ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                {inviteState === 'checking'
                  ? 'Checking this invite.'
                  : inviteState === 'inactive'
                    ? 'This invite is not active.'
                    : 'Accounts open from an invite. Join the waitlist until then.'}
              </p>
              <Button asChild className="w-full">
                <Link to="/waitlist">Waitlist</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              {mode === 'signup' && referralCode && (
                <p role="status" className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-center text-sm leading-relaxed text-foreground">
                  {referralChecking
                    ? 'Checking your creative invitation…'
                    : referralPreview
                      ? `${referralPreview.name} ${referralPreview.kind === 'vouch' ? 'vouched for you' : 'invited you'} to apply to ETHER. Your application will still be reviewed.`
                      : 'This referral link is no longer active. You can still apply directly.'}
                </p>
              )}
              {mode === 'signup' && (
                <>
                  <div className="space-y-2">
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="email"
                        autoComplete="email"
                        placeholder="Email *"
                        value={email}
                        onChange={(e) => {
                          if (!inviteEmail) setEmail(e.target.value);
                        }}
                        readOnly={Boolean(inviteEmail)}
                        className="pl-11 h-12 bg-input border-border focus:border-primary"
                        required
                      />
                    </div>
                    {errors.email && (
                      <p className="text-sm text-destructive">{errors.email}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="text"
                        autoComplete="name"
                        autoCapitalize="words"
                        placeholder="Your name *"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="pl-11 h-12 bg-input border-border focus:border-primary"
                        required
                      />
                    </div>
                    <p className="text-xs text-muted-foreground pl-1">
                      Use your real name or the name you go by — it helps others recognize you
                    </p>
                    {errors.displayName && (
                      <p className="text-sm text-destructive">{errors.displayName}</p>
                    )}
                  </div>


                </>
              )}

              {mode !== 'reset' && mode !== 'signup' && (
                <div className="space-y-2">
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="Email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-11 h-12 bg-input border-border focus:border-primary"
                      required
                    />
                  </div>
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email}</p>
                  )}
                </div>
              )}

              {mode !== 'forgot' && (
                <div className="space-y-2">
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder={mode === 'reset' ? 'New password *' : 'Password *'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-11 pr-11 h-12 bg-input border-border focus:border-primary"
                      required
                      minLength={mode === 'login' ? 6 : 8}
                      aria-describedby={mode === 'signup' || mode === 'reset' ? 'password-rules' : undefined}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {(mode === 'signup' || mode === 'reset') && (
                    <p id="password-rules" className="text-xs text-muted-foreground pl-1">
                      At least 8 characters.
                    </p>
                  )}
                  {errors.password && (
                    <p className="text-sm text-destructive">{errors.password}</p>
                  )}
                </div>
              )}

              {mode === 'signup' && (
                <div className="flex items-start gap-3 text-sm">
                  <input id="terms-accepted" type="checkbox" required checked={termsAccepted}
                    onChange={e => setTermsAccepted(e.target.checked)} className="mt-1 h-5 w-5" />
                  <label htmlFor="terms-accepted">
                    I agree to the <Link to="/terms" target="_blank" className="text-primary underline">Terms (EULA)</Link>
                    {" "}and <Link to="/privacy" target="_blank" className="text-primary underline">Privacy Policy</Link>.
                  </label>
                </div>
              )}
              <Button
                type="submit"
                disabled={isLoading || !isOnline || (mode === 'signup' && !termsAccepted)}
                className="w-full h-12 font-medium"
              >
                {isLoading ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="w-5 h-5 border-2 border-[#0A0A0A]/30 border-t-[#0A0A0A] rounded-full"
                  />
                ) : !isOnline ? (
                  <>
                    <WifiOff className="mr-2 h-4 w-4" />
                    Offline
                  </>
                ) : (
                  <>
                    {(mode === 'login' || mode === 'confirmed-signin') && 'Sign in'}
                    {mode === 'signup' && 'Join'}
                    {mode === 'forgot' && 'Send Reset Link'}
                    {mode === 'reset' && 'Update Password'}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          )}

          {mode === 'signup' && (
            <div className="mt-5 space-y-2 border-t border-border pt-4 text-center text-sm">
              {recoveryNote && (
                <p role="alert" className="pb-2 text-left text-sm leading-relaxed text-foreground">{recoveryNote}</p>
              )}
              <button type="button" className="min-h-11 w-full text-primary underline underline-offset-4" onClick={() => setMode('login')}>
                Already verified or started an application? Sign in to continue
              </button>
              <button type="button" className="min-h-11 w-full text-muted-foreground underline underline-offset-4"
                onClick={() => { setRecoveryNote(null); setMode('confirm-email'); setConfirmationSentAt(null); }}>
                Verification code expired? Request a fresh code
              </button>
            </div>
          )}

          {(mode === 'login' || mode === 'signup' || mode === 'confirmed-signin') && (
            <>
              {mode !== 'signup' && (
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => setMode('forgot')}
                  className="text-sm text-muted-foreground hover:text-primary"
                >
                  Forgot your password?
                </button>
              </div>
              )}

              <AnimatePresence mode="wait">
                <motion.p
                  key={mode}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mt-6 text-center text-xs text-muted-foreground"
                >
                  {mode === 'login' || mode === 'confirmed-signin' ? (
                    <>
                      Don&apos;t have an account? Use the Join tab above.{" "}
                      <Link to="/privacy" className="text-primary underline">Privacy</Link>
                      {" · "}
                      <Link to="/terms" className="text-primary underline">Terms</Link>
                    </>
                  ) : (
                    <>
                      By signing up, you agree to the{" "}
                      <Link to="/privacy" className="text-primary underline">Privacy Policy</Link>
                      {" "}and{" "}
                      <Link to="/terms" className="text-primary underline">Terms</Link>.
                    </>
                  )}
                </motion.p>
              </AnimatePresence>
            </>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Auth;
