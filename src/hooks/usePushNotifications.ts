import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const usePushNotifications = () => {
  const { user } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setIsSupported(supported);
    
    if (supported) {
      setPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    const checkSubscription = async () => {
      if (!isSupported) return;
      
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        setIsSubscribed(!!subscription);
      } catch (error) {
        console.error('Error checking push subscription:', error);
      }
    };

    checkSubscription();
  }, [isSupported]);

  const registerServiceWorker = useCallback(async () => {
    if (!('serviceWorker' in navigator)) {
      console.log('Service workers not supported');
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered:', registration);
      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return null;
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      toast.error('Push notifications are not supported in this browser');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result === 'granted') {
        await registerServiceWorker();
        toast.success('Push notifications enabled!');
        return true;
      } else if (result === 'denied') {
        toast.error('Notification permission denied');
        return false;
      }
      return false;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      toast.error('Failed to enable notifications');
      return false;
    }
  }, [isSupported, registerServiceWorker]);

  const showLocalNotification = useCallback(async (title: string, options?: NotificationOptions) => {
    if (!isSupported || permission !== 'granted') {
      console.log('Cannot show notification - not supported or permission denied');
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
  }, [isSupported, permission]);

  // Subscribe to real-time notifications and show push notifications
  useEffect(() => {
    if (!user?.id || permission !== 'granted') return;

    const channel = supabase
      .channel('push-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          const notification = payload.new as {
            title: string;
            body: string | null;
            type: string;
            data: Record<string, unknown>;
          };
          
          await showLocalNotification(notification.title, {
            body: notification.body || undefined,
            data: { url: '/notifications', ...notification.data },
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, permission, showLocalNotification]);

  return {
    isSupported,
    isSubscribed,
    permission,
    requestPermission,
    showLocalNotification,
  };
};
