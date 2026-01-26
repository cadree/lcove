import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { logAuthEvent, logAuthError } from './authDebug';

/**
 * Parse auth parameters from a deep link URL
 * Handles both fragment-based (#) and query-based (?) tokens
 */
const parseAuthParams = (url: string): URLSearchParams | null => {
  try {
    const hashIndex = url.indexOf('#');
    const queryIndex = url.indexOf('?');
    
    if (hashIndex !== -1) {
      // Fragment-based tokens (implicit flow)
      return new URLSearchParams(url.substring(hashIndex + 1));
    } else if (queryIndex !== -1) {
      // Query-based tokens (PKCE flow)
      return new URLSearchParams(url.substring(queryIndex + 1));
    }
    
    return null;
  } catch (error) {
    logAuthError('parseAuthParams', error);
    return null;
  }
};

/**
 * Check if a URL contains authentication tokens or codes
 */
const isAuthUrl = (url: string): boolean => {
  return (
    url.includes('access_token') ||
    url.includes('refresh_token') ||
    url.includes('code=') ||
    url.includes('error=') ||
    url.includes('error_description=')
  );
};

/**
 * Setup deep link handler for authentication callbacks on native platforms
 * This is required for handling OAuth and magic link redirects on iOS/Android
 */
export const setupDeepLinkHandler = (): (() => void) | undefined => {
  if (!Capacitor.isNativePlatform()) {
    logAuthEvent('Deep link handler skipped - not native platform');
    return undefined;
  }

  logAuthEvent('Setting up deep link handler', { platform: Capacitor.getPlatform() });

  const handleUrlOpen = async ({ url }: { url: string }) => {
    logAuthEvent('Deep link received', { url: url.substring(0, 100) + '...' });

    try {
      // Check for auth errors first
      if (url.includes('error=')) {
        const params = parseAuthParams(url);
        if (params) {
          const error = params.get('error');
          const errorDescription = params.get('error_description');
          logAuthError('Auth callback error', { error, errorDescription });
        }
        return;
      }

      // Check if this is an auth callback URL
      if (!isAuthUrl(url)) {
        logAuthEvent('URL is not an auth callback, ignoring');
        return;
      }

      const params = parseAuthParams(url);
      if (!params) {
        logAuthEvent('No auth params found in URL');
        return;
      }

      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const code = params.get('code');

      if (accessToken && refreshToken) {
        // Direct token flow (implicit)
        logAuthEvent('Setting session from tokens');
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          logAuthError('setSession failed', error);
        } else {
          logAuthEvent('Session set successfully', { userId: data.user?.id });
        }
      } else if (code) {
        // PKCE flow - exchange code for session
        logAuthEvent('Exchanging code for session');
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          logAuthError('exchangeCodeForSession failed', error);
        } else {
          logAuthEvent('Session established from code', { userId: data.user?.id });
        }
      }

      // Handle password reset URLs
      if (url.includes('type=recovery') || url.includes('reset=true')) {
        logAuthEvent('Password reset URL detected');
        // Navigate to reset password page - handled by auth state change
      }

      // Handle email confirmation URLs
      if (url.includes('type=signup') || url.includes('type=email')) {
        logAuthEvent('Email confirmation URL detected');
        // Session will be set automatically
      }
    } catch (error) {
      logAuthError('Deep link handler error', error);
    }
  };

  // Add the URL open listener
  App.addListener('appUrlOpen', handleUrlOpen);

  // Handle app state resume to check for pending auth
  App.addListener('appStateChange', async ({ isActive }) => {
    if (isActive) {
      logAuthEvent('App became active, checking session');
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          logAuthError('Session check on resume failed', error);
        } else {
          logAuthEvent('Session check on resume', { 
            hasSession: !!data.session,
            userId: data.session?.user?.id 
          });
        }
      } catch (error) {
        logAuthError('Session check exception', error);
      }
    }
  });

  // Return cleanup function
  return () => {
    App.removeAllListeners();
    logAuthEvent('Removed all app listeners');
  };
};

/**
 * Initialize app listeners for Capacitor
 * Call this early in the app lifecycle
 */
export const initializeCapacitorApp = async (): Promise<void> => {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    // Get any launch URL (app was opened via deep link)
    const launchUrl = await App.getLaunchUrl();
    
    if (launchUrl?.url) {
      logAuthEvent('App launched with URL', { url: launchUrl.url.substring(0, 100) });
      // The appUrlOpen listener will handle this
    } else {
      logAuthEvent('App launched normally (no deep link)');
    }
  } catch (error) {
    logAuthError('Error getting launch URL', error);
  }
};
