import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// VAPID public key - this is safe to expose in client code
// For production, this should be set via VITE_VAPID_PUBLIC_KEY environment variable
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || 
  // Fallback VAPID public key for development/testing
  'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';

// Convert base64url string to ArrayBuffer for push subscription
function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    view[i] = rawData.charCodeAt(i);
  }
  return buffer;
}

export type PushStatus = 
  | 'checking'
  | 'not_supported' 
  | 'permission_denied' 
  | 'not_subscribed' 
  | 'subscribed'
  | 'error';

interface PushNotificationsState {
  status: PushStatus;
  error: string | null;
  isLoading: boolean;
}

export const usePushNotifications = () => {
  const { user } = useAuth();
  const [state, setState] = useState<PushNotificationsState>({
    status: 'checking',
    error: null,
    isLoading: false,
  });

  // Check support and current status on mount
  useEffect(() => {
    const checkStatus = async () => {
      // Check browser support
      const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
      
      if (!supported) {
        setState({ status: 'not_supported', error: 'Push notifications not supported in this browser', isLoading: false });
        return;
      }

      // Check permission
      if (Notification.permission === 'denied') {
        setState({ status: 'permission_denied', error: 'Notification permission was denied. Enable it in browser settings.', isLoading: false });
        return;
      }

      if (!user?.id) {
        setState({ status: 'not_subscribed', error: null, isLoading: false });
        return;
      }

      // Check for existing subscription
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        
        if (subscription) {
          // Verify subscription is in database
          await saveSubscriptionToDb(subscription, user.id);
          setState({ status: 'subscribed', error: null, isLoading: false });
        } else {
          setState({ status: 'not_subscribed', error: null, isLoading: false });
        }
      } catch (error) {
        console.error('Error checking push subscription:', error);
        setState({ status: 'error', error: 'Failed to check subscription status', isLoading: false });
      }
    };

    checkStatus();
  }, [user?.id]);

  // Listen for subscription changes from service worker
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'PUSH_SUBSCRIPTION_CHANGED' && user?.id) {
        console.log('Push subscription changed, updating database');
        const subscription = event.data.subscription;
        if (subscription) {
          await saveSubscriptionToDb(subscription, user.id);
        }
      }
    };

    navigator.serviceWorker?.addEventListener('message', handleMessage);
    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleMessage);
    };
  }, [user?.id]);

  const saveSubscriptionToDb = async (subscription: PushSubscription | PushSubscriptionJSON, userId: string) => {
    const subJson = 'toJSON' in subscription ? subscription.toJSON() : subscription;
    
    if (!subJson.endpoint || !subJson.keys?.p256dh || !subJson.keys?.auth) {
      console.error('Invalid subscription object - missing required fields');
      return false;
    }

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: userId,
        endpoint: subJson.endpoint,
        p256dh: subJson.keys.p256dh,
        auth: subJson.keys.auth,
        user_agent: navigator.userAgent,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,endpoint'
      });

    if (error) {
      console.error('Error saving push subscription:', error);
      return false;
    }
    
    console.log('Push subscription saved to database');
    return true;
  };

  const registerServiceWorker = useCallback(async (): Promise<ServiceWorkerRegistration | null> => {
    if (!('serviceWorker' in navigator)) {
      console.log('Service workers not supported');
      return null;
    }

    try {
      // Register service worker
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });
      console.log('Service Worker registered with scope:', registration.scope);
      
      // Wait for it to be ready
      await navigator.serviceWorker.ready;
      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      throw new Error('Failed to register service worker. Please try again.');
    }
  }, []);

  const subscribeToPush = useCallback(async (registration: ServiceWorkerRegistration): Promise<PushSubscription> => {
    if (!VAPID_PUBLIC_KEY) {
      throw new Error('VAPID public key not configured. Push notifications are not available.');
    }

    try {
      // Check for existing subscription first
      let subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        console.log('Using existing push subscription');
        return subscription;
      }

      // Create new subscription
      console.log('Creating new push subscription...');
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToArrayBuffer(VAPID_PUBLIC_KEY),
      });
      
      console.log('Push subscription created:', subscription.endpoint.substring(0, 50));
      return subscription;
    } catch (error) {
      console.error('Failed to subscribe to push:', error);
      if (error instanceof Error && error.message.includes('permission')) {
        throw new Error('Notification permission was denied');
      }
      throw new Error('Failed to create push subscription. Please try again.');
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (state.status === 'not_supported') {
      toast.error('Push notifications are not supported in this browser');
      return false;
    }

    if (!user?.id) {
      toast.error('Please sign in to enable push notifications');
      return false;
    }

    if (!VAPID_PUBLIC_KEY) {
      toast.error('Push notifications are not configured for this app');
      setState(prev => ({ ...prev, error: 'VAPID key not configured' }));
      return false;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      
      if (permission === 'denied') {
        setState({ status: 'permission_denied', error: 'Permission denied. Enable notifications in browser settings.', isLoading: false });
        toast.error('Notification permission denied');
        return false;
      }

      if (permission !== 'granted') {
        setState({ status: 'not_subscribed', error: 'Permission not granted', isLoading: false });
        return false;
      }

      // Register service worker
      const registration = await registerServiceWorker();
      if (!registration) {
        throw new Error('Failed to register service worker');
      }

      // Subscribe to push
      const subscription = await subscribeToPush(registration);
      
      // Save to database
      const saved = await saveSubscriptionToDb(subscription, user.id);
      if (!saved) {
        throw new Error('Failed to save subscription');
      }

      setState({ status: 'subscribed', error: null, isLoading: false });
      toast.success('Push notifications enabled!');
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to enable notifications';
      console.error('Error enabling push notifications:', error);
      setState({ status: 'error', error: errorMessage, isLoading: false });
      toast.error(errorMessage);
      return false;
    }
  }, [state.status, user?.id, registerServiceWorker, subscribeToPush]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!user?.id) return false;

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        // Unsubscribe from push manager
        await subscription.unsubscribe();
        
        // Remove from database
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', user.id)
          .eq('endpoint', subscription.endpoint);
        
        console.log('Unsubscribed from push notifications');
      }

      setState({ status: 'not_subscribed', error: null, isLoading: false });
      toast.success('Push notifications disabled');
      return true;
    } catch (error) {
      console.error('Error unsubscribing:', error);
      setState(prev => ({ ...prev, isLoading: false, error: 'Failed to unsubscribe' }));
      return false;
    }
  }, [user?.id]);

  const showLocalNotification = useCallback(async (title: string, options?: NotificationOptions) => {
    if (state.status !== 'subscribed' && Notification.permission !== 'granted') {
      console.log('Cannot show notification - not subscribed or permission denied');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, {
        icon: '/favicon.png',
        badge: '/favicon.png',
        ...options,
      });
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }, [state.status]);

  // Derived values for backwards compatibility
  const isSupported = state.status !== 'not_supported';
  const isSubscribed = state.status === 'subscribed';
  const permission = state.status === 'permission_denied' 
    ? 'denied' 
    : state.status === 'subscribed' 
      ? 'granted' 
      : 'default';

  return {
    // New comprehensive state
    status: state.status,
    error: state.error,
    isLoading: state.isLoading,
    
    // Backwards compatible values
    isSupported,
    isSubscribed,
    permission,
    
    // Actions
    requestPermission,
    unsubscribe,
    showLocalNotification,
  };
};
