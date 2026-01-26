import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

/**
 * Setup deep link handler for authentication callbacks on native platforms
 * This is required for handling OAuth and magic link redirects on iOS/Android
 */
export const setupDeepLinkHandler = (): (() => void) | undefined => {
  if (!Capacitor.isNativePlatform()) {
    return undefined;
  }

  console.log('[DeepLink] Setting up handler for native platform');

  const handleUrlOpen = async ({ url }: { url: string }) => {
    console.log('[DeepLink] Received URL:', url);

    try {
      // Check if this is an auth callback URL
      if (url.includes('access_token') || url.includes('refresh_token') || url.includes('code=')) {
        // Extract the fragment or query string
        const hashIndex = url.indexOf('#');
        const queryIndex = url.indexOf('?');
        
        let params: URLSearchParams;
        
        if (hashIndex !== -1) {
          // Fragment-based tokens (implicit flow)
          params = new URLSearchParams(url.substring(hashIndex + 1));
        } else if (queryIndex !== -1) {
          // Query-based tokens (PKCE flow)
          params = new URLSearchParams(url.substring(queryIndex + 1));
        } else {
          console.log('[DeepLink] No tokens found in URL');
          return;
        }

        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const code = params.get('code');

        if (accessToken && refreshToken) {
          // Direct token flow
          console.log('[DeepLink] Setting session from tokens');
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            console.error('[DeepLink] Session error:', error);
          } else {
            console.log('[DeepLink] Session set successfully');
          }
        } else if (code) {
          // PKCE flow - exchange code for session
          console.log('[DeepLink] Exchanging code for session');
          const { error } = await supabase.auth.exchangeCodeForSession(code);

          if (error) {
            console.error('[DeepLink] Code exchange error:', error);
          } else {
            console.log('[DeepLink] Session established from code');
          }
        }
      }

      // Handle password reset URLs
      if (url.includes('type=recovery') || url.includes('reset=true')) {
        console.log('[DeepLink] Password reset URL detected');
        // Navigate to the reset password page
        // The app will handle this through the auth state change
      }

      // Handle email confirmation URLs
      if (url.includes('type=signup') || url.includes('type=email')) {
        console.log('[DeepLink] Email confirmation URL detected');
        // The session will be set automatically
      }
    } catch (error) {
      console.error('[DeepLink] Error handling URL:', error);
    }
  };

  // Add the listener
  App.addListener('appUrlOpen', handleUrlOpen);

  // Also handle the app state resume to check for pending auth
  App.addListener('appStateChange', async ({ isActive }) => {
    if (isActive) {
      console.log('[DeepLink] App became active, checking session');
      // Attempt to refresh the session when app becomes active
      const { error } = await supabase.auth.getSession();
      if (error) {
        console.error('[DeepLink] Session refresh error:', error);
      }
    }
  });

  // Return cleanup function
  return () => {
    App.removeAllListeners();
    console.log('[DeepLink] Removed all listeners');
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
    const { url } = await App.getLaunchUrl() || {};
    
    if (url) {
      console.log('[DeepLink] App launched with URL:', url);
      // Process the launch URL
      // This will be handled by the appUrlOpen listener
    }
  } catch (error) {
    console.error('[DeepLink] Error getting launch URL:', error);
  }
};
