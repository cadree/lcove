import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { MessageSquare, Heart, MessageCircle, Users, Calendar, Radio, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Notification, NotificationType } from '@/hooks/useNotifications';

interface NotificationItemProps {
  notification: Notification;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
}

const getNotificationIcon = (type: NotificationType) => {
  switch (type) {
    case 'message':
      return <MessageSquare className="h-5 w-5" />;
    case 'like':
      return <Heart className="h-5 w-5 text-pink-500" />;
    case 'comment':
      return <MessageCircle className="h-5 w-5" />;
    case 'project_invite':
      return <Users className="h-5 w-5 text-blue-500" />;
    case 'event_reminder':
      return <Calendar className="h-5 w-5 text-amber-500" />;
    case 'live_stream':
      return <Radio className="h-5 w-5 text-red-500" />;
    default:
      return <MessageSquare className="h-5 w-5" />;
  }
};

const getNotificationColor = (type: NotificationType) => {
  switch (type) {
    case 'message':
      return 'bg-primary/10';
    case 'like':
      return 'bg-pink-500/10';
    case 'comment':
      return 'bg-secondary/50';
    case 'project_invite':
      return 'bg-blue-500/10';
    case 'event_reminder':
      return 'bg-amber-500/10';
    case 'live_stream':
      return 'bg-red-500/10';
    default:
      return 'bg-muted';
  }
};

export const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onRead,
  onDelete,
}) => {
  const isUnread = !notification.read_at;

  const handleClick = () => {
    if (isUnread) {
      onRead(notification.id);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        "flex items-start gap-3 p-4 cursor-pointer transition-colors relative group",
        isUnread ? "bg-primary/5" : "bg-transparent",
        "hover:bg-muted/50"
      )}
    >
      {/* Unread indicator */}
      {isUnread && (
        <div className="absolute left-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary" />
      )}

      {/* Icon */}
      <div className={cn(
        "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center",
        getNotificationColor(notification.type as NotificationType)
      )}>
        {getNotificationIcon(notification.type as NotificationType)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-sm",
          isUnread ? "font-medium text-foreground" : "text-muted-foreground"
        )}>
          {notification.title}
        </p>
        {notification.body && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {notification.body}
          </p>
        )}
        <p className="text-xs text-muted-foreground/70 mt-1">
          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
        </p>
      </div>

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
