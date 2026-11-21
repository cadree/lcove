# Google Calendar inside Ether

My Events → Calendar feed is a one-way subscribe link. It publishes the events a host creates on Ether so Google Calendar, Apple Calendar, or Outlook can pull them. It does not read the host's personal Google Calendar.

Showing that calendar inside Ether, and blocking double-bookings against it, needs Google OAuth with the calendar scope. Google verifies that scope before an app can ask most users for it. That review is not part of the work before November 2.

## Later, if we import Google Calendar

1. Add a Google Cloud OAuth client whose redirect lands on Ether.
2. Request `https://www.googleapis.com/auth/calendar.readonly` only. Do not request write access until a host can push an Ether event back to Google on purpose.
3. Submit Google's calendar-scope verification (privacy policy, homepage, and a screen recording of the consent screen). Unverified calendar scopes stay capped at test users.
4. Store the refresh token in Supabase, encrypted, scoped to the host. Never put it in the feed URL.
5. Read busy blocks into a private table the host can see on My Events. Do not show those blocks to guests.
6. Conflict check: when the host picks a start time, compare it with those busy blocks and with Ether events. Warn. Do not silently move the event.
7. Refresh tokens on a schedule. If Google revokes access, clear the busy blocks and say the connection expired.

Until that ships, the subscribe link is the calendar feature. A host who wants Ether events on their phone adds the feed. A host who wants their existing appointments inside Ether still uses their calendar app.
