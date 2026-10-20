import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { MessageSquare, Heart, MessageCircle, Users, Calendar, Radio, X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Notification, NotificationType } from '@/hooks/useNotifications';
import { SquircleIcon, type IconFill } from '@/components/world/SquircleIcon';
import { notificationDisplay, type PostLikePreview } from '@/lib/likeNotice';

interface NotificationItemProps {
  notification: Notification;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
  onProjectInviteTap?: (notification: Notification) => void;
  onActivate?: (notification: Notification) => void;
  preview?: PostLikePreview | null;
}

const notificationMark: Record<NotificationType, { icon: LucideIcon; fill: IconFill }> = {
  message: { icon: MessageSquare, fill: 'violet' },
  like: { icon: Heart, fill: 'pink' },
  comment: { icon: MessageCircle, fill: 'bone' },
  project_invite: { icon: Users, fill: 'cyan' },
  project_client_invite: { icon: Users, fill: 'denim' },
  event_reminder: { icon: Calendar, fill: 'gold' },
  live_stream: { icon: Radio, fill: 'red' },
};

export const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onRead,
  onDelete,
  onProjectInviteTap,
  onActivate,
  preview,
}) => {
  const isUnread = !notification.read_at;
  const display = notificationDisplay(notification, preview);

  const handleClick = () => {
    if (isUnread) {
      onRead(notification.id);
    }
    if (notification.type === 'project_invite' && onProjectInviteTap) {
      onProjectInviteTap(notification);
      return;
    }
    onActivate?.(notification);
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        "file-panel relative mb-2 flex cursor-pointer items-start gap-3 p-4 transition-colors group",
        isUnread ? "border-[hsl(var(--scan))]" : "",
      )}
    >
      {/* Unread indicator */}
      {isUnread && (
        <div className="absolute left-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary" />
      )}

      {/* Icon */}
      <SquircleIcon
        icon={notificationMark[notification.type]?.icon ?? MessageSquare}
        fill={notificationMark[notification.type]?.fill ?? 'bone'}
        size={40}
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          "font-body text-sm",
          isUnread ? "font-bold text-foreground" : "text-muted-foreground"
        )}>
          {display.title}
        </p>
        {display.detail && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {display.detail}
          </p>
        )}
        <p className="mono-label mt-1 text-[9px] text-muted-foreground">
          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
        </p>
      </div>

      {display.thumbUrl && (
        display.thumbIsVideo ? (
          <video
            src={display.thumbUrl}
            muted
            playsInline
            preload="metadata"
            aria-hidden
            className="h-11 w-11 shrink-0 rounded-[2px] object-cover"
          />
        ) : (
          <img
            src={display.thumbUrl}
            alt=""
            className="h-11 w-11 shrink-0 rounded-[2px] object-cover"
          />
        )
      )}

      {/* Delete button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(notification.id);
        }}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded"
      >
        <X className="h-4 w-4 text-muted-foreground" />
      </button>
    </div>
  );
};
