import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  authorizeApplicationAccepted,
  authorizeContentSubmission,
  authorizeDirectMessage,
  authorizeGuestApplication,
  authorizeNewApplication,
  authorizeNewContent,
  authorizePartnerAccepted,
  authorizeRsvpConfirmation,
  authorizeTransactionalEmail,
  authorizeUserNotification,
  invoiceDelivery,
  loadUserNotificationFacts,
  messagePreview,
} from "../../supabase/functions/_shared/notification-auth.mjs";

const caller = "11111111-1111-4111-8111-111111111111";
const recipient = "22222222-2222-4222-8222-222222222222";
const conversation = "33333333-3333-4333-8333-333333333333";
const messageId = "44444444-4444-4444-8444-444444444444";
const projectId = "55555555-5555-4555-8555-555555555555";
const postId = "66666666-6666-4666-8666-666666666666";
const storyId = "77777777-7777-4777-8777-777777777777";
const streamId = "88888888-8888-4888-8888-888888888888";
const eventId = "99999999-9999-4999-8999-999999999999";
const rsvpId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const storedMessage = {
  id: messageId,
  conversation_id: conversation,
  sender_id: caller,
  content: "Meet me at the studio",
  media_type: null,
};

function dm(overrides: Record<string, unknown> = {}) {
  return authorizeDirectMessage({
    callerId: caller,
    recipientId: recipient,
    conversationId: conversation,
    messageId,
    message: storedMessage,
    participantIds: [caller, recipient],
    ...overrides,
  });
}

describe("direct message notification", () => {
  it("rejects a caller the session cannot identify", () => {
    const result = dm({ callerId: null });
    assert.equal(result.ok, false);
    assert.equal(result.status, 401);
  });

  it("requires a conversation or a message", () => {
    const result = dm({ conversationId: "", messageId: "" });
    assert.equal(result.status, 400);
  });

  it("rejects a caller who did not send the stored message", () => {
    const result = dm({ message: { ...storedMessage, sender_id: recipient } });
    assert.equal(result.status, 403);
  });

  it("rejects a recipient who is not in the conversation", () => {
    const result = dm({ participantIds: [caller] });
    assert.equal(result.status, 403);
  });

  it("uses the stored message, ignoring any preview supplied beside it", () => {
    const result = dm();
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.preview, "Meet me at the studio");
    assert.equal(messagePreview({ content: "  ", media_type: "video" }), "Sent a video");
  });
});

describe("user push and email", () => {
  it("builds a follow notice from the profile, not a supplied title", () => {
    const result = authorizeUserNotification({
      callerId: caller,
      recipientId: recipient,
      notificationType: "follow",
      data: {},
      facts: { callerName: "Ada", followsRecipient: true },
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.title, "New follower");
    assert.equal(result.body, "Ada added you to favorites");
  });

  it("refuses a follow that is not stored", () => {
    const result = authorizeUserNotification({
      callerId: caller,
      recipientId: recipient,
      notificationType: "follow",
      data: {},
      facts: { callerName: "Ada", followsRecipient: false },
    });
    assert.equal(result.status, 403);
  });

  it("refuses a like when the post belongs to someone else", () => {
    const result = authorizeUserNotification({
      callerId: caller,
      recipientId: recipient,
      notificationType: "like",
      data: { post_id: postId },
      facts: { postLike: { ownerId: caller, content: "nope" } },
    });
    assert.equal(result.status, 403);
  });

  it("uses the stored post caption", () => {
    const result = authorizeUserNotification({
      callerId: caller,
      recipientId: recipient,
      notificationType: "like",
      data: { post_id: postId },
      facts: { callerName: "Ada", postLike: { ownerId: recipient, content: "Real caption" } },
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.body, "Real caption");
    assert.equal(result.title, "Ada liked your post");
  });

  it("requires a story reaction on that recipient's story", () => {
    const missing = authorizeUserNotification({
      callerId: caller,
      recipientId: recipient,
      notificationType: "like",
      data: { story_id: storyId },
      facts: {},
    });
    assert.equal(missing.status, 403);
  });

  it("refuses a live alert from someone who is not the host", () => {
    const result = authorizeUserNotification({
      callerId: caller,
      recipientId: recipient,
      notificationType: "live_stream",
      data: { stream_id: streamId },
      facts: { stream: { hostId: recipient }, recipientFollowsCaller: true },
    });
    assert.equal(result.status, 403);
  });

  it("refuses message, invite, and other freeform types", () => {
    for (const notificationType of ["message", "project_invite", "event_reminder", "admin"]) {
      const result = authorizeUserNotification({
        callerId: caller,
        recipientId: recipient,
        notificationType,
        data: {},
        facts: {},
      });
      assert.equal(result.status, 403, notificationType);
    }
  });

  it("loads the follow and the caller name the notice is allowed to use", async () => {
    const facts = await loadUserNotificationFacts(stubDb({
      profiles: [{ user_id: caller, display_name: "Ada" }],
      favorite_friends: [{ user_id: caller, friend_user_id: recipient }],
    }), {
      callerId: caller,
      recipientId: recipient,
      notificationType: "follow",
      data: {},
    });
    const result = authorizeUserNotification({
      callerId: caller,
      recipientId: recipient,
      notificationType: "follow",
      data: { title: "You won a prize" },
      facts,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.body, "Ada added you to favorites");
  });
});

describe("application and content notices", () => {
  it("notifies the project's creator with the stored application", () => {
    const spoofed = authorizeNewApplication({
      callerId: caller,
      role: "authenticated",
      project: { id: projectId, creator_id: recipient, title: "Real film" },
      application: {
        project_id: projectId,
        applicant_id: caller,
        applicant_name: "Ada",
        role_name: "Editor",
      },
    });
    assert.equal(spoofed.ok, true);
    if (!spoofed.ok) return;
    assert.equal(spoofed.recipientId, recipient);
    assert.equal(spoofed.projectTitle, "Real film");
    assert.equal(spoofed.applicantName, "Ada");
  });

  it("refuses an application the caller did not file", () => {
    const result = authorizeNewApplication({
      callerId: caller,
      role: "authenticated",
      project: { id: projectId, creator_id: recipient, title: "Real film" },
      application: { project_id: projectId, applicant_id: recipient, applicant_name: "Fake" },
    });
    assert.equal(result.status, 403);
  });

  it("lets only the owner announce an accepted application", () => {
    const denied = authorizeApplicationAccepted({
      callerId: caller,
      role: "authenticated",
      project: { id: projectId, creator_id: recipient, title: "Real film" },
      application: { project_id: projectId, applicant_id: caller, status: "accepted", role_name: "Editor" },
    });
    assert.equal(denied.status, 403);
    const allowed = authorizeApplicationAccepted({
      callerId: recipient,
      role: "authenticated",
      project: { id: projectId, creator_id: recipient, title: "Real film" },
      application: { project_id: projectId, applicant_id: caller, status: "accepted", role_name: "Editor" },
    });
    assert.equal(allowed.ok, true);
    if (!allowed.ok) return;
    assert.equal(allowed.roleTitle, "Editor");
  });

  it("sends a guest application to the stored creator and applicant", () => {
    const result = authorizeGuestApplication({
      role: "anon",
      project: { id: projectId, creator_id: recipient, title: "Real film" },
      application: {
        project_id: projectId,
        email: "guest@example.com",
        name: "Guest",
        role_name: "PA",
        portfolio_link: "javascript:alert(1)",
        message: "Hello",
      },
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.creatorId, recipient);
    assert.equal(result.applicantEmail, "guest@example.com");
    assert.equal(result.portfolioLink, null);
    assert.equal(result.applicantName, "Guest");
  });

  it("requires the caller to own the content submission", () => {
    const result = authorizeContentSubmission({
      callerId: caller,
      role: "authenticated",
      network: { id: projectId, owner_id: recipient, name: "LC Cinema" },
      submission: { network_id: projectId, submitter_id: recipient, title: "Short", content_type: "short_film" },
      submitterName: "Ada",
    });
    assert.equal(result.status, 403);
  });

  it("uses the stored event title and requires the creator", () => {
    const denied = authorizeNewContent({
      callerId: caller,
      role: "authenticated",
      contentType: "event",
      record: { id: eventId, creator_id: recipient, title: "Opening night" },
      creatorName: "Ada",
    });
    assert.equal(denied.status, 403);
    const allowed = authorizeNewContent({
      callerId: recipient,
      role: "authenticated",
      contentType: "event",
      record: { id: eventId, creator_id: recipient, title: "Opening night", description: "Doors at 7" },
      creatorName: "Host",
    });
    assert.equal(allowed.ok, true);
    if (!allowed.ok || allowed.skip) return;
    assert.equal(allowed.title, "Opening night");
    assert.equal(allowed.creatorName, "Host");
  });
});

describe("other senders", () => {
  it("allows transactional email only from the service role", () => {
    assert.equal(authorizeTransactionalEmail({ role: "anon" }).status, 401);
    assert.equal(authorizeTransactionalEmail({ role: "authenticated" }).status, 401);
    assert.equal(authorizeTransactionalEmail({ role: "service_role" }).ok, true);
  });

  it("sends an RSVP confirmation only to the person on the row", () => {
    const guest = authorizeRsvpConfirmation({
      callerId: null,
      role: "anon",
      eventId,
      rsvpId,
      rsvp: { event_id: eventId, user_id: null },
      eventCreatorId: recipient,
    });
    assert.equal(guest.ok, true);
    const stranger = authorizeRsvpConfirmation({
      callerId: caller,
      role: "authenticated",
      eventId,
      rsvpId,
      rsvp: { event_id: eventId, user_id: recipient },
      eventCreatorId: projectId,
    });
    assert.equal(stranger.status, 403);
    const host = authorizeRsvpConfirmation({
      callerId: caller,
      role: "authenticated",
      eventId,
      rsvpId,
      rsvp: { event_id: eventId, user_id: recipient },
      eventCreatorId: caller,
    });
    assert.equal(host.ok, true);
    const mismatch = authorizeRsvpConfirmation({
      callerId: null,
      role: "anon",
      eventId,
      rsvpId,
      rsvp: { event_id: projectId, user_id: null },
      eventCreatorId: recipient,
    });
    assert.equal(mismatch.status, 400);
    const missing = authorizeRsvpConfirmation({
      callerId: null,
      role: "anon",
      eventId: "",
      rsvpId: "",
      rsvp: null,
      eventCreatorId: null,
    });
    assert.equal(missing.status, 400);
  });

  it("sends a partner welcome to the stored contact", () => {
    const result = authorizePartnerAccepted({
      callerIsAdmin: true,
      application: { id: projectId, status: "approved", contact_email: "ada@example.com", business_name: "Ada Studio" },
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.email, "ada@example.com");
    assert.equal(result.businessName, "Ada Studio");
    assert.equal(authorizePartnerAccepted({
      callerIsAdmin: true,
      application: { id: projectId, status: "pending", contact_email: "ada@example.com", business_name: "Ada" },
    }).status, 403);
  });

  it("sends an invoice to the stored recipient from the owner's account", () => {
    const result = invoiceDelivery({
      profileName: "Ada <script>",
      accountEmail: "ada@example.com",
      storedRecipient: "client@example.com",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.destination, "client@example.com");
    assert.equal(result.senderName, "Ada script");
    assert.equal(result.replyTo, "ada@example.com");
    assert.equal(invoiceDelivery({ profileName: "Ada", accountEmail: "ada@example.com", storedRecipient: "  " }).status, 400);
  });
});

function stubDb(tables: Record<string, Array<Record<string, unknown>>>) {
  return {
    from(table: string) {
      const filters: Array<[string, unknown]> = [];
      const api = {
        select() {
          return api;
        },
        eq(column: string, value: unknown) {
          filters.push([column, value]);
          return api;
        },
        async maybeSingle() {
          const found = (tables[table] ?? []).find((row) => filters.every(([column, value]) => row[column] === value));
          return { data: found ?? null };
        },
      };
      return api;
    },
  };
}
