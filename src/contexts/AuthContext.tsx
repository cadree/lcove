import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { getAuthRedirectUrl, clearAllAuthStorage } from '@/lib/capacitorStorage';
import { logAuthEvent, logAuthError, logSessionState } from '@/lib/authDebug';
import { applyPendingSignupProfile, inviteTokenFromMetadata, WAITLIST_INVITE_METADATA_KEY } from '@/lib/pendingSignup';
import { SHOT_USER_ID, shotSessionEnabled } from '@/lib/shotSession';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, inviteToken?: string) => Promise<{ error: Error | null; session: Session | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (shotSessionEnabled()) {
      setUser({
        id: SHOT_USER_ID,
        email: "maya@ether.test",
        app_metadata: {},
        user_metadata: {},
        aud: "authenticated",
        created_at: "2026-10-01T00:00:00.000Z",
      } as User);
      setLoading(false);
      return;
    }
    logAuthEvent('AuthProvider initializing');

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        logAuthEvent(`Auth state change: ${event}`, {
          hasSession: !!session,
          userId: session?.user?.id,
        });
        
        if (session?.user) {
          void applyPendingSignupProfile(session.user.id, inviteTokenFromMetadata(session.user.user_metadata));
        }
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Log session details
        if (session) {
          logSessionState(
            true,
            session.user.id,
            session.expires_at
          );
        } else {
          logSessionState(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        logAuthError('getSession failed', error);
      } else {
        logAuthEvent('Initial session check', {
          hasSession: !!session,
          userId: session?.user?.id,
        });
      }
      
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      logAuthEvent('AuthProvider cleanup');
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, inviteToken?: string) => {
    const token = inviteToken?.trim() ?? '';
    const redirectPath = token
      ? `/auth?confirmed=1&invite=${encodeURIComponent(token)}`
      : '/auth?confirmed=1';
    const redirectUrl = getAuthRedirectUrl(redirectPath);
    logAuthEvent('Sign up attempt', { 
      email: email.replace(/(.{2}).*(@.*)/, '$1***$2'),
      redirectUrl 
    });
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: token ? { [WAITLIST_INVITE_METADATA_KEY]: token } : undefined,
      }
    });
    
    if (error) {
      logAuthError('Sign up failed', error);
    } else {
      logAuthEvent('Sign up successful', { hasSession: !!data.session });
    }
    
    return { error, session: data.session };
  };

  const signIn = async (email: string, password: string) => {
    logAuthEvent('Sign in attempt', { 
      email: email.replace(/(.{2}).*(@.*)/, '$1***$2') 
    });
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      logAuthError('Sign in failed', error);
    } else {
      logAuthEvent('Sign in successful');
    }
    
    return { error };
  };

  const signOut = async () => {
    logAuthEvent('Sign out - clearing all auth storage');
    
    // Clear Supabase session first
    await supabase.auth.signOut();
    
    // Explicitly clear all auth storage (critical for iOS/Capacitor)
    await clearAllAuthStorage();
    
    // Reset local state immediately
    setUser(null);
    setSession(null);
    
    logAuthEvent('Sign out complete - all storage cleared');
  };

  const resetPassword = async (email: string) => {
    const redirectUrl = getAuthRedirectUrl('/auth?reset=true');
    logAuthEvent('Password reset request', { 
      email: email.replace(/(.{2}).*(@.*)/, '$1***$2'),
      redirectUrl 
    });
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });
    
    if (error) {
      logAuthError('Password reset failed', error);
    } else {
      logAuthEvent('Password reset email sent');
    }
    
    return { error };
  };

  const updatePassword = async (newPassword: string) => {
    logAuthEvent('Password update attempt');
    
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });
    
    if (error) {
      logAuthError('Password update failed', error);
    } else {
      logAuthEvent('Password updated successfully');
    }
    
    return { error };
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut, resetPassword, updatePassword }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
