import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { authStorageKeys } from '@/lib/supabaseTarget.mjs';
import { NATIVE_APP_ID } from '@/config/nativeIds';
import { logStorageOperation } from './authDebug';

/**
 * Capacitor-compatible storage adapter for Supabase Auth
 * Uses Capacitor Preferences on native platforms (iOS/Android)
 * Falls back to localStorage on web
 * 
 * This adapter implements the Supabase SupportedStorage interface
 * which requires synchronous-looking methods that can return promises
 */
export const capacitorStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (Capacitor.isNativePlatform()) {
        const { value } = await Preferences.get({ key });
        logStorageOperation('get', key, true);
        return value;
      }
      const value = localStorage.getItem(key);
      logStorageOperation('get', key, true);
      return value;
    } catch (error) {
      console.error('[CapacitorStorage] getItem error:', error);
      logStorageOperation('get', key, false);
      // Fallback to localStorage if Preferences fails
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    }
  },

  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (Capacitor.isNativePlatform()) {
        await Preferences.set({ key, value });
        logStorageOperation('set', key, true);
      } else {
        localStorage.setItem(key, value);
        logStorageOperation('set', key, true);
      }
    } catch (error) {
      console.error('[CapacitorStorage] setItem error:', error);
      logStorageOperation('set', key, false);
      // Fallback to localStorage if Preferences fails
      try {
        localStorage.setItem(key, value);
      } catch {
        // Silent fail - session won't persist but app should still work
      }
    }
  },

  removeItem: async (key: string): Promise<void> => {
    try {
      if (Capacitor.isNativePlatform()) {
        await Preferences.remove({ key });
        logStorageOperation('remove', key, true);
      } else {
        localStorage.removeItem(key);
        logStorageOperation('remove', key, true);
      }
    } catch (error) {
      console.error('[CapacitorStorage] removeItem error:', error);
      logStorageOperation('remove', key, false);
      // Fallback to localStorage if Preferences fails
      try {
        localStorage.removeItem(key);
      } catch {
        // Silent fail
      }
    }
  },
};

/**
 * Clear ALL auth-related storage keys (critical for iOS logout)
 * Supabase stores session data in keys prefixed with 'sb-'
 */
export const clearAllAuthStorage = async (): Promise<void> => {
  const authKeys = authStorageKeys(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_PROJECT_ID,
  );

  if (import.meta.env.DEV) {
    console.log('[CapacitorStorage] Clearing auth storage keys');
  }

  try {
    if (Capacitor.isNativePlatform()) {
      // Clear known auth keys from Capacitor Preferences
      for (const key of authKeys) {
        await Preferences.remove({ key });
        logStorageOperation('clear', key, true);
      }
      
      // Also try to clear any other sb- prefixed keys by getting all keys
      // Note: Capacitor Preferences doesn't have a keys() method, so we clear known ones
      if (import.meta.env.DEV) {
        console.log('[CapacitorStorage] Native auth storage cleared');
      }
    } else {
      // Clear from localStorage on web
      for (const key of authKeys) {
        localStorage.removeItem(key);
      }
      
      // Also clear any other sb- prefixed keys from localStorage
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      if (import.meta.env.DEV) {
        console.log('[CapacitorStorage] Web auth storage cleared', { count: keysToRemove.length });
      }
    }
  } catch (error) {
    console.error('[CapacitorStorage] Error clearing auth storage:', error);
  }
};

/**
 * Check if we're running on a native platform
 */
export const isNativePlatform = (): boolean => {
  return Capacitor.isNativePlatform();
};

/**
 * Get the correct redirect URL based on platform
 * Uses deep link scheme for native apps, origin for web
 */
export const getAuthRedirectUrl = (path: string = '/'): string => {
  if (Capacitor.isNativePlatform()) {
    // Custom URL scheme registered in ios/App/App/Info.plist.
    // It matches the App Store bundle id. Supabase Auth redirect URLs
    // must allow this scheme before native login returns into the app.
    // path already starts with "/", so this becomes scheme://...
    return `${NATIVE_APP_ID}:/${path}`;
  }
  return `${window.location.origin}${path}`;
};
