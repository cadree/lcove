
The user wants share buttons (Instagram, WhatsApp, Twitter, Facebook, etc.) to open the **native mobile app directly** instead of opening the web compose page in a new browser tab.

## Current behavior
`shareToChannel` in `src/lib/shareLink.ts` uses `window.open(https://twitter.com/intent/tweet?...)` and `https://wa.me/?text=...` — these open mobile web pages, not the apps directly. On mobile, the OS sometimes intercepts and routes to the app, but often it just opens Safari/Chrome.

## Plan

### 1. Use app deep-link URI schemes on mobile, web URLs as fallback

Update `shareToChannel` in `src/lib/shareLink.ts` to detect mobile (iOS/Android UA) and try the native app scheme first, falling back to the web intent if the app isn't installed.

| Channel | Mobile (try app first) | Desktop / fallback |
|---|---|---|
| **Twitter/X** | `twitter://post?message=<text>%20<url>` | `https://twitter.com/intent/tweet?...` |
| **WhatsApp** | `whatsapp://send?text=<text>%20<url>` | `https://wa.me/?text=...` |
| **Facebook** | `fb://share?link=<url>` (limited) → fallback to web sharer | `https://www.facebook.com/sharer/...` |
| **Instagram** | `instagram://library` (no direct share API) + copy link | copy link + toast |
| **SMS** | `sms:?&body=...` (already native) | clipboard fallback |
| **Email** | `mailto:?...` (already native) | — |

### 2. Implementation pattern (app-first with timeout fallback)

For each app-capable channel on mobile:
```ts
const tryAppScheme = (appUrl: string, webUrl: string) => {
  const start = Date.now();
  // Try app scheme via location.href (no popup blocker on mobile)
  window.location.href = appUrl;
  // If app isn't installed, browser stays on page → fall back to web URL after 800ms
  setTimeout(() => {
    if (Date.now() - start < 1500 && document.visibilityState === 'visible') {
      window.location.href = webUrl;
    }
  }, 800);
};
```

The `visibilityState` check detects whether the app actually launched (page becomes hidden when app opens). If still visible after 800ms, the app isn't installed → open web fallback.

### 3. On desktop, keep existing web `window.open` behavior with the popup-blocked → clipboard fallback already in place.

### 4. Best practice: prefer native share sheet on mobile when available

Add a new "Share via apps…" entry that calls `navigator.share()` directly — this opens the OS share sheet which lists every installed app (Instagram, WhatsApp, Messages, AirDrop, etc.) and is the most reliable way to post directly into an app. Recommend this as the primary CTA on mobile.

### Files to update
- `src/lib/shareLink.ts` — add mobile detection + app-scheme attempts with web fallback for Twitter, WhatsApp, Facebook
- (No component changes needed — `EventDetailDialog` and other consumers already call `shareToChannel`)

### Test
1. **iOS Safari** at `etherbylcove.com/event/:id` → tap WhatsApp → WhatsApp app opens with text prefilled. Tap Twitter → X app opens with composer. Tap Instagram → toast says "Link copied" + Instagram app opens to library.
2. **Android Chrome** → same as above for installed apps.
3. **Phone without WhatsApp installed** → after ~800ms, falls back to `wa.me` web page.
4. **Desktop** → opens web compose page in new tab as today.
5. **Lovable preview iframe** (popup blocked) → toast "Popup blocked — link copied".
