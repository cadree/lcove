

# Fix External Guest Email Delivery

## Root cause

The `send-event-invite` edge function calls Resend directly with `from: events@notify.etherbylcove.com`, but Resend returns:

> "The notify.etherbylcove.com domain is not verified. Please add and verify your domain on resend.com/domains"

So every email send returns 403 and silently fails. SMS works fine (your phone got the invite). This has nothing to do with the host-branding refactor — the Resend account simply has no verified domain to send from.

## Two paths to fix

You need to pick one. Both keep the host-branded "From name" we just built.

### Path A — Use Lovable's built-in email system (recommended)

Switch invite/reminder/bulk-reminder emails off raw Resend and onto Lovable's managed email pipeline (the same one used for password resets, etc.). This system already has a verified sender domain wired up and handles retries, suppression, and unsubscribe footers automatically.

What changes:
1. Set up Lovable's email infrastructure (one-time domain config + scaffold) if not already active.
2. Register three transactional email templates:
   - `event-invite` (host-branded invite)
   - `event-reminder` (host-branded reminder)
   - `event-bulk-reminder` (host-branded bulk reminder)
3. Refactor `send-event-invite`, `send-event-reminder`, and `send-bulk-attendee-reminder` to invoke `send-transactional-email` per recipient instead of calling Resend directly.
4. Keep the host identity layer (`resolveHostIdentity`) — pass `fromName`, `replyTo`, brand color, header image, personal note, signature, and event details into the template via `templateData`.
5. SMS via Twilio stays exactly as-is.
6. Per-recipient error reporting in the response stays as-is.

Pros: works immediately, no DNS needed from you, better deliverability, automatic suppression/unsubscribe, full delivery logs in `email_send_log`.
Cons: emails get a small Lovable-managed unsubscribe footer appended automatically.

### Path B — Verify the Resend domain

Keep the current Resend-based code, but verify `notify.etherbylcove.com` (or another domain) in your Resend dashboard so the API stops rejecting sends.

What changes:
1. You add DNS records (SPF, DKIM) in your domain registrar shown by Resend.
2. Wait for Resend to mark the domain "Verified".
3. No code changes needed — invites will start sending.

Pros: no template/edge-function refactor, full control over HTML.
Cons: requires you to do DNS work, no automatic suppression list, no built-in unsubscribe, brittle if you ever rotate domains.

## Recommendation

**Path A.** It's faster, more reliable, and matches how the rest of the platform's mail already works. The host branding (`{Host} via Ether`, reply-to, personal note, brand color, header image) is preserved — we just swap the transport layer underneath.

## QA after fix

- External guest with email only → email arrives in inbox, shows host From name
- External guest with phone only → SMS still works
- External guest with both → both channels fire
- Check `email_send_log` table to confirm delivery status per send
- Reminder + bulk reminder both deliver

