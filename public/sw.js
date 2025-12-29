self.addEventListener("install", (event) => {
  console.log("Service Worker installed");
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("Service Worker activated");
  event.waitUntil(clients.claim());
});

self.addEventListener("push", (event) => {
  console.log("Push event received:", event);

  const defaultData = {
    title: "ETHER",
    body: "You have a new notification",
    icon: "/favicon.png",
    badge: "/favicon.png",
    data: { url: "/notifications" },
  };

  const show = async () => {
    let payload = {};
    if (event.data) {
      try {
        payload = event.data.json();
      } catch (e) {
        try {
          const text = await event.data.text();
          payload = { body: text };
        } catch (err) {
          console.error("Error parsing push data:", err);
        }
      }
    }

    const merged = { ...defaultData, ...payload };
    const notificationType = merged.data?.type || 'general';
    
    // Instagram-like notification options for maximum lockscreen visibility
    const options = {
      body: merged.body,
      icon: merged.icon || "/favicon.png",
      badge: merged.badge || "/favicon.png",
      // Strong vibration pattern for attention
      vibrate: [200, 100, 200, 100, 200],
      // Deep link data
      data: merged.data || { url: "/notifications" },
      // Quick actions
      actions: [
        { action: "view", title: "View" },
        { action: "dismiss", title: "Dismiss" },
      ],
      // Critical: require interaction for important notifications
      requireInteraction: notificationType === 'message' || notificationType === 'project_invite',
      // Audible notification
      silent: false,
      // Type-based grouping tag (Instagram-style)
      tag: merged.tag || `ether-${notificationType}-${Date.now()}`,
      // Renotify for multiple of same type
      renotify: merged.renotify !== false,
      // Ordering timestamp
      timestamp: merged.timestamp || Date.now(),
      // Image support for rich notifications
      image: merged.image || null,
    };

    // Remove null values
    if (!options.image) delete options.image;

    await self.registration.showNotification(merged.title, options);
  };

  event.waitUntil(show());
});

self.addEventListener("notificationclick", (event) => {
  console.log("Notification clicked:", event);
  event.notification.close();

  // Handle dismiss action
  if (event.action === "dismiss") return;

  event.waitUntil(
    (async () => {
      const notificationData = event.notification?.data || {};
      const notificationType = notificationData.type || 'general';
      
      // Build URL based on notification type for deep linking
      let targetPath = notificationData.url || "/notifications";
      
      // Type-specific deep links
      if (notificationType === 'message' && notificationData.conversation_id) {
        targetPath = `/messages?conversation=${notificationData.conversation_id}`;
      } else if (notificationType === 'project_invite' && notificationData.project_id) {
        targetPath = `/projects?id=${notificationData.project_id}`;
      } else if (notificationType === 'live_stream' && notificationData.stream_id) {
        targetPath = `/live?stream=${notificationData.stream_id}`;
      } else if (notificationType === 'event_reminder' && notificationData.event_id) {
        targetPath = `/calendar?event=${notificationData.event_id}`;
      } else if ((notificationType === 'like' || notificationType === 'comment') && notificationData.post_id) {
        targetPath = `/feed?post=${notificationData.post_id}`;
      }

      // Force same-origin + absolute URL
      const target = new URL(targetPath, self.location.origin);
      if (target.origin !== self.location.origin) {
        target.href = self.location.origin + "/notifications";
      }

      const clientList = await clients.matchAll({ type: "window", includeUncontrolled: true });

      // Reuse existing tab if possible
      for (const client of clientList) {
        if ("focus" in client) {
          try {
            await client.navigate(target.href);
          } catch (_) {}
          return client.focus();
        }
      }

      // Otherwise open a new tab
      if (clients.openWindow) {
        return clients.openWindow(target.href);
      }
    })(),
  );
});

// Handle notification close (for analytics if needed)
self.addEventListener("notificationclose", (event) => {
  console.log("Notification closed:", event.notification.tag);
});
