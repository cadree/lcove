import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { z } from 'zod';
import { Capacitor } from '@capacitor/core';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { PENDING_SIGNUP_KEY, applyPendingSignupProfile, inviteTokenFromMetadata } from '@/lib/pendingSignup';
import { captureSignupAttribution } from '@/lib/signupAttribution';
import { WAITLIST_MODE } from '@/config/launch';
import { PageMeta } from '@/components/seo/PageMeta';
import { HERO_TAGLINE } from '@/content/copy';
import { getAuthRedirectUrl } from '@/lib/capacitorStorage';
import { resendCooldownRemaining } from '@/lib/resendCooldown';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { logAuthEvent, logAuthError } from '@/lib/authDebug';
import { Eye, EyeOff, Mail, Lock, ArrowRight, ArrowLeft, User, Phone, Wifi, WifiOff } from 'lucide-react';
import { EtherWordmark } from '@/components/brand/EtherWordmark';
import { eventReturnPath, rememberEventReturn } from '../../functions/_shared/eventShare.js';

const signupSchema = z.object({
  email: z.string().email('Please enter a valid email').max(255),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
  displayName: z.string().min(2, 'Name must be at least 2 characters').max(50, 'Name must be less than 50 characters'),
  phone: z.string().optional().refine(val => !val || /^[\d\s\-+()]*$/.test(val), 'Please enter a valid phone number'),
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

type AuthMode = 'login' | 'signup' | 'forgot' | 'reset' | 'confirm-email';

/**
 * Map Supabase auth errors to user-friendly messages
 */
const getAuthErrorMessage = (error: Error): { title: string; description: string } => {
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
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; displayName?: string; phone?: string }>({});
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [confirmationSentAt, setConfirmationSentAt] = useState<number | null>(null);
  const [resendNow, setResendNow] = useState(() => Date.now());
  const [isResending, setIsResending] = useState(false);
  const inviteToken = searchParams.get('invite')?.trim() ?? '';
  const [inviteEmail, setInviteEmail] = useState<string | null>(null);
  const [inviteState, setInviteState] = useState<'none' | 'checking' | 'ready' | 'inactive'>(
    inviteToken ? 'checking' : 'none',
  );

  const { signIn, signUp, user, resetPassword, updatePassword } = useAuth();
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
    if (confirmationSentAt == null) return;
    setResendNow(Date.now());
    const id = window.setInterval(() => setResendNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [confirmationSentAt]);

  const resendWaitMs = resendCooldownRemaining(confirmationSentAt, resendNow);

  const handleResendConfirmation = async () => {
    if (resendWaitMs > 0 || isResending || !email) return;
    setIsResending(true);
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: getAuthRedirectUrl(
          inviteToken ? `/auth?confirmed=1&invite=${encodeURIComponent(inviteToken)}` : '/auth?confirmed=1',
        ),
      },
    });
    setIsResending(false);
    if (error) {
      const { title, description } = getAuthErrorMessage(error);
      toast({ title, description, variant: 'destructive' });
      return;
    }
    setConfirmationSentAt(Date.now());
    toast({
      title: 'Email sent',
      description: 'We sent another confirmation link.',
    });
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
    applyPendingSignupProfile(user.id, inviteTokenFromMetadata(user.user_metadata)).then((result) => {
      if (cancelled) return;
      if (result === 'invite-failed') {
        toast({
          title: 'Invite not applied',
          description: 'Sign up with the invited email.',
          variant: 'destructive',
        });
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
      const result = signupSchema.safeParse({ email, password, displayName, phone });
      if (!result.success) {
        const fieldErrors: { email?: string; password?: string; displayName?: string; phone?: string } = {};
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
      if (mode === 'login') {
        const { error } = await signIn(email, password);
        if (error) {
          logAuthError('Login failed', error);
          const { title, description } = getAuthErrorMessage(error);
          toast({ title, description, variant: 'destructive' });
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
          phone: phone.trim(),
          ...(inviteToken ? { inviteToken } : {}),
        }));
        const { error, session } = await signUp(email, password, inviteToken || undefined);
        if (error) {
          logAuthError('Signup failed', error);
          const { title, description } = getAuthErrorMessage(error);
          toast({ title, description, variant: 'destructive' });
        } else if (!session) {
          logAuthEvent('Signup needs email confirmation');
          setConfirmationSentAt(Date.now());
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
      case 'confirm-email': return 'Check your email';
      default: return '';
    }
  };

  const getSubtitle = () => {
    switch (mode) {
      case 'login': return 'Sign in';
      case 'signup': return 'Create an account. Free to join.';
      case 'forgot': return resetEmailSent ? 'Check your inbox' : 'Enter your email to reset';
      case 'reset': return 'Create your new password';
      case 'confirm-email': return 'Confirm your email to continue';
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 safe-area-all">
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
        <div className="text-center mb-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="mb-4"
          >
            <EtherWordmark className="mx-auto w-[16rem] max-w-full" />
          </motion.div>
          <motion.h1
            className="ether-title text-4xl text-foreground mb-2"
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
          className="file-panel p-8"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          {inviteState === 'inactive' && (
            <p className="mb-4 text-center text-sm text-destructive" role="status">
              This invite is not active.
            </p>
          )}

          {(mode === 'login' || mode === 'signup') && (
            <div className="mb-8 flex rounded-[16px] border border-border p-1">
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
            <div className="text-center py-4">
              <Mail className="h-12 w-12 text-primary mx-auto mb-4" />
              <p className="text-foreground mb-2">Check your email to confirm</p>
              <p className="text-sm text-muted-foreground mb-4">
                We sent a confirmation link to <span className="text-primary">{email}</span>.
                Open it to finish creating your account. You will continue onboarding after you confirm.
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleResendConfirmation()}
                disabled={isResending || resendWaitMs > 0}
                className="w-full mb-3"
              >
                {resendWaitMs > 0
                  ? `Resend email (${Math.ceil(resendWaitMs / 1000)}s)`
                  : 'Resend email'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setMode('login')}
                className="w-full"
              >
                Back to log in
              </Button>
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
            <form onSubmit={handleSubmit} className="space-y-5">
              {mode === 'signup' && (
                <>
                  <div className="space-y-2">
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="email"
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

                  <div className="space-y-2">
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="tel"
                        placeholder="Phone number (optional)"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="pl-11 h-12 bg-input border-border focus:border-primary"
                      />
                    </div>
                    {errors.phone && (
                      <p className="text-sm text-destructive">{errors.phone}</p>
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

              <Button
                type="submit"
                disabled={isLoading || !isOnline}
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
                    {mode === 'login' && 'Sign in'}
                    {mode === 'signup' && 'Join'}
                    {mode === 'forgot' && 'Send Reset Link'}
                    {mode === 'reset' && 'Update Password'}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          )}

          {(mode === 'login' || mode === 'signup') && (
            <>
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => setMode('forgot')}
                  className="text-sm text-muted-foreground hover:text-primary"
                >
                  Forgot your password?
                </button>
              </div>

              <AnimatePresence mode="wait">
                <motion.p
                  key={mode}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mt-6 text-center text-xs text-muted-foreground"
                >
                  {mode === 'login' ? (
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
