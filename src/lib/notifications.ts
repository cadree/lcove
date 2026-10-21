import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { postLikeFields } from './likeNotice';

type NotificationType = 'message' | 'like' | 'comment' | 'follow' | 'project_invite' | 'event_reminder' | 'live_stream';

const PREFERENCE_COLUMN: Partial<Record<NotificationType, string>> = {
  message: 'messages_enabled',
  like: 'likes_enabled',
  comment: 'comments_enabled',
  follow: 'follows_enabled',
  project_invite: 'project_invites_enabled',
  event_reminder: 'event_reminders_enabled',
  live_stream: 'live_streams_enabled',
};

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  data?: Record<string, string | number | boolean>;
}

/**
 * Creates a notification and optionally sends email
 * This function should be called whenever you want to notify a user
 */
export const createNotification = async ({
  userId,
  type,
  title,
  body,
  data = {},
}: CreateNotificationParams) => {
  try {
    const prefColumn = PREFERENCE_COLUMN[type];
    if (prefColumn) {
      const { data: prefs } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (prefs && prefs[prefColumn as keyof typeof prefs] === false) {
        return null;
      }
    }

    // Do not .select() this row. The recipient is the only one who can read it.
    // INSERT ... RETURNING is what .select() sends, and Postgres then rejects
    // the whole statement because the sender fails the SELECT policy. The
    // insert rolls back, so the owner sees no row and the error is easy to miss.
    const { error } = await supabase
      .from('notifications')
      .insert([{
        user_id: userId,
        type,
        title,
        body,
        data: data as Json,
      }]);

    if (error) {
      console.error('Error creating notification:', error);
      throw error;
    }

    // Trigger email notification via edge function
    // This runs in the background and won't block the main flow
    supabase.functions.invoke('send-notification-email', {
      body: {
        user_id: userId,
        notification_type: type,
        title,
        body: body || '',
        data,
      },
    }).catch((err) => {
      console.error('Error sending notification email:', err);
    });

    // Trigger push notification via edge function
    supabase.functions.invoke('send-push-notification', {
      body: {
        user_id: userId,
        title,
        body: body || '',
        data,
        notification_type: type,
      },
    }).catch((err) => {
      console.error('Error sending push notification:', err);
    });

    return null;
  } catch (error) {
    console.error('Error in createNotification:', error);
    throw error;
  }
};

// Helper functions for specific notification types
export const notifyNewMessage = (userId: string, senderName: string) => {
  return createNotification({
    userId,
    type: 'message',
    title: 'New Message',
    body: `${senderName} sent you a message`,
    data: { action: 'open_messages' },
  });
};

export const notifyFollow = (userId: string, followerName: string) => {
  return createNotification({
    userId,
    type: 'follow',
    title: 'New follower',
    body: `${followerName} added you to favorites`,
    data: { action: 'open_profile' },
  });
};

export const notifyStoryLike = (userId: string, likerName: string, storyId: string) => {
  return createNotification({
    userId,
    type: 'like',
    title: `${likerName} liked your story`,
    data: { story_id: storyId },
  });
};

export const notifyPostLike = (
  userId: string,
  likerName: string,
  postId: string,
  preview?: { caption?: string | null; mediaUrl?: string | null; mediaType?: string | null },
) => {
  const fields = postLikeFields(preview);
  return createNotification({
    userId,
    type: 'like',
    title: `${likerName} liked your post`,
    body: fields.body,
    data: { post_id: postId, ...fields.data },
  });
};

export const notifyPostComment = (userId: string, commenterName: string, postId: string) => {
  return createNotification({
    userId,
    type: 'comment',
    title: 'New Comment',
    body: `${commenterName} commented on your post`,
    data: { post_id: postId },
  });
};

export const notifyProjectInvite = (userId: string, projectTitle: string, projectId: string) => {
  return createNotification({
    userId,
    type: 'project_invite',
    title: 'Project Invitation',
    body: `You've been invited to join "${projectTitle}"`,
    data: { project_id: projectId },
  });
};

export const notifyEventReminder = (userId: string, eventTitle: string, eventId: string, startsIn: string) => {
  return createNotification({
    userId,
    type: 'event_reminder',
    title: 'Event Reminder',
    body: `"${eventTitle}" starts ${startsIn}`,
    data: { event_id: eventId },
  });
};

export const notifyLiveStream = (userId: string, streamerName: string, streamId: string) => {
  return createNotification({
    userId,
    type: 'live_stream',
    title: `${streamerName} is Live!`,
    body: `${streamerName} just started streaming`,
    data: { stream_id: streamId },
  });
};

export const notifyNetworkPremiere = (userId: string, networkName: string, contentTitle: string, networkId: string) => {
  return createNotification({
    userId,
    type: 'live_stream',
    title: `New on ${networkName}`,
    body: `"${contentTitle}" is now streaming`,
    data: { network_id: networkId },
  });
};
