import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CHAT_EMAIL_WINDOW_MS,
  calendarInclusion,
  canReadProjectConversation,
  canSendProjectConversation,
  canViewProject,
  chatAlertChannels,
  formatRoleCompensation,
  shouldEnqueueChatEmail,
  shouldNotifyCommunity,
} from "./projectCollaborations.ts";
import {
  chatAlertChannels as edgeChatAlertChannels,
  shouldNotifyCommunity as edgeShouldNotifyCommunity,
} from "../../supabase/functions/_shared/project-collaborations.mjs";

describe("project conversation access", () => {
  it("lets the owner read a subgroup they were not added to", () => {
    assert.equal(
      canReadProjectConversation({ isParticipant: false, isProjectOwner: true }),
      true,
    );
  });

  it("lets a member read a chat they belong to", () => {
    assert.equal(
      canReadProjectConversation({ isParticipant: true, isProjectOwner: false }),
      true,
    );
  });

  it("denies a non-member who is not the owner", () => {
    assert.equal(
      canReadProjectConversation({ isParticipant: false, isProjectOwner: false }),
      false,
    );
  });

  it("does not let the owner post in a subgroup they were not added to", () => {
    assert.equal(canSendProjectConversation({ isParticipant: false }), false);
    assert.equal(canSendProjectConversation({ isParticipant: true }), true);
  });
});

describe("project visibility", () => {
  it("hides a private project from discovery", () => {
    assert.equal(
      canViewProject({
        isPrivate: true,
        status: "open",
        isCreator: false,
        isAcceptedMember: false,
        isInvited: false,
      }),
      false,
    );
  });

  it("shows a private project to members and invited people", () => {
    assert.equal(
      canViewProject({
        isPrivate: true,
        status: "open",
        isCreator: false,
        isAcceptedMember: true,
        isInvited: false,
      }),
      true,
    );
    assert.equal(
      canViewProject({
        isPrivate: true,
        status: "draft",
        isCreator: false,
        isAcceptedMember: false,
        isInvited: true,
      }),
      true,
    );
  });

  it("shows an open public project to the community", () => {
    assert.equal(
      canViewProject({
        isPrivate: false,
        status: "open",
        isCreator: false,
        isAcceptedMember: false,
        isInvited: false,
      }),
      true,
    );
    assert.equal(
      canViewProject({
        isPrivate: false,
        status: "draft",
        isCreator: false,
        isAcceptedMember: false,
        isInvited: false,
      }),
      false,
    );
  });
});

describe("community notifications", () => {
  it("notifies unless the person turned the category off", () => {
    assert.equal(
      shouldNotifyCommunity({ isPrivate: false, isCreator: false, categoryEnabled: true }),
      true,
    );
    assert.equal(
      shouldNotifyCommunity({ isPrivate: false, isCreator: false, categoryEnabled: null }),
      true,
    );
  });

  it("skips private posts, the creator, and people who turned notifications off", () => {
    assert.equal(
      shouldNotifyCommunity({ isPrivate: true, isCreator: false, categoryEnabled: true }),
      false,
    );
    assert.equal(
      shouldNotifyCommunity({ isPrivate: false, isCreator: true, categoryEnabled: true }),
      false,
    );
    assert.equal(
      shouldNotifyCommunity({ isPrivate: false, isCreator: false, categoryEnabled: false }),
      false,
    );
  });
});

describe("chat alerts", () => {
  it("sends push and email to a member and skips a muted chat", () => {
    assert.deepEqual(
      chatAlertChannels({
        isSender: false,
        isMuted: false,
        messagesEnabled: true,
        pushEnabled: true,
        emailEnabled: true,
      }),
      { inApp: true, push: true, email: true },
    );
    assert.deepEqual(
      chatAlertChannels({
        isSender: false,
        isMuted: true,
        messagesEnabled: true,
        pushEnabled: true,
        emailEnabled: true,
      }),
      { inApp: true, push: false, email: false },
    );
  });

  it("does not alert the sender or someone who turned messages off", () => {
    assert.deepEqual(
      chatAlertChannels({
        isSender: true,
        isMuted: false,
        messagesEnabled: true,
        pushEnabled: true,
        emailEnabled: true,
      }),
      { inApp: false, push: false, email: false },
    );
    assert.deepEqual(
      chatAlertChannels({
        isSender: false,
        isMuted: false,
        messagesEnabled: false,
        pushEnabled: true,
        emailEnabled: true,
      }),
      { inApp: false, push: false, email: false },
    );
  });

  it("throttles email to one send per window", () => {
    const start = 1_700_000_000_000;
    assert.equal(shouldEnqueueChatEmail({ nowMs: start, lastEnqueuedAtMs: null }), true);
    assert.equal(
      shouldEnqueueChatEmail({ nowMs: start + 60_000, lastEnqueuedAtMs: start }),
      false,
    );
    assert.equal(
      shouldEnqueueChatEmail({
        nowMs: start + CHAT_EMAIL_WINDOW_MS,
        lastEnqueuedAtMs: start,
      }),
      true,
    );
  });
});

describe("edge function rules stay aligned", () => {
  it("matches the app copy for notify and chat alerts", () => {
    const notify = { isPrivate: false, isCreator: false, categoryEnabled: false };
    assert.equal(shouldNotifyCommunity(notify), edgeShouldNotifyCommunity(notify));
    const alert = {
      isSender: false,
      isMuted: true,
      messagesEnabled: true,
      pushEnabled: true,
      emailEnabled: null,
    };
    assert.deepEqual(chatAlertChannels(alert), edgeChatAlertChannels(alert));
  });
});

describe("role compensation and calendar", () => {
  it("formats pay, XP, or both", () => {
    assert.equal(formatRoleCompensation(500, 0), "$500");
    assert.equal(formatRoleCompensation(0, 40), "40 XP");
    assert.equal(formatRoleCompensation(500, 40), "$500 + 40 XP");
    assert.equal(formatRoleCompensation(0, 0), "Open role");
  });

  it("puts a public project on the calendar and hides a private or opted-out one", () => {
    assert.deepEqual(
      calendarInclusion({
        isPrivate: false,
        hideFromCalendar: false,
        status: "open",
        timelineStart: null,
        createdAt: "2026-10-19T12:00:00Z",
      }),
      { visible: true, start: "2026-10-19T12:00:00Z" },
    );
    assert.equal(
      calendarInclusion({
        isPrivate: true,
        hideFromCalendar: false,
        status: "open",
        timelineStart: "2026-11-01",
        createdAt: "2026-10-19T12:00:00Z",
      }).visible,
      false,
    );
    assert.equal(
      calendarInclusion({
        isPrivate: false,
        hideFromCalendar: true,
        status: "open",
        timelineStart: "2026-11-01",
        createdAt: "2026-10-19T12:00:00Z",
      }).visible,
      false,
    );
  });
});
