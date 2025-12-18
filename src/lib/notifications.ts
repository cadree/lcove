import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

type NotificationType = 'message' | 'like' | 'comment' | 'project_invite' | 'event_reminder' | 'live_stream';

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
    // Insert notification into database
    const { data: notification, error } = await supabase
      .from('notifications')
      .insert([{
        user_id: userId,
        type,
        title,
        body,
        data: data as Json,
      }])
      .select()
      .single();

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

    return notification;
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

export const notifyPostLike = (userId: string, likerName: string, postId: string) => {
  return createNotification({
    userId,
    type: 'like',
    title: 'Someone liked your post',
    body: `${likerName} liked your post`,
    data: { post_id: postId },
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
