self.addEventListener("install", (event) => {
  console.log("Service Worker installed");
  self.skipWaiting(); // keep if you want instant updates
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
        // fall back to text payload
        try {
          const text = await event.data.text();
          payload = { body: text };
        } catch (err) {
          console.error("Error parsing push data:", err);
        }
      }
    }

    const merged = { ...defaultData, ...payload };
    
    // Enhanced notification options for lockscreen visibility (like Instagram)
    const options = {
      body: merged.body,
      icon: merged.icon || "/favicon.png",
      badge: merged.badge || "/favicon.png",
      // Multiple vibration patterns for attention
      vibrate: [200, 100, 200, 100, 200],
      // Notification data for click handling
      data: merged.data || { url: "/notifications" },
      // Actions for quick response
      actions: [
        { action: "view", title: "View" },
        { action: "dismiss", title: "Dismiss" },
      ],
      // Show on lockscreen
      requireInteraction: false,
      // Keep notification visible until user interacts
      silent: false,
      // Tag to replace duplicate notifications
      tag: merged.tag || `ether-${Date.now()}`,
      // Renotify even if same tag (for multiple of same type)
      renotify: true,
      // Timestamp for notification ordering
      timestamp: Date.now(),
    };

    await self.registration.showNotification(merged.title, options);
  };

  event.waitUntil(show());
});

self.addEventListener("notificationclick", (event) => {
  console.log("Notification clicked:", event);
  event.notification.close();

  if (event.action === "dismiss") return;

  event.waitUntil(
    (async () => {
      const rawUrl = event.notification?.data?.url || "/notifications";

      // Force same-origin + absolute URL
      const target = new URL(rawUrl, self.location.origin);
      if (target.origin !== self.location.origin) {
        target.href = self.location.origin + "/notifications";
      }

      const clientList = await clients.matchAll({ type: "window", includeUncontrolled: true });

      // Reuse existing tab if possible
      for (const client of clientList) {
        if ("focus" in client) {
          // Navigate then focus
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
