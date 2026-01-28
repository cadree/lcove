import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
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
        logStorageOperation('get', key, true, value || undefined);
        return value;
      }
      const value = localStorage.getItem(key);
      logStorageOperation('get', key, true, value || undefined);
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
        logStorageOperation('set', key, true, value);
      } else {
        localStorage.setItem(key, value);
        logStorageOperation('set', key, true, value);
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
  const authKeys = [
    'sb-waafzlorvnozeujjhvxu-auth-token',
    'sb-waafzlorvnozeujjhvxu-auth-token-code-verifier',
    'supabase.auth.token',
  ];

  console.log('[CapacitorStorage] Clearing all auth storage keys...');

  try {
    if (Capacitor.isNativePlatform()) {
      // Clear known auth keys from Capacitor Preferences
      for (const key of authKeys) {
        await Preferences.remove({ key });
        logStorageOperation('clear', key, true);
      }
      
      // Also try to clear any other sb- prefixed keys by getting all keys
      // Note: Capacitor Preferences doesn't have a keys() method, so we clear known ones
      console.log('[CapacitorStorage] Native auth storage cleared');
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
      
      console.log('[CapacitorStorage] Web auth storage cleared:', keysToRemove);
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
    // Use the app's URL scheme for deep linking
    // Format: app.lovable.{projectId}://path
    return `app.lovable.e07d9c457fd949f78f3cc7d5998be668:/${path}`;
  }
  return `${window.location.origin}${path}`;
};
