import React from 'react';
import { MessageSquare, Heart, MessageCircle, Users, Calendar, Radio, Bell, Mail, Smartphone, FolderKanban, CalendarPlus, CheckCircle } from 'lucide-react';
import { useNotificationPreferences } from '@/hooks/useNotifications';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';

interface PreferenceItemProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}

const PreferenceItem: React.FC<PreferenceItemProps> = ({
  icon,
  label,
  description,
  checked,
  onCheckedChange,
  disabled = false,
}) => (
  <div className="flex items-center justify-between py-3">
    <div className="flex items-center gap-3">
      <div className="flex-shrink-0 w-9 h-9 rounded-full bg-muted flex items-center justify-center">
        {icon}
      </div>
      <div>
        <Label className="text-sm font-medium">{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
    <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
  </div>
);

export const NotificationPreferences: React.FC = () => {
  const { preferences, isLoading, updatePreferences } = useNotificationPreferences();
  const { isSupported, permission, requestPermission } = usePushNotifications();

  const handlePushToggle = async (checked: boolean) => {
    if (checked && permission !== 'granted') {
      const granted = await requestPermission();
      if (granted) {
        updatePreferences({ push_enabled: true });
      }
    } else {
      updatePreferences({ push_enabled: checked });
    }
  };

  if (isLoading || !preferences) {
    return (
      <div className="p-4 space-y-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
            <Skeleton className="h-6 w-10 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  const pushDescription = !isSupported 
    ? 'Not supported in this browser'
    : permission === 'denied'
    ? 'Permission denied - enable in browser settings'
    : 'Receive notifications on your device';

  return (
    <div className="p-4 pb-24 sm:pb-8">
      <h3 className="text-lg font-semibold mb-1">Notification Preferences</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Choose what you want to be notified about
      </p>

      <div className="space-y-1">
        <PreferenceItem
          icon={<MessageSquare className="h-4 w-4" />}
          label="Messages"
          description="New direct messages and group chats"
          checked={preferences.messages_enabled ?? true}
          onCheckedChange={(checked) => updatePreferences({ messages_enabled: checked })}
        />

        <PreferenceItem
          icon={<Heart className="h-4 w-4 text-pink-500" />}
          label="Likes"
          description="When someone likes your posts"
          checked={preferences.likes_enabled ?? true}
          onCheckedChange={(checked) => updatePreferences({ likes_enabled: checked })}
        />

        <PreferenceItem
          icon={<MessageCircle className="h-4 w-4" />}
          label="Comments"
          description="New comments on your posts"
          checked={preferences.comments_enabled ?? true}
          onCheckedChange={(checked) => updatePreferences({ comments_enabled: checked })}
        />

        <PreferenceItem
          icon={<Users className="h-4 w-4 text-blue-500" />}
          label="Project Invites"
          description="Invitations to collaborate on projects"
          checked={preferences.project_invites_enabled ?? true}
          onCheckedChange={(checked) => updatePreferences({ project_invites_enabled: checked })}
        />

        <PreferenceItem
          icon={<Calendar className="h-4 w-4 text-amber-500" />}
          label="Event Reminders"
          description="Upcoming events you're attending"
          checked={preferences.event_reminders_enabled ?? true}
          onCheckedChange={(checked) => updatePreferences({ event_reminders_enabled: checked })}
        />

        <PreferenceItem
          icon={<Radio className="h-4 w-4 text-red-500" />}
          label="Live Streams"
          description="When someone you follow goes live"
          checked={preferences.live_streams_enabled ?? true}
          onCheckedChange={(checked) => updatePreferences({ live_streams_enabled: checked })}
        />

        <PreferenceItem
          icon={<CheckCircle className="h-4 w-4 text-green-500" />}
          label="Application Updates"
          description="When your project applications are accepted"
          checked={preferences.application_updates_enabled ?? true}
          onCheckedChange={(checked) => updatePreferences({ application_updates_enabled: checked })}
        />
      </div>

      <Separator className="my-6" />

      <h4 className="text-sm font-semibold mb-3">Community Updates</h4>
      <p className="text-xs text-muted-foreground mb-3">
        Get notified when new content is posted
      </p>
      <div className="space-y-1 pb-4">
        <PreferenceItem
          icon={<FolderKanban className="h-4 w-4 text-green-500" />}
          label="New Projects"
          description="When new collaboration projects are posted"
          checked={preferences.new_projects_enabled ?? false}
          onCheckedChange={(checked) => updatePreferences({ new_projects_enabled: checked })}
        />

        <PreferenceItem
          icon={<CalendarPlus className="h-4 w-4 text-amber-500" />}
          label="New Events"
          description="When new community events are posted"
          checked={preferences.new_events_enabled ?? false}
          onCheckedChange={(checked) => updatePreferences({ new_events_enabled: checked })}
        />
      </div>

      <Separator className="my-6" />

      <h4 className="text-sm font-semibold mb-3">Delivery Methods</h4>
      <div className="space-y-1 pb-4">
        <PreferenceItem
          icon={<Bell className="h-4 w-4" />}
          label="Push Notifications"
          description={pushDescription}
          checked={(preferences.push_enabled ?? false) && permission === 'granted'}
          onCheckedChange={handlePushToggle}
          disabled={!isSupported || permission === 'denied'}
        />

        <PreferenceItem
          icon={<Mail className="h-4 w-4" />}
          label="Email Notifications"
          description="Get important updates via email"
          checked={preferences.email_enabled ?? false}
          onCheckedChange={(checked) => updatePreferences({ email_enabled: checked })}
        />

        <PreferenceItem
          icon={<Smartphone className="h-4 w-4" />}
          label="SMS Notifications"
          description="Get text messages for new DMs"
          checked={preferences.sms_enabled ?? false}
          onCheckedChange={(checked) => updatePreferences({ sms_enabled: checked })}
        />
      </div>
    </div>
  );
};
