// ETHER Service Worker for Push Notifications
// Production domain: etherbylcove.com

const APP_NAME = "ETHER";
const DEFAULT_ICON = "/favicon.png";
const DEFAULT_BADGE = "/favicon.png";

// Install event - take control immediately
self.addEventListener("install", (event) => {
  console.log("[SW] Service Worker installed");
  self.skipWaiting();
});

// Activate event - claim all clients
self.addEventListener("activate", (event) => {
  console.log("[SW] Service Worker activated");
  event.waitUntil(clients.claim());
});

// Push event - display notification when push message received
self.addEventListener("push", (event) => {
  console.log("[SW] Push event received");

  const defaultData = {
    title: APP_NAME,
    body: "You have a new notification",
    icon: DEFAULT_ICON,
    badge: DEFAULT_BADGE,
    data: { url: "/notifications", type: "general" },
  };

  const showNotification = async () => {
    let payload = {};
    
    if (event.data) {
      try {
        payload = event.data.json();
        console.log("[SW] Push payload parsed:", payload.title || "No title");
      } catch (jsonError) {
        try {
          const text = await event.data.text();
          console.log("[SW] Push payload as text:", text.substring(0, 100));
          payload = { body: text };
        } catch (textError) {
          console.error("[SW] Error parsing push data:", textError);
        }
      }
    }

    const merged = { ...defaultData, ...payload };
    const notificationType = merged.data?.type || "general";
    
    // Build notification options
    const options = {
      body: merged.body,
      icon: merged.icon || DEFAULT_ICON,
      badge: merged.badge || DEFAULT_BADGE,
      vibrate: [200, 100, 200, 100, 200],
      data: merged.data || { url: "/notifications" },
      actions: [
        { action: "view", title: "View" },
        { action: "dismiss", title: "Dismiss" },
      ],
      // Keep notification on lockscreen for important types
      requireInteraction: notificationType === "message" || notificationType === "project_invite",
      silent: false,
      // Group by type with unique tag
      tag: merged.tag || `ether-${notificationType}-${Date.now()}`,
      renotify: merged.renotify !== false,
      timestamp: merged.timestamp || Date.now(),
    };

    // Add image if provided
    if (merged.image) {
      options.image = merged.image;
    }

    console.log("[SW] Showing notification:", merged.title);
    await self.registration.showNotification(merged.title, options);
  };

  event.waitUntil(showNotification());
});

// Notification click - navigate to appropriate page
self.addEventListener("notificationclick", (event) => {
  console.log("[SW] Notification clicked:", event.action);
  event.notification.close();

  // Handle dismiss action
  if (event.action === "dismiss") {
    return;
  }

  event.waitUntil(
    (async () => {
      const notificationData = event.notification?.data || {};
      const notificationType = notificationData.type || "general";
      
      // Build deep link URL based on notification type
      let targetPath = notificationData.url || "/notifications";
      
      // Type-specific deep links for better UX
      if (notificationType === "message" && notificationData.conversation_id) {
        targetPath = `/messages?chat=${notificationData.conversation_id}`;
      } else if (notificationType === "project_invite" && notificationData.project_id) {
        targetPath = `/projects?id=${notificationData.project_id}`;
      } else if (notificationType === "live_stream" && notificationData.stream_id) {
        targetPath = `/live?stream=${notificationData.stream_id}`;
      } else if (notificationType === "event_reminder" && notificationData.event_id) {
        targetPath = `/calendar?event=${notificationData.event_id}`;
      } else if ((notificationType === "like" || notificationType === "comment") && notificationData.post_id) {
        targetPath = `/feed?post=${notificationData.post_id}`;
      }

      // Ensure same-origin URL
      const target = new URL(targetPath, self.location.origin);
      if (target.origin !== self.location.origin) {
        console.warn("[SW] Cross-origin URL blocked, redirecting to notifications");
        target.href = self.location.origin + "/notifications";
      }

      console.log("[SW] Navigating to:", target.href);

      // Try to find existing window and navigate
      const clientList = await clients.matchAll({ type: "window", includeUncontrolled: true });

      for (const client of clientList) {
        if ("focus" in client) {
          try {
            await client.navigate(target.href);
            return client.focus();
          } catch (navError) {
            console.warn("[SW] Navigation failed, trying focus:", navError);
            return client.focus();
          }
        }
      }

      // Open new window if none found
      if (clients.openWindow) {
        return clients.openWindow(target.href);
      }
    })()
  );
});

// Notification close event for analytics
self.addEventListener("notificationclose", (event) => {
  console.log("[SW] Notification closed:", event.notification.tag);
});

// Handle push subscription change (when subscription expires)
self.addEventListener("pushsubscriptionchange", (event) => {
  console.log("[SW] Push subscription changed, need to resubscribe");
  
  event.waitUntil(
    (async () => {
      try {
        // Attempt to resubscribe with same options
        const subscription = await self.registration.pushManager.subscribe(
          event.oldSubscription?.options || {
            userVisibleOnly: true,
          }
        );
        console.log("[SW] Resubscribed successfully");
        
        // Notify any open clients to update the subscription in the database
        const clientList = await clients.matchAll({ type: "window" });
        for (const client of clientList) {
          client.postMessage({
            type: "PUSH_SUBSCRIPTION_CHANGED",
            subscription: subscription.toJSON(),
          });
        }
      } catch (error) {
        console.error("[SW] Failed to resubscribe:", error);
      }
    })()
  );
});
