import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { 
  Users, 
  Mail, 
  MessageSquare,
  Search,
  Ticket,
  Clock,
  Check,
  X,
  Download,
  Loader2,
  User
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface EventAttendeesDialogProps {
  eventId: string;
  eventTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Attendee {
  id: string;
  user_id: string;
  status: string;
  ticket_purchased: boolean;
  created_at: string;
  profile: {
    display_name: string | null;
    avatar_url: string | null;
    email?: string;
  } | null;
}

export function EventAttendeesDialog({ 
  eventId, 
  eventTitle,
  open, 
  onOpenChange 
}: EventAttendeesDialogProps) {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'going' | 'interested' | 'ticketed'>('all');

  const { data: attendees, isLoading } = useQuery({
    queryKey: ['event-attendees', eventId],
    queryFn: async () => {
      const { data: rsvps, error } = await supabase
        .from('event_rsvps')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch profiles for each attendee
      const attendeesWithProfiles: Attendee[] = await Promise.all(
        (rsvps || []).map(async (rsvp) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name, avatar_url')
            .eq('user_id', rsvp.user_id)
            .maybeSingle();

          return {
            ...rsvp,
            profile,
          };
        })
      );

      return attendeesWithProfiles;
    },
    enabled: open && !!eventId,
  });

  const filteredAttendees = attendees?.filter(attendee => {
    const matchesSearch = !searchTerm || 
      attendee.profile?.display_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (filter === 'all') return matchesSearch;
    if (filter === 'going') return matchesSearch && attendee.status === 'going';
    if (filter === 'interested') return matchesSearch && attendee.status === 'interested';
    if (filter === 'ticketed') return matchesSearch && attendee.ticket_purchased;
    
    return matchesSearch;
  });

  const stats = {
    total: attendees?.length || 0,
    going: attendees?.filter(a => a.status === 'going').length || 0,
    interested: attendees?.filter(a => a.status === 'interested').length || 0,
    ticketed: attendees?.filter(a => a.ticket_purchased).length || 0,
  };

  const handleMessageAttendee = (userId: string) => {
    onOpenChange(false);
    navigate(`/messages?new=${userId}`);
  };

  const handleExportList = () => {
    if (!attendees || attendees.length === 0) {
      toast.error('No attendees to export');
      return;
    }

    const csv = [
      'Name,Status,Ticket Purchased,RSVP Date',
      ...attendees.map(a => 
        `"${a.profile?.display_name || 'Unknown'}",${a.status},${a.ticket_purchased ? 'Yes' : 'No'},${format(new Date(a.created_at), 'yyyy-MM-dd HH:mm')}`
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${eventTitle.replace(/\s+/g, '-')}-attendees.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success('Attendee list exported');
  };

  const getStatusBadge = (status: string, ticketPurchased: boolean) => {
    if (ticketPurchased) {
      return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Ticketed</Badge>;
    }
    switch (status) {
      case 'going':
        return <Badge className="bg-primary/20 text-primary border-primary/30">Going</Badge>;
      case 'interested':
        return <Badge className="bg-accent/50 text-accent-foreground border-accent/30">Interested</Badge>;
      case 'not_going':
        return <Badge variant="secondary">Can't Go</Badge>;
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong border-border/30 max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Event Attendees
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">{eventTitle}</p>
        </DialogHeader>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 py-3">
          <div 
            className={cn(
              "text-center p-2 rounded-lg cursor-pointer transition-colors",
              filter === 'all' ? "bg-primary/20" : "bg-muted/30 hover:bg-muted/50"
            )}
            onClick={() => setFilter('all')}
          >
            <p className="text-lg font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
          <div 
            className={cn(
              "text-center p-2 rounded-lg cursor-pointer transition-colors",
              filter === 'going' ? "bg-primary/20" : "bg-muted/30 hover:bg-muted/50"
            )}
            onClick={() => setFilter('going')}
          >
            <p className="text-lg font-bold text-primary">{stats.going}</p>
            <p className="text-xs text-muted-foreground">Going</p>
          </div>
          <div 
            className={cn(
              "text-center p-2 rounded-lg cursor-pointer transition-colors",
              filter === 'interested' ? "bg-primary/20" : "bg-muted/30 hover:bg-muted/50"
            )}
            onClick={() => setFilter('interested')}
          >
            <p className="text-lg font-bold">{stats.interested}</p>
            <p className="text-xs text-muted-foreground">Interested</p>
          </div>
          <div 
            className={cn(
              "text-center p-2 rounded-lg cursor-pointer transition-colors",
              filter === 'ticketed' ? "bg-primary/20" : "bg-muted/30 hover:bg-muted/50"
            )}
            onClick={() => setFilter('ticketed')}
          >
            <p className="text-lg font-bold text-green-400">{stats.ticketed}</p>
            <p className="text-xs text-muted-foreground">Ticketed</p>
          </div>
        </div>

        {/* Search & Export */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search attendees..."
              className="glass pl-9"
            />
          </div>
          <Button variant="outline" size="icon" onClick={handleExportList} title="Export list">
            <Download className="h-4 w-4" />
          </Button>
        </div>

        {/* Attendees List */}
        <div className="flex-1 overflow-y-auto min-h-0 -mx-6 px-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredAttendees && filteredAttendees.length > 0 ? (
            <div className="space-y-2 py-2">
              {filteredAttendees.map((attendee) => (
                <div
                  key={attendee.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-muted/20 hover:bg-muted/30 transition-colors"
                >
                  <Avatar 
                    className="h-10 w-10 cursor-pointer"
                    onClick={() => {
                      onOpenChange(false);
                      navigate(`/profile/${attendee.user_id}`);
                    }}
                  >
                    <AvatarImage src={attendee.profile?.avatar_url || ''} />
                    <AvatarFallback className="bg-primary/20">
                      <User className="h-5 w-5 text-primary" />
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <p 
                      className="font-medium text-foreground truncate cursor-pointer hover:underline"
                      onClick={() => {
                        onOpenChange(false);
                        navigate(`/profile/${attendee.user_id}`);
                      }}
                    >
                      {attendee.profile?.display_name || 'Unknown User'}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {format(new Date(attendee.created_at), 'MMM d, h:mm a')}
                    </div>
                  </div>

                  {getStatusBadge(attendee.status, attendee.ticket_purchased || false)}

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleMessageAttendee(attendee.user_id)}
                    title="Message"
                  >
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Users className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">
                {searchTerm ? 'No matching attendees' : 'No attendees yet'}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}