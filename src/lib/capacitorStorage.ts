import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

/**
 * Capacitor-compatible storage adapter for Supabase Auth
 * Uses Capacitor Preferences on native platforms (iOS/Android)
 * Falls back to localStorage on web
 */
export const capacitorStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (Capacitor.isNativePlatform()) {
        const { value } = await Preferences.get({ key });
        return value;
      }
      return localStorage.getItem(key);
    } catch (error) {
      console.error('[CapacitorStorage] getItem error:', error);
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
      } else {
        localStorage.setItem(key, value);
      }
    } catch (error) {
      console.error('[CapacitorStorage] setItem error:', error);
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
      } else {
        localStorage.removeItem(key);
      }
    } catch (error) {
      console.error('[CapacitorStorage] removeItem error:', error);
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
