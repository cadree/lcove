/**
 * Authorization for notification, email, and push senders.
 * Callers pass rows they already loaded. The displayed name and preview
 * come from those rows, never from a request body.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value) {
  return typeof value === "string" && UUID.test(value);
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function displayName(value) {
  const name = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return name || "Someone";
}

/** Safe in an email From display name. */
export function emailDisplayName(value) {
  const cleaned = String(value ?? "").replace(/[\r\n<>"]/g, "").replace(/\s+/g, " ").trim();
  return cleaned || "ETHER";
}

export function singleLine(value, max = 140) {
  const flat = String(value ?? "").replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
  if (!flat) return "";
  return flat.length > max ? flat.slice(0, max) : flat;
}

export function messagePreview(message) {
  const content = typeof message?.content === "string" ? message.content.replace(/\s+/g, " ").trim() : "";
  if (content) return content.length > 140 ? content.slice(0, 140) : content;
  const media = message?.media_type;
  if (media === "video") return "Sent a video";
  if (media === "image" || media === "photo") return "Sent a photo";
  return "Sent a message";
}

function deny(status, error) {
  return { ok: false, status, error };
}

function snippet(content, max = 80) {
  const flat = singleLine(content, max + 1);
  if (!flat) return "";
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max - 1).trimEnd()}…`;
}

function httpUrl(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return null;
}

/**
 * The caller must be signed in, must have sent the stored message, and must
 * share that conversation with the recipient.
 */
export function authorizeDirectMessage({
  callerId,
  recipientId,
  conversationId,
  messageId,
  message,
  participantIds,
}) {
  if (!callerId) return deny(401, "Unauthorized");
  if (!isUuid(recipientId)) return deny(400, "recipient_id is required");
  const hasConversation = typeof conversationId === "string" && conversationId.length > 0;
  const hasMessage = typeof messageId === "string" && messageId.length > 0;
  if (!hasConversation && !hasMessage) return deny(400, "conversation_id or message_id is required");
  if (hasConversation && !isUuid(conversationId)) return deny(400, "conversation_id is invalid");
  if (hasMessage && !isUuid(messageId)) return deny(400, "message_id is invalid");
  if (recipientId === callerId) return deny(400, "recipient_id must be another participant");
  if (!message) return deny(400, "Message not found");
  if (hasConversation && message.conversation_id !== conversationId) {
    return deny(400, "Message is not in this conversation");
  }
  if (hasMessage && message.id !== messageId) return deny(400, "Message not found");
  if (message.sender_id !== callerId) return deny(403, "Only the sender can notify this conversation");
  const members = new Set(participantIds ?? []);
  if (!members.has(callerId) || !members.has(recipientId)) {
    return deny(403, "Caller and recipient must share this conversation");
  }
  return {
    ok: true,
    conversationId: message.conversation_id,
    messageId: message.id,
    preview: messagePreview(message),
  };
}

/**
 * A signed-in user can push or email only for a relationship this app already
 * stored. Title and body are built here. Service-role callers do not use this.
 */
export function authorizeUserNotification({ callerId, recipientId, notificationType, data, facts }) {
  if (!callerId) return deny(401, "Unauthorized");
  if (!isUuid(recipientId)) return deny(400, "user_id is required");
  if (recipientId === callerId) return deny(400, "Cannot notify yourself");
  const payload = data && typeof data === "object" ? data : {};
  const name = displayName(facts?.callerName);

  if (notificationType === "follow") {
    if (!facts?.followsRecipient) return deny(403, "Forbidden");
    return {
      ok: true,
      title: "New follower",
      body: `${name} added you to favorites`,
      data: { action: "open_profile" },
    };
  }

  if (notificationType === "like") {
    if (isUuid(payload.post_id)) {
      if (!facts?.postLike || facts.postLike.ownerId !== recipientId) return deny(403, "Forbidden");
      const caption = snippet(facts.postLike.content);
      const next = { post_id: payload.post_id };
      if (caption) next.caption = caption;
      if (facts.postLike.mediaUrl) next.media_url = facts.postLike.mediaUrl;
      if (facts.postLike.mediaType) next.media_type = facts.postLike.mediaType;
      return {
        ok: true,
        title: `${name} liked your post`,
        body: caption,
        data: next,
      };
    }
    if (isUuid(payload.story_id)) {
      if (!facts?.storyLike || facts.storyLike.ownerId !== recipientId) return deny(403, "Forbidden");
      return {
        ok: true,
        title: `${name} liked your story`,
        body: "",
        data: { story_id: payload.story_id },
      };
    }
    return deny(400, "post_id or story_id is required");
  }

  if (notificationType === "comment") {
    if (!isUuid(payload.post_id)) return deny(400, "post_id is required");
    if (!facts?.comment || facts.comment.ownerId !== recipientId) return deny(403, "Forbidden");
    return {
      ok: true,
      title: "New Comment",
      body: `${name} commented on your post`,
      data: { post_id: payload.post_id },
    };
  }

  if (notificationType === "live_stream") {
    if (!isUuid(payload.stream_id)) return deny(400, "stream_id is required");
    if (!facts?.stream || facts.stream.hostId !== callerId) return deny(403, "Forbidden");
    if (!facts?.recipientFollowsCaller) return deny(403, "Forbidden");
    return {
      ok: true,
      title: `${name} is Live!`,
      body: `${name} just started streaming`,
      data: { stream_id: payload.stream_id },
    };
  }

  return deny(403, "Forbidden");
}

async function one(supabase, table, filters) {
  let query = supabase.from(table).select("*");
  for (const [column, value] of filters) query = query.eq(column, value);
  const { data } = await query.maybeSingle();
  return data ?? null;
}

export async function noticeForUser(supabase, input) {
  const facts = await loadUserNotificationFacts(supabase, input);
  return authorizeUserNotification({ ...input, facts });
}

export async function loadUserNotificationFacts(supabase, { callerId, recipientId, notificationType, data }) {
  const payload = data && typeof data === "object" ? data : {};
  const profile = await one(supabase, "profiles", [["user_id", callerId]]);
  const facts = { callerName: profile?.display_name ?? null };

  if (notificationType === "follow") {
    const row = await one(supabase, "favorite_friends", [
      ["user_id", callerId],
      ["friend_user_id", recipientId],
    ]);
    facts.followsRecipient = Boolean(row);
  } else if (notificationType === "like" && isUuid(payload.post_id)) {
    const like = await one(supabase, "post_likes", [
      ["user_id", callerId],
      ["post_id", payload.post_id],
    ]);
    const post = like ? await one(supabase, "posts", [["id", payload.post_id]]) : null;
    facts.postLike = like && post
      ? { ownerId: post.user_id, content: post.content, mediaUrl: post.media_url, mediaType: post.media_type }
      : null;
  } else if (notificationType === "like" && isUuid(payload.story_id)) {
    const reaction = await one(supabase, "story_reactions", [
      ["user_id", callerId],
      ["story_id", payload.story_id],
    ]);
    const story = reaction ? await one(supabase, "stories", [["id", payload.story_id]]) : null;
    facts.storyLike = reaction && story ? { ownerId: story.user_id } : null;
  } else if (notificationType === "comment" && isUuid(payload.post_id)) {
    const comment = await one(supabase, "post_comments", [
      ["user_id", callerId],
      ["post_id", payload.post_id],
    ]);
    const post = comment ? await one(supabase, "posts", [["id", payload.post_id]]) : null;
    facts.comment = comment && post ? { ownerId: post.user_id } : null;
  } else if (notificationType === "live_stream" && isUuid(payload.stream_id)) {
    const stream = await one(supabase, "live_streams", [["id", payload.stream_id]]);
    const fan = await one(supabase, "favorite_friends", [
      ["user_id", recipientId],
      ["friend_user_id", callerId],
    ]);
    facts.stream = stream ? { hostId: stream.host_id } : null;
    facts.recipientFollowsCaller = Boolean(fan);
  }

  return facts;
}

export function authorizeNewApplication({ callerId, role, application, project }) {
  if (role !== "service_role" && !callerId) return deny(401, "Unauthorized");
  if (!isUuid(project?.id)) return deny(400, "project_id is required");
  if (!application || application.project_id !== project.id) return deny(403, "Forbidden");
  if (role !== "service_role" && application.applicant_id !== callerId) return deny(403, "Forbidden");
  if (!project.creator_id) return deny(400, "Project not found");
  return {
    ok: true,
    recipientId: project.creator_id,
    projectId: project.id,
    projectTitle: singleLine(project.title) || "a project",
    roleTitle: singleLine(application.role_name) || "a role",
    applicantName: displayName(application.applicant_name),
  };
}

export function authorizeApplicationAccepted({ callerId, role, project, application }) {
  if (role !== "service_role" && !callerId) return deny(401, "Unauthorized");
  if (!isUuid(project?.id)) return deny(400, "project_id is required");
  if (role !== "service_role" && project.creator_id !== callerId) return deny(403, "Forbidden");
  if (!application || application.status !== "accepted" || application.project_id !== project.id) {
    return deny(403, "Forbidden");
  }
  return {
    ok: true,
    applicantId: application.applicant_id,
    projectId: project.id,
    projectTitle: singleLine(project.title) || "a project",
    roleTitle: singleLine(application.role_name) || "a role",
  };
}

export function authorizeGuestApplication({ role, application, project }) {
  if (role !== "anon" && role !== "authenticated" && role !== "service_role") return deny(401, "Unauthorized");
  if (!isUuid(project?.id) || !project.creator_id) return deny(400, "project_id is required");
  if (!application || application.project_id !== project.id || !application.email) return deny(403, "Forbidden");
  return {
    ok: true,
    projectId: project.id,
    creatorId: project.creator_id,
    projectTitle: singleLine(project.title) || "a project",
    roleName: singleLine(application.role_name) || "a role",
    applicantName: singleLine(application.name) || "A guest",
    applicantEmail: String(application.email).trim(),
    portfolioLink: httpUrl(application.portfolio_link),
    message: singleLine(application.message, 500),
  };
}

export function authorizeContentSubmission({ callerId, role, submission, network, submitterName }) {
  if (role !== "service_role" && !callerId) return deny(401, "Unauthorized");
  if (!isUuid(network?.id) || !network.owner_id) return deny(400, "network_id is required");
  if (!submission || submission.network_id !== network.id) return deny(403, "Forbidden");
  if (role !== "service_role" && submission.submitter_id !== callerId) return deny(403, "Forbidden");
  return {
    ok: true,
    ownerId: network.owner_id,
    networkId: network.id,
    networkName: singleLine(network.name) || "a network",
    submissionTitle: singleLine(submission.title) || "Untitled",
    contentType: singleLine(submission.content_type) || "content",
    submitterName: displayName(submitterName),
  };
}

export function authorizeNewContent({ callerId, role, contentType, record, creatorName }) {
  if (role !== "service_role" && !callerId) return deny(401, "Unauthorized");
  if (contentType !== "project" && contentType !== "event") return deny(400, "content_type is invalid");
  if (!record?.id) return deny(400, contentType === "project" ? "Project not found" : "Event not found");
  if (role !== "service_role" && record.creator_id !== callerId) return deny(403, "Forbidden");
  if (contentType === "project" && record.is_private) {
    return { ok: true, skip: true };
  }
  const listingType = contentType === "event" ? "event" : record.listing_type === "gig" ? "gig" : "project";
  return {
    ok: true,
    skip: false,
    contentType,
    contentId: record.id,
    listingType,
    creatorId: record.creator_id,
    title: singleLine(record.title) || (contentType === "event" ? "New event" : "New project"),
    description: singleLine(record.description, 100),
    creatorName: displayName(creatorName),
  };
}

export function authorizeTransactionalEmail({ role }) {
  if (role !== "service_role") return deny(401, "Unauthorized");
  return { ok: true };
}

export function authorizeRsvpConfirmation({ callerId, role, eventId, rsvpId, rsvp, eventCreatorId }) {
  if (!isUuid(eventId) || !isUuid(rsvpId)) return deny(400, "event_id and rsvp_id are required");
  if (!rsvp) return deny(400, "RSVP not found");
  if (rsvp.event_id !== eventId) return deny(400, "RSVP is not for this event");
  if (rsvp.user_id) {
    if (role === "service_role") return { ok: true };
    if (!callerId) return deny(401, "Unauthorized");
    if (callerId !== rsvp.user_id && callerId !== eventCreatorId) return deny(403, "Forbidden");
    return { ok: true };
  }
  if (role !== "anon" && role !== "authenticated" && role !== "service_role") return deny(401, "Unauthorized");
  return { ok: true };
}

export function authorizePartnerAccepted({ callerIsAdmin, application }) {
  if (!callerIsAdmin) return deny(403, "Forbidden");
  if (!application?.id) return deny(400, "applicationId is required");
  if (application.status !== "approved" && application.status !== "accepted") return deny(403, "Forbidden");
  const email = typeof application.contact_email === "string" ? application.contact_email.trim() : "";
  const businessName = singleLine(application.business_name);
  if (!email || !businessName) return deny(400, "Application is missing contact details");
  return { ok: true, email, businessName };
}

/** The invoice recipient and sender come from the stored invoice and the owner's account. */
export function invoiceDelivery({ profileName, accountEmail, storedRecipient }) {
  const destination = typeof storedRecipient === "string" ? storedRecipient.trim() : "";
  if (!destination) return deny(400, "Recipient required");
  const account = typeof accountEmail === "string" && accountEmail.includes("@") ? accountEmail.trim() : null;
  return {
    ok: true,
    destination,
    senderName: emailDisplayName(profileName),
    replyTo: account,
  };
}
