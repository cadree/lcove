import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useNotificationPreferences } from '@/hooks/useNotifications';
import { AddToCalendarButtons } from '@/components/calendar/AddToCalendarButtons';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { PartyPopper, MessageSquare, Calendar, Bell } from 'lucide-react';
import { toast } from 'sonner';

interface ProjectAcceptedDialogProps {
  projectId: string | null;
  roleTitle: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ProjectAcceptedDialog: React.FC<ProjectAcceptedDialogProps> = ({
  projectId,
  roleTitle,
  open,
  onOpenChange,
}) => {
  const navigate = useNavigate();
  const { preferences, updatePreferences } = useNotificationPreferences();

  const { data: project, isLoading } = useQuery({
    queryKey: ['project-accepted-detail', projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const { data, error } = await supabase
        .from('projects')
        .select('id, title, description, timeline_start, timeline_end, venue')
        .eq('id', projectId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId && open,
  });

  // Find the project's group chat
  const { data: conversation } = useQuery({
    queryKey: ['project-chat-id', projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const { data } = await (supabase
        .from('conversations')
        .select('id') as any)
        .eq('project_id', projectId)
        .eq('type', 'group')
        .maybeSingle();
      return data;
    },
    enabled: !!projectId && open,
  });

  const handleOpenChat = () => {
    if (conversation?.id) {
      onOpenChange(false);
      navigate(`/messages?conversation=${conversation.id}`);
    } else {
      toast.info('Project chat not found');
    }
  };

  const handleToggleReminders = (enabled: boolean) => {
    updatePreferences({
      email_enabled: enabled,
      event_reminders_enabled: enabled,
      application_updates_enabled: enabled,
    });
    toast.success(enabled ? 'Reminders turned on' : 'Reminders turned off');
  };

  const hasTimeline = project?.timeline_start;

  const calendarEvent = hasTimeline ? {
    title: project.title,
    description: project.description || `Project: ${project.title}`,
    startDate: new Date(project.timeline_start!),
    endDate: project.timeline_end ? new Date(project.timeline_end) : null,
    location: project.venue,
  } : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PartyPopper className="h-5 w-5 text-primary" />
            You're In!
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3 py-4">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <div className="space-y-5 py-2">
            {/* Congrats message */}
            <div className="text-center space-y-1">
              <p className="text-sm text-muted-foreground">
                You've been accepted as{' '}
                <span className="font-semibold text-primary">{roleTitle || 'a team member'}</span>
                {project?.title && (
                  <> for <span className="font-semibold text-foreground">{project.title}</span></>
                )}
              </p>
            </div>

            <Separator />

            {/* Calendar section */}
            {calendarEvent && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Add to Calendar</span>
                </div>
                <AddToCalendarButtons event={calendarEvent} variant="full" />
              </div>
            )}

            {/* Reminders toggle */}
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="reminders" className="text-sm cursor-pointer">
                  Email reminders for deadlines
                </Label>
              </div>
              <Switch
                id="reminders"
                checked={preferences?.email_enabled && preferences?.event_reminders_enabled}
                onCheckedChange={handleToggleReminders}
              />
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <Button onClick={handleOpenChat} className="w-full">
                <MessageSquare className="h-4 w-4 mr-2" />
                Open Project Chat
              </Button>
              <Button variant="ghost" onClick={() => onOpenChange(false)} className="w-full text-muted-foreground">
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
