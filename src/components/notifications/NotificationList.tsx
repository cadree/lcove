import React from 'react';
import { motion } from 'framer-motion';
import { Bell, Check, Trash2 } from 'lucide-react';
import { SquircleIcon } from '@/components/world/SquircleIcon';
import { useNotifications, Notification, NotificationType } from '@/hooks/useNotifications';
import { NotificationItem } from './NotificationItem';
import { ProjectAcceptedDialog } from '@/components/projects/ProjectAcceptedDialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { dayDividerLabel } from '@/lib/calendarDay';

const NOTIFICATION_TYPES: { value: string; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'message', label: 'Messages' },
  { value: 'like', label: 'Likes' },
  { value: 'comment', label: 'Comments' },
  { value: 'project_invite', label: 'Invites' },
  { value: 'event_reminder', label: 'Events' },
  { value: 'live_stream', label: 'Live' },
];

export const NotificationList: React.FC = () => {
  const {
    notifications,
    isLoading,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
  } = useNotifications();

  const [activeTab, setActiveTab] = React.useState('all');
  const [acceptedDialog, setAcceptedDialog] = React.useState<{ open: boolean; projectId: string | null; roleTitle: string | null }>({
    open: false,
    projectId: null,
    roleTitle: null,
  });

  const handleProjectInviteTap = (notification: Notification) => {
    const data = notification.data as { project_id?: string | null; role_title?: string | null };
    setAcceptedDialog({
      open: true,
      projectId: data?.project_id || null,
      roleTitle: data?.role_title || null,
    });
  };

  const filteredNotifications = activeTab === 'all'
    ? notifications
    : notifications.filter(n => n.type === activeTab);

  // Group notifications by the viewer's local calendar day.
  const groupedNotifications = React.useMemo(() => {
    const groups: { [key: string]: typeof notifications } = {};
    const now = new Date();

    filteredNotifications.forEach(notification => {
      const key = dayDividerLabel(notification.created_at, { now, older: 'short' });

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(notification);
    });

    return groups;
  }, [filteredNotifications]);

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-start gap-3">
            <Skeleton className="h-10 w-10 rounded-[9px]" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border p-4">
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-primary text-primary-foreground rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllAsRead()}
              className="text-xs"
            >
              <Check className="h-4 w-4 mr-1" />
              Mark all read
            </Button>
          )}
          {notifications.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => clearAll()}
              className="text-xs text-muted-foreground"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-w-0 flex-1 flex-col">
        <div className="w-full min-w-0 overflow-x-auto border-b border-border scrollbar-hide">
          <TabsList className="h-auto w-max justify-start rounded-none border-0 bg-transparent px-4 py-2">
            {NOTIFICATION_TYPES.map(type => (
              <TabsTrigger
                key={type.value}
                value={type.value}
                className="mono-label h-11 shrink-0 rounded-full border border-transparent px-3 text-[11px] data-[state=active]:border-[hsl(var(--scan))] data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-[inset_0_0_12px_rgba(121,195,207,0.35)]"
              >
                {type.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value={activeTab} className="flex-1 overflow-y-auto mt-0">
          {filteredNotifications.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center justify-center py-16 px-6 text-center"
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="mb-6"
              >
                <SquircleIcon icon={Bell} fill="rose" size={52} />
              </motion.div>
              <h3 className="ether-title mb-2 text-xl text-foreground">
                All caught up
              </h3>
              <p className="text-muted-foreground text-sm max-w-xs leading-relaxed">
                When something important happens — a message, collaboration invite, or community update — you'll find it here.
              </p>
            </motion.div>
          ) : (
            <div>
              {Object.entries(groupedNotifications).map(([date, items]) => (
                <div key={date}>
                  <div className="px-1 py-2">
                    <span className="mono-label text-[9px] text-muted-foreground">{date}</span>
                  </div>
                  <div className="space-y-2">
                    {items.map(notification => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        onRead={markAsRead}
                        onDelete={deleteNotification}
                        onProjectInviteTap={handleProjectInviteTap}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ProjectAcceptedDialog
        projectId={acceptedDialog.projectId}
        roleTitle={acceptedDialog.roleTitle}
        open={acceptedDialog.open}
        onOpenChange={(open) => setAcceptedDialog(prev => ({ ...prev, open }))}
      />
    </div>
  );
};
