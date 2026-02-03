import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { 
  Calendar, 
  Copy, 
  RefreshCw, 
  ExternalLink, 
  Loader2,
  Check,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface CalendarFeed {
  id: string;
  user_id: string;
  token: string;
  created_at: string;
  last_accessed_at: string | null;
  is_active: boolean;
}

export function CalendarFeedSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  const { data: feed, isLoading } = useQuery({
    queryKey: ['calendar-feed', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('host_calendar_feeds')
        .select('*')
        .eq('user_id', user!.id)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      return data as CalendarFeed | null;
    },
    enabled: !!user,
  });

  const createFeedMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('host_calendar_feeds')
        .insert({ user_id: user!.id })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-feed'] });
      toast.success('Calendar feed created!');
    },
    onError: (error) => {
      console.error('Error creating feed:', error);
      toast.error('Failed to create calendar feed');
    },
  });

  const regenerateFeedMutation = useMutation({
    mutationFn: async () => {
      // Deactivate old token
      if (feed) {
        await supabase
          .from('host_calendar_feeds')
          .update({ is_active: false })
          .eq('id', feed.id);
      }

      // Create new token
      const { data, error } = await supabase
        .from('host_calendar_feeds')
        .insert({ user_id: user!.id })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-feed'] });
      toast.success('New feed URL generated!');
    },
    onError: (error) => {
      console.error('Error regenerating feed:', error);
      toast.error('Failed to regenerate feed');
    },
  });

  const getFeedUrl = () => {
    if (!feed) return '';
    const baseUrl = import.meta.env.VITE_SUPABASE_URL || '';
    return `${baseUrl}/functions/v1/host-calendar-feed?token=${feed.token}`;
  };

  const handleCopy = async () => {
    const url = getFeedUrl();
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Feed URL copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const getCalendarSubscribeUrl = (type: 'google' | 'apple') => {
    const feedUrl = getFeedUrl();
    if (type === 'google') {
      // Google Calendar uses webcal:// or https:// directly in subscription
      return `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(feedUrl)}`;
    }
    // Apple Calendar uses webcal:// protocol
    return feedUrl.replace('https://', 'webcal://');
  };

  if (!user) return null;

  return (
    <Card className="glass-strong border-border/30">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Calendar Feed</CardTitle>
        </div>
        <CardDescription>
          Subscribe to your hosted events in Apple Calendar, Google Calendar, or any calendar app.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : feed ? (
          <>
            {/* Feed URL */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Private Feed URL</label>
              <div className="flex gap-2">
                <Input
                  value={getFeedUrl()}
                  readOnly
                  className="font-mono text-xs bg-muted/50"
                />
                <Button variant="outline" size="icon" onClick={handleCopy}>
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Keep this URL private. Anyone with it can see your event schedule.
              </p>
            </div>

            {/* Quick Subscribe Buttons */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Quick Subscribe</label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(getCalendarSubscribeUrl('google'), '_blank')}
                  className="gap-2"
                >
                  <GoogleCalendarIcon className="h-4 w-4" />
                  Google Calendar
                  <ExternalLink className="h-3 w-3" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.location.href = getCalendarSubscribeUrl('apple')}
                  className="gap-2"
                >
                  <AppleIcon className="h-4 w-4" />
                  Apple Calendar
                </Button>
              </div>
            </div>

            {/* Last accessed info */}
            {feed.last_accessed_at && (
              <p className="text-xs text-muted-foreground">
                Last synced: {new Date(feed.last_accessed_at).toLocaleString()}
              </p>
            )}

            {/* Regenerate */}
            <div className="pt-2 border-t border-border/30">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-muted-foreground hover:text-foreground gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Regenerate URL
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Regenerate Feed URL?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will create a new private URL and invalidate the old one. 
                      You'll need to re-subscribe in your calendar apps.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={() => regenerateFeedMutation.mutate()}
                      disabled={regenerateFeedMutation.isPending}
                    >
                      {regenerateFeedMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      Regenerate
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </>
        ) : (
          <div className="text-center py-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Create a private calendar feed to sync your hosted events with your calendar app.
            </p>
            <Button
              onClick={() => createFeedMutation.mutate()}
              disabled={createFeedMutation.isPending}
              className="gap-2"
            >
              {createFeedMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Calendar className="h-4 w-4" />
              )}
              Create Calendar Feed
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function GoogleCalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
    </svg>
  );
}

export default CalendarFeedSettings;
