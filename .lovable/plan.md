
The social share buttons (Instagram, WhatsApp, Twitter, etc.) in `EventDetailDialog` likely fail because:
1. **Instagram has no web share URL** — there's no `instagram.com/share?url=...` API. The only way to share to Instagram from web is to copy the link/image and have the user paste it manually, or use the native share sheet on mobile.
2. **WhatsApp/Twitter/SMS/Facebook** use `window.open(url, '_blank')` which is often blocked by popup blockers (especially inside the Lovable preview iframe), and may silently fail without feedback.
3. The handlers may not be using the canonical `etherbylcove.com` URL.

Let me check the actual implementation.

I need to view `EventDetailDialog.tsx` to confirm the current share menu structure, and check any other place with channel-specific share buttons.

## Plan

### 1. Extend `src/lib/shareLink.ts` with channel helpers

Add a `shareToChannel` function and per-channel URL builders:

```ts
export type ShareChannel = 'twitter' | 'whatsapp' | 'facebook' | 'sms' | 'email' | 'instagram' | 'copy' | 'native';

shareToChannel(channel, { title, text, url })
```

Behavior per channel:
- **twitter** → `https://twitter.com/intent/tweet?text=...&url=...` opened in new tab; if `window.open` returns null (blocked), fall back to `shareLink()` (copy) and toast "Popup blocked — link copied instead".
- **whatsapp** → `https://wa.me/?text=<text>%20<url>` (works on web + deep-links to app on mobile). Same popup-blocker fallback.
- **facebook** → `https://www.facebook.com/sharer/sharer.php?u=<url>`. Same fallback.
- **sms** → `sms:?&body=<text>%20<url>` via `window.location.href` (no popup blocker).
- **email** → `mailto:?subject=<title>&body=<text>%20<url>`.
- **instagram** → Instagram has NO web share API. Copy link to clipboard + toast: "Link copied! Paste it into your Instagram story or DM." On mobile, attempt `instagram://` deep link as a best-effort first.
- **copy** → existing `shareLink()` clipboard path.
- **native** → existing `shareLink()` native sheet path.

Always show a success toast so the user knows something happened.

### 2. Update `EventDetailDialog.tsx`

Refactor the existing channel buttons (Twitter, WhatsApp, SMS, Facebook, Instagram, Copy/Native) to call `shareToChannel(channel, { title, text, url: buildShareUrl.event(eventId) })`. Remove inline `window.open` calls.

### 3. Audit & update other channel-share surfaces

Files I need to check & likely update:
- `src/components/calendar/EventDetailDialog.tsx`
- `src/pages/PublicEventPage.tsx`
- `src/components/projects/ProjectDetail.tsx` (share menu)
- `src/components/projects/ProjectCard.tsx`
- `src/pages/PublicProjectPage.tsx`
- Any other component with Twitter/WhatsApp/Facebook/Instagram buttons

For each, replace inline channel logic with `shareToChannel()`.

### 4. Test

1. In preview iframe (popup-blocked): tap Twitter/WhatsApp/Facebook → toast "Popup blocked — link copied instead", URL on clipboard.
2. On the published site: tap each → opens the correct compose window/app with prefilled text + canonical `etherbylcove.com` URL.
3. Instagram → toast "Link copied — paste into your story/DM"; on mobile also tries `instagram://` deep-link.
4. SMS / Email → opens native compose with prefilled body.
5. Cancel/dismiss any popup → no error toast.
