import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { format } from "date-fns";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Users,
  Ticket,
  DollarSign,
  Megaphone,
  UserCog,
  Share2,
  MoreHorizontal,
  Edit,
  Trash2,
  ExternalLink,
  Copy,
  Mail,
  Search,
  Download,
  Clock,
  CheckCircle2,
  XCircle,
  CreditCard,
  TrendingUp,
  BarChart3,
  Send,
  Loader2,
  QrCode,
  ScanLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { AttendeeProfileDrawer } from "@/components/events/AttendeeProfileDrawer";
import type { AttendeeKey } from "@/hooks/useAttendeeCrmProfile";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import BottomNav from "@/components/navigation/BottomNav";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { shareLink, buildShareUrl } from "@/lib/shareLink";
import { useEventTicketingData, type TicketOrder, type EventAttendee } from "@/hooks/useEventTicketingData";
import { useEventCheckIns } from "@/hooks/useEventCheckIn";
import { CheckInScanner } from "@/components/events/CheckInScanner";
import { Progress } from "@/components/ui/progress";
import { AutoReminderSettings } from "@/components/events/AutoReminderSettings";
import { CampaignAnalyticsCard } from "@/components/events/CampaignAnalyticsCard";
import { BulkReminderDialog } from "@/components/events/BulkReminderDialog";
import { InviteAudienceDialog } from "@/components/events/InviteAudienceDialog";

// Event status helper
function getEventStatus(event: { start_date: string; end_date: string | null; status: string | null }) {
  const now = new Date();
  const start = new Date(event.start_date);
  const end = event.end_date ? new Date(event.end_date) : start;

  if (event.status === 'cancelled') return { label: 'Cancelled', variant: 'cancelled' as const };
  if (event.status === 'draft') return { label: 'Draft', variant: 'draft' as const };
  if (now > end) return { label: 'Ended', variant: 'ended' as const };
  if (now >= start && now <= end) return { label: 'Live', variant: 'live' as const };
  return { label: 'Upcoming', variant: 'upcoming' as const };
}

const statusStyles = {
  draft: 'bg-amber-500/20 text-amber-600 border-amber-500/30',
  live: 'bg-emerald-500/20 text-emerald-600 border-emerald-500/30',
  upcoming: 'bg-primary/20 text-primary border-primary/30',
  ended: 'bg-muted text-muted-foreground border-border',
  cancelled: 'bg-destructive/20 text-destructive border-destructive/30',
};

export default function EventDetail() {
  const navigate = useNavigate();
  const { eventId } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("orders");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedAttendee, setSelectedAttendee] = useState<{ key: AttendeeKey; name: string | null } | null>(null);

  // Fetch event
  const { data: event, isLoading: eventLoading } = useQuery({
    queryKey: ["event-detail", eventId],
    queryFn: async () => {
      if (!eventId) throw new Error("No event ID");
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("id", eventId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!eventId,
  });

  // Fetch RSVPs (includes orders/attendees)
  const { data: rsvps, isLoading: rsvpsLoading } = useQuery({
    queryKey: ["event-rsvps", eventId],
    queryFn: async () => {
      if (!eventId) return [];
      const { data, error } = await supabase
        .from("event_rsvps")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!eventId,
  });

  // Fetch attendee profiles
  const { data: attendeeProfiles } = useQuery({
    queryKey: ["event-attendee-profiles", rsvps?.map(r => r.user_id)],
    queryFn: async () => {
      if (!rsvps || rsvps.length === 0) return {};
      const userIds = [...new Set(rsvps.map(r => r.user_id).filter(Boolean))];
      if (userIds.length === 0) return {};
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", userIds);
      if (error) throw error;
      return Object.fromEntries((data || []).map(p => [p.user_id, p]));
    },
    enabled: !!rsvps && rsvps.length > 0,
  });

  // Fetch organization team if event has organization_id
  const { data: teamMembers } = useQuery({
    queryKey: ["event-team", event?.organization_id],
    queryFn: async () => {
      if (!event?.organization_id) return [];
      const { data, error } = await supabase
        .from("organization_members")
        .select("user_id, role, created_at")
        .eq("organization_id", event.organization_id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!event?.organization_id,
  });

  // Fetch team member profiles
  const { data: teamProfiles } = useQuery({
    queryKey: ["team-profiles", teamMembers?.map(m => m.user_id)],
    queryFn: async () => {
      if (!teamMembers || teamMembers.length === 0) return {};
      const userIds = teamMembers.map(m => m.user_id);
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", userIds);
      if (error) throw error;
      return Object.fromEntries((data || []).map(p => [p.user_id, p]));
    },
    enabled: !!teamMembers && teamMembers.length > 0,
  });

  // NEW: Phase-3 ticketing data (orders, attendees, tiers) and check-ins
  const { orders: v2Orders, attendees: v2Attendees, tiers: v2Tiers, isLoading: v2Loading } = useEventTicketingData(eventId);
  const { data: v2CheckIns = [] } = useEventCheckIns(eventId);

  // Build profile map for v2 attendees (registered users)
  const { data: v2AttendeeProfiles } = useQuery({
    queryKey: ["v2-attendee-profiles", v2Attendees.map(a => a.attendee_user_id).filter(Boolean)],
    queryFn: async () => {
      const ids = [...new Set(v2Attendees.map(a => a.attendee_user_id).filter((x): x is string => !!x))];
      if (ids.length === 0) return {};
      const { data } = await supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", ids);
      return Object.fromEntries((data || []).map(p => [p.user_id, p]));
    },
    enabled: v2Attendees.length > 0,
  });

  const handleShare = async () => {
    if (!eventId) return;
    await shareLink({
      title: event?.title,
      text: `Check out this event: ${event?.title}`,
      url: buildShareUrl.event(eventId),
    });
  };

  const handleCopyLink = async () => {
    if (!eventId) return;
    await shareLink({ url: buildShareUrl.event(eventId) });
  };

  const handleDelete = async () => {
    if (!eventId) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.from("events").delete().eq("id", eventId);
      if (error) throw error;
      toast.success("Event deleted");
      queryClient.invalidateQueries({ queryKey: ["dashboard-events"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
      navigate("/dashboard/events");
    } catch (error) {
      toast.error("Failed to delete event");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  if (!user) {
    navigate("/auth");
    return null;
  }

  const isLoading = eventLoading;
  const status = event ? getEventStatus(event) : null;

  // Calculate stats
  const orders = rsvps?.filter(r => r.ticket_purchased) || [];
  const attendees = rsvps || [];
  const totalRevenue = orders.reduce((sum, r) => {
    if (r.stripe_payment_id) {
      return sum + (event?.ticket_price || 0);
    }
    return sum;
  }, 0);
  const totalCredits = orders.reduce((sum, r) => sum + (r.credits_spent || 0), 0);

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Single Tabs wrapper around header + main */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {/* Persistent Header */}
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="sticky top-0 z-50 backdrop-blur-xl bg-background/95 border-b border-border/30"
          style={{ paddingTop: "max(env(safe-area-inset-top, 0px), 0px)" }}
        >
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 h-12">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/dashboard/events")}
              className="h-9 w-9"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleCopyLink} className="gap-1.5">
                <Copy className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Copy Link</span>
              </Button>
              <Button variant="default" size="sm" onClick={handleShare} className="gap-1.5">
                <Share2 className="h-3.5 w-3.5" />
                Share
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9">
                    <MoreHorizontal className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => navigate(`/event/${eventId}`)}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Public Page
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate(`/calendar?editEvent=${eventId}`)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Event
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive" onClick={() => setShowDeleteDialog(true)}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Event
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Event info bar */}
          {isLoading ? (
            <div className="px-4 pb-3 space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
          ) : event ? (
            <div className="px-4 pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h1 className="text-lg font-display font-semibold truncate">{event.title}</h1>
                    <Badge 
                      variant="outline" 
                      className={cn("shrink-0 text-[10px] px-1.5", statusStyles[status?.variant || 'draft'])}
                    >
                      {status?.label}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(event.start_date), "EEE, MMM d")}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(event.start_date), "h:mm a")}
                      {event.end_date && ` - ${format(new Date(event.end_date), "h:mm a")}`}
                    </span>
                    {(event.venue || event.city) && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {event.venue || event.city}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* Tabs */}
          <TabsList className="w-full justify-start gap-0 rounded-none border-t border-border/20 bg-transparent h-11 px-2 overflow-x-auto">
            <TabsTrigger value="orders" className="gap-1.5 data-[state=active]:bg-primary/10 rounded-lg">
              <Ticket className="h-3.5 w-3.5" />
              Orders
            </TabsTrigger>
            <TabsTrigger value="attendees" className="gap-1.5 data-[state=active]:bg-primary/10 rounded-lg">
              <Users className="h-3.5 w-3.5" />
              Attendees
            </TabsTrigger>
            <TabsTrigger value="checkin" className="gap-1.5 data-[state=active]:bg-primary/10 rounded-lg">
              <ScanLine className="h-3.5 w-3.5" />
              Check-In
            </TabsTrigger>
            <TabsTrigger value="marketing" className="gap-1.5 data-[state=active]:bg-primary/10 rounded-lg">
              <Megaphone className="h-3.5 w-3.5" />
              Marketing
            </TabsTrigger>
            <TabsTrigger value="finance" className="gap-1.5 data-[state=active]:bg-primary/10 rounded-lg">
              <DollarSign className="h-3.5 w-3.5" />
              Finance
            </TabsTrigger>
            <TabsTrigger value="team" className="gap-1.5 data-[state=active]:bg-primary/10 rounded-lg">
              <UserCog className="h-3.5 w-3.5" />
              Team
            </TabsTrigger>
          </TabsList>
        </motion.header>

        <main className="px-4 py-4">
          {!event && !isLoading ? (
            <EmptyState
              icon={Calendar}
              title="Event not found"
              description="This event may have been deleted or you don't have access."
            />
          ) : (
            <>
              {/* Orders Tab */}
              <TabsContent value="orders" className="mt-0 space-y-4">
                <OrdersTabV2
                  orders={v2Orders}
                  tiers={v2Tiers}
                  attendees={v2Attendees}
                  attendeeProfiles={v2AttendeeProfiles || {}}
                  isLoading={v2Loading}
                  onSelectAttendee={(key, name) => setSelectedAttendee({ key, name })}
                />
              </TabsContent>

              {/* Attendees Tab */}
              <TabsContent value="attendees" className="mt-0 space-y-4">
                <AttendeesTabV2
                  attendees={v2Attendees}
                  tiers={v2Tiers}
                  checkIns={v2CheckIns}
                  attendeeProfiles={v2AttendeeProfiles || {}}
                  isLoading={v2Loading}
                  eventTitle={event?.title || "Event"}
                  onSelectAttendee={(key, name) => setSelectedAttendee({ key, name })}
                />
              </TabsContent>

              {/* Check-In Tab */}
              <TabsContent value="checkin" className="mt-0 space-y-4">
                <CheckInTab
                  eventId={eventId!}
                  attendees={v2Attendees}
                  checkIns={v2CheckIns}
                />
              </TabsContent>

              {/* Marketing Tab */}
              <TabsContent value="marketing" className="mt-0 space-y-4">
                <MarketingTab eventId={eventId!} tiers={v2Tiers} />
              </TabsContent>

              {/* Finance Tab */}
              <TabsContent value="finance" className="mt-0 space-y-4">
                <FinanceTabV2
                  orders={v2Orders}
                  tiers={v2Tiers}
                />
              </TabsContent>

              {/* Team Tab */}
              <TabsContent value="team" className="mt-0 space-y-4">
                <TeamTab
                  teamMembers={teamMembers || []}
                  teamProfiles={teamProfiles || {}}
                  creatorId={event?.creator_id}
                  organizationId={event?.organization_id}
                />
              </TabsContent>
            </>
          )}
        </main>
      </Tabs>

      <AttendeeProfileDrawer
        open={!!selectedAttendee}
        onOpenChange={(o) => { if (!o) setSelectedAttendee(null); }}
        attendeeKey={selectedAttendee?.key || null}
        fallbackName={selectedAttendee?.name || null}
        eventId={eventId}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{event?.title}"? This action cannot be undone. All RSVPs and ticket data will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BottomNav />
    </div>
  );
}

// ============ Orders Tab ============
interface OrdersTabProps {
  orders: Array<{
    id: string;
    user_id: string;
    ticket_purchased: boolean | null;
    stripe_payment_id: string | null;
    credits_spent: number | null;
    guest_name?: string | null;
    guest_email?: string | null;
    created_at: string;
  }>;
  attendeeProfiles: Record<string, { display_name: string | null; avatar_url: string | null }>;
  event: { ticket_price: number | null } | null | undefined;
  isLoading: boolean;
}

function OrdersTab({ orders, attendeeProfiles, event, isLoading }: OrdersTabProps) {
  const [search, setSearch] = useState("");

  const getOrderName = (order: OrdersTabProps['orders'][0]) => {
    if (order.user_id && attendeeProfiles[order.user_id]) {
      return attendeeProfiles[order.user_id].display_name || "Unknown";
    }
    return order.guest_name || order.guest_email || "Guest";
  };

  const filteredOrders = orders.filter(order => {
    const name = getOrderName(order);
    const email = order.guest_email || "";
    return name.toLowerCase().includes(search.toLowerCase()) || email.toLowerCase().includes(search.toLowerCase());
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-border/40 bg-card/60">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-primary">{orders.length}</p>
            <p className="text-xs text-muted-foreground">Total Orders</p>
          </CardContent>
        </Card>
        <Card className="border-border/40 bg-card/60">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-emerald-500">
              ${orders.filter(o => o.stripe_payment_id).length * (event?.ticket_price || 0)}
            </p>
            <p className="text-xs text-muted-foreground">Revenue</p>
          </CardContent>
        </Card>
        <Card className="border-border/40 bg-card/60">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-amber-500">
              {orders.reduce((sum, o) => sum + (o.credits_spent || 0), 0)}
            </p>
            <p className="text-xs text-muted-foreground">Credits</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search orders..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <EmptyState
          icon={Ticket}
          title="No orders yet"
          description="Orders will appear here when people purchase tickets."
        />
      ) : (
        <div className="space-y-2">
          {filteredOrders.map(order => {
            const profile = order.user_id ? attendeeProfiles[order.user_id] : null;
            const displayName = getOrderName(order);
            return (
              <Card key={order.id} className="border-border/40 bg-card/60">
                <CardContent className="p-3 flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={profile?.avatar_url || undefined} />
                    <AvatarFallback>{displayName[0] || "?"}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium text-sm truncate">{displayName}</p>
                      {!order.user_id && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 bg-muted/50">Guest</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(order.created_at), "MMM d, h:mm a")}
                    </p>
                  </div>
                  <div className="text-right">
                    {order.stripe_payment_id ? (
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        ${event?.ticket_price || 0}
                      </Badge>
                    ) : order.credits_spent ? (
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                        {order.credits_spent} credits
                      </Badge>
                    ) : (
                      <Badge variant="outline">Free</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============ Attendees Tab ============
interface AttendeesTabProps {
  attendees: Array<{
    id: string;
    user_id: string | null;
    status: string;
    ticket_purchased: boolean | null;
    guest_name?: string | null;
    guest_email?: string | null;
    guest_phone?: string | null;
    created_at: string;
  }>;
  attendeeProfiles: Record<string, { display_name: string | null; avatar_url: string | null }>;
  isLoading: boolean;
  eventTitle: string;
}

function AttendeesTab({ attendees, attendeeProfiles, isLoading, eventTitle }: AttendeesTabProps) {
  const navigate = useNavigate();
  const { eventId } = useParams();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "going" | "interested" | "ticketed" | "guests">("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkMessage, setBulkMessage] = useState("");
  const [showComposer, setShowComposer] = useState(false);
  const [sending, setSending] = useState(false);
  const [creatingChat, setCreatingChat] = useState(false);

  const getAttendeeName = (a: AttendeesTabProps['attendees'][0]) => {
    if (a.user_id && attendeeProfiles[a.user_id]) {
      return attendeeProfiles[a.user_id].display_name || "Unknown";
    }
    return a.guest_name || "Guest";
  };

  const filteredAttendees = attendees.filter(a => {
    const name = getAttendeeName(a);
    const email = a.guest_email || "";
    const matchesSearch = name.toLowerCase().includes(search.toLowerCase()) || email.toLowerCase().includes(search.toLowerCase());
    
    if (filter === "all") return matchesSearch;
    if (filter === "going") return matchesSearch && a.status === "going";
    if (filter === "interested") return matchesSearch && a.status === "interested";
    if (filter === "ticketed") return matchesSearch && a.ticket_purchased;
    if (filter === "guests") return matchesSearch && !a.user_id;
    return matchesSearch;
  });

  const stats = {
    total: attendees.length,
    going: attendees.filter(a => a.status === "going").length,
    interested: attendees.filter(a => a.status === "interested").length,
    ticketed: attendees.filter(a => a.ticket_purchased).length,
    guests: attendees.filter(a => !a.user_id).length,
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const visibleIds = filteredAttendees.map(a => a.id);
    const allSelected = visibleIds.every(id => selectedIds.has(id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allSelected) visibleIds.forEach(id => next.delete(id));
      else visibleIds.forEach(id => next.add(id));
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const selectedAttendees = attendees.filter(a => selectedIds.has(a.id));
  const selectedRegisteredUserIds = selectedAttendees.map(a => a.user_id).filter((x): x is string => !!x);

  const handleDownloadCSV = () => {
    const source = selectedIds.size > 0 ? selectedAttendees : attendees;
    const rows = [["Name", "Email", "Phone", "Status", "Ticket", "Date"]];
    source.forEach(a => {
      const name = getAttendeeName(a);
      const email = a.guest_email || "";
      const phone = a.guest_phone || "";
      const ticketed = a.ticket_purchased ? "Yes" : "No";
      const date = format(new Date(a.created_at), "yyyy-MM-dd");
      rows.push([name, email, phone, a.status, ticketed, date]);
    });
    const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${eventTitle.replace(/[^a-zA-Z0-9]/g, "_")}_attendees.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`${source.length} attendee${source.length !== 1 ? 's' : ''} exported`);
  };

  // Send a 1:1 in-app message to a registered user, or mailto for guests.
  const handleMessageOne = async (a: AttendeesTabProps['attendees'][0]) => {
    if (a.user_id) {
      navigate(`/messages?new=${a.user_id}`);
    } else if (a.guest_email) {
      window.open(`mailto:${a.guest_email}?subject=${encodeURIComponent(eventTitle)}`, "_blank");
    } else {
      toast.info("No contact method available");
    }
  };

  // Bulk: send email blast (and SMS where possible) to selected attendees
  const handleBulkEmail = async () => {
    if (selectedIds.size === 0 || !eventId) return;
    setSending(true);
    try {
      const res = await supabase.functions.invoke("send-event-reminder", {
        body: {
          eventId,
          message: bulkMessage,
          recipientRsvpIds: Array.from(selectedIds),
        },
      });
      if (res.error) throw res.error;
      const r = res.data;
      toast.success(`Email sent to ${r.sentCount} of ${selectedIds.size} selected`);
      setShowComposer(false);
      setBulkMessage("");
      clearSelection();
    } catch (err) {
      toast.error("Failed to send email");
    } finally {
      setSending(false);
    }
  };

  // Bulk: start an in-app group chat with selected registered attendees
  const handleStartGroupChat = async () => {
    if (selectedRegisteredUserIds.length === 0) {
      toast.error("Group chat requires registered attendees (no guests)");
      return;
    }
    setCreatingChat(true);
    try {
      // 1:1 short-circuit
      if (selectedRegisteredUserIds.length === 1) {
        navigate(`/messages?new=${selectedRegisteredUserIds[0]}`);
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data: conv, error: convErr } = await supabase
        .from("conversations")
        .insert({ type: "group", name: eventTitle, created_by: user.id })
        .select()
        .single();
      if (convErr) throw convErr;
      const participants = [user.id, ...selectedRegisteredUserIds].map(uid => ({
        conversation_id: conv.id,
        user_id: uid,
      }));
      const { error: partErr } = await supabase.from("conversation_participants").insert(participants);
      if (partErr) throw partErr;
      toast.success(`Group chat created with ${selectedRegisteredUserIds.length} attendees`);
      navigate(`/messages?conversation=${conv.id}`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to create group chat");
    } finally {
      setCreatingChat(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }

  const allVisibleSelected = filteredAttendees.length > 0 && filteredAttendees.every(a => selectedIds.has(a.id));
  const guestSelectedCount = selectedAttendees.length - selectedRegisteredUserIds.length;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-5 gap-2">
        <button
          onClick={() => setFilter("all")}
          className={cn(
            "p-2 rounded-lg border text-center transition-all",
            filter === "all" ? "border-primary bg-primary/10" : "border-border/40 bg-card/60"
          )}
        >
          <p className="text-lg font-bold">{stats.total}</p>
          <p className="text-[10px] text-muted-foreground">All</p>
        </button>
        <button
          onClick={() => setFilter("going")}
          className={cn(
            "p-2 rounded-lg border text-center transition-all",
            filter === "going" ? "border-primary bg-primary/10" : "border-border/40 bg-card/60"
          )}
        >
          <p className="text-lg font-bold">{stats.going}</p>
          <p className="text-[10px] text-muted-foreground">Going</p>
        </button>
        <button
          onClick={() => setFilter("interested")}
          className={cn(
            "p-2 rounded-lg border text-center transition-all",
            filter === "interested" ? "border-primary bg-primary/10" : "border-border/40 bg-card/60"
          )}
        >
          <p className="text-lg font-bold">{stats.interested}</p>
          <p className="text-[10px] text-muted-foreground">Interested</p>
        </button>
        <button
          onClick={() => setFilter("ticketed")}
          className={cn(
            "p-2 rounded-lg border text-center transition-all",
            filter === "ticketed" ? "border-primary bg-primary/10" : "border-border/40 bg-card/60"
          )}
        >
          <p className="text-lg font-bold">{stats.ticketed}</p>
          <p className="text-[10px] text-muted-foreground">Ticketed</p>
        </button>
        <button
          onClick={() => setFilter("guests")}
          className={cn(
            "p-2 rounded-lg border text-center transition-all",
            filter === "guests" ? "border-primary bg-primary/10" : "border-border/40 bg-card/60"
          )}
        >
          <p className="text-lg font-bold">{stats.guests}</p>
          <p className="text-[10px] text-muted-foreground">Guests</p>
        </button>
      </div>

      {/* Search & Actions */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search attendees..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="icon" onClick={handleDownloadCSV} title="Download as CSV">
          <Download className="h-4 w-4" />
        </Button>
      </div>

      {/* Select-all bar */}
      {filteredAttendees.length > 0 && (
        <div className="flex items-center justify-between px-1">
          <button
            onClick={toggleSelectAll}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-2"
          >
            <span className={cn(
              "h-4 w-4 rounded border flex items-center justify-center transition-colors",
              allVisibleSelected ? "bg-primary border-primary" : "border-border"
            )}>
              {allVisibleSelected && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
            </span>
            {allVisibleSelected ? "Deselect all" : "Select all"}
          </button>
          {selectedIds.size > 0 && (
            <button
              onClick={clearSelection}
              className="text-xs text-primary hover:underline"
            >
              Clear ({selectedIds.size})
            </button>
          )}
        </div>
      )}

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <Card className="border-primary/30 bg-primary/5 sticky top-32 z-10">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                {selectedIds.size} selected
                {guestSelectedCount > 0 && (
                  <span className="text-xs text-muted-foreground ml-2">
                    ({selectedRegisteredUserIds.length} members, {guestSelectedCount} guests)
                  </span>
                )}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowComposer(s => !s)}
                className="gap-1.5"
              >
                <Mail className="h-3.5 w-3.5" />
                Email
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleStartGroupChat}
                disabled={creatingChat || selectedRegisteredUserIds.length === 0}
                className="gap-1.5"
                title={selectedRegisteredUserIds.length === 0 ? "Select members (not guests)" : undefined}
              >
                {creatingChat ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Users className="h-3.5 w-3.5" />}
                Group Chat
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleDownloadCSV}
                className="gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                Export
              </Button>
            </div>
            {showComposer && (
              <div className="space-y-2 pt-2 border-t border-border/40">
                <Input
                  placeholder="Optional message to include in the email..."
                  value={bulkMessage}
                  onChange={(e) => setBulkMessage(e.target.value)}
                  maxLength={500}
                />
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="ghost" onClick={() => { setShowComposer(false); setBulkMessage(""); }}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleBulkEmail} disabled={sending} className="gap-1.5">
                    {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    Send to {selectedIds.size}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Attendees List */}
      {filteredAttendees.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No attendees yet"
          description="Attendees will appear here when people RSVP."
        />
      ) : (
        <div className="space-y-2">
          {filteredAttendees.map(attendee => {
            const isGuest = !attendee.user_id;
            const profile = attendee.user_id ? attendeeProfiles[attendee.user_id] : null;
            const displayName = isGuest ? attendee.guest_name || "Guest" : profile?.display_name || "Unknown";
            const avatarUrl = profile?.avatar_url || undefined;
            const isSelected = selectedIds.has(attendee.id);

            return (
              <Card
                key={attendee.id}
                className={cn(
                  "border-border/40 bg-card/60 transition-colors cursor-pointer",
                  isSelected && "border-primary/50 bg-primary/5"
                )}
                onClick={() => toggleSelect(attendee.id)}
              >
                <CardContent className="p-3 flex items-center gap-3">
                  <span className={cn(
                    "h-5 w-5 rounded border flex items-center justify-center shrink-0 transition-colors",
                    isSelected ? "bg-primary border-primary" : "border-border bg-background"
                  )}>
                    {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-primary-foreground" />}
                  </span>
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={avatarUrl} />
                    <AvatarFallback>{displayName[0] || "?"}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium text-sm truncate">{displayName}</p>
                      {isGuest && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 bg-muted/50">Guest</Badge>
                      )}
                    </div>
                    {isGuest ? (
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        {attendee.guest_email && <p className="truncate">{attendee.guest_email}</p>}
                        {attendee.guest_phone && <p>{attendee.guest_phone}</p>}
                        <p className="capitalize">{attendee.status} · {format(new Date(attendee.created_at), "MMM d")}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground capitalize">
                        {attendee.status} · {format(new Date(attendee.created_at), "MMM d")}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {attendee.ticket_purchased && (
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                        <Ticket className="h-3 w-3 mr-1" />
                        Ticket
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleMessageOne(attendee)}
                      title={isGuest ? "Email guest" : "Send DM"}
                    >
                      {isGuest ? <Mail className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============ Marketing Tab ============
function MarketingTab({ eventId, tiers }: { eventId: string; tiers: any[] }) {
  const [bulkOpen, setBulkOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <div className="space-y-4">
      {/* Primary: Invite Audience */}
      <Card
        className="border-primary/40 bg-gradient-to-br from-primary/10 to-primary/5 cursor-pointer hover:border-primary/60 transition-colors"
        onClick={() => setInviteOpen(true)}
      >
        <CardContent className="p-4 flex items-center gap-3">
          <div className="h-12 w-12 rounded-lg bg-primary/20 flex items-center justify-center">
            <Megaphone className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-semibold">Invite audience</p>
            <p className="text-xs text-muted-foreground">Reach Ether users by city, interests & more</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="border-border/40 bg-card/60 cursor-pointer hover:bg-card/80 transition-colors" onClick={() => setBulkOpen(true)}>
          <CardContent className="p-4 text-center">
            <Mail className="h-7 w-7 mx-auto mb-2 text-primary" />
            <p className="font-medium text-sm">Email blast</p>
            <p className="text-xs text-muted-foreground">All attendees</p>
          </CardContent>
        </Card>
        <Card className="border-border/40 bg-card/60 cursor-pointer hover:bg-card/80 transition-colors" onClick={() => setBulkOpen(true)}>
          <CardContent className="p-4 text-center">
            <Send className="h-7 w-7 mx-auto mb-2 text-primary" />
            <p className="font-medium text-sm">Push reminder</p>
            <p className="text-xs text-muted-foreground">Filter & send</p>
          </CardContent>
        </Card>
      </div>

      <AutoReminderSettings eventId={eventId} />
      <CampaignAnalyticsCard eventId={eventId} />

      <BulkReminderDialog open={bulkOpen} onOpenChange={setBulkOpen} eventId={eventId} tiers={tiers} />
      <InviteAudienceDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        eventId={eventId}
        eventName={event?.title}
        eventCity={event?.city}
      />

    </div>
  );
}

// ============ Finance Tab ============
interface FinanceTabProps {
  orders: Array<{
    stripe_payment_id: string | null;
    credits_spent: number | null;
    created_at: string;
  }>;
  event: { ticket_price: number | null } | null | undefined;
  totalRevenue: number;
  totalCredits: number;
}

function FinanceTab({ orders, event, totalRevenue, totalCredits }: FinanceTabProps) {
  const paidOrders = orders.filter(o => o.stripe_payment_id);
  const creditOrders = orders.filter(o => o.credits_spent && !o.stripe_payment_id);

  // Estimated platform fee (example: 5%)
  const platformFee = totalRevenue * 0.05;
  const netRevenue = totalRevenue - platformFee;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-border/40 bg-card/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-emerald-500" />
              <span className="text-xs text-muted-foreground">Gross Revenue</span>
            </div>
            <p className="text-2xl font-bold text-emerald-500">${totalRevenue.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="border-border/40 bg-card/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Net Revenue</span>
            </div>
            <p className="text-2xl font-bold text-primary">${netRevenue.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Breakdown */}
      <Card className="border-border/40 bg-card/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-border/40">
            <span className="text-sm text-muted-foreground">Paid Orders</span>
            <span className="font-medium">{paidOrders.length} × ${event?.ticket_price || 0}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-border/40">
            <span className="text-sm text-muted-foreground">Credit Orders</span>
            <span className="font-medium">{creditOrders.length} ({totalCredits} credits)</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-border/40">
            <span className="text-sm text-muted-foreground">Platform Fee (5%)</span>
            <span className="font-medium text-destructive">-${platformFee.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-sm font-medium">Your Payout</span>
            <span className="font-bold text-emerald-500">${netRevenue.toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Payout Status */}
      <Card className="border-border/40 bg-card/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Payout Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {totalRevenue > 0 ? (
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                <Clock className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="font-medium text-sm">Pending</p>
                <p className="text-xs text-muted-foreground">
                  Payouts are processed after the event ends
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No revenue to pay out yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Refunds */}
      <Card className="border-border/40 bg-card/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <XCircle className="h-4 w-4" />
            Refunds
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No refunds issued for this event.</p>
        </CardContent>
      </Card>
    </div>
  );
}

// ============ Team Tab ============
interface TeamTabProps {
  teamMembers: Array<{ user_id: string; role: string; created_at: string }>;
  teamProfiles: Record<string, { display_name: string | null; avatar_url: string | null }>;
  creatorId?: string;
  organizationId?: string | null;
}

function TeamTab({ teamMembers, teamProfiles, creatorId, organizationId }: TeamTabProps) {
  // If no organization, just show the creator
  const allMembers = organizationId 
    ? teamMembers 
    : creatorId 
      ? [{ user_id: creatorId, role: 'owner', created_at: new Date().toISOString() }]
      : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {allMembers.length} team member{allMembers.length !== 1 ? 's' : ''}
        </p>
        {organizationId && (
          <Button variant="outline" size="sm">
            Manage Team
          </Button>
        )}
      </div>

      {allMembers.length === 0 ? (
        <EmptyState
          icon={UserCog}
          title="No team members"
          description="Only you have access to this event."
        />
      ) : (
        <div className="space-y-2">
          {allMembers.map(member => {
            const profile = teamProfiles[member.user_id];
            return (
              <Card key={member.user_id} className="border-border/40 bg-card/60">
                <CardContent className="p-3 flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={profile?.avatar_url || undefined} />
                    <AvatarFallback>{profile?.display_name?.[0] || "?"}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {profile?.display_name || "Unknown"}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {member.role}
                    </p>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {member.role}
                  </Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// PHASE 3: V2 Tab Components (built on ticket_orders / event_attendees / event_check_ins)
// ============================================================

const formatMoney = (cents: number, currency = "usd") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);

interface ProfileMap { [userId: string]: { display_name: string | null; avatar_url: string | null } }

// ============ Orders Tab V2 ============
function OrdersTabV2({
  orders,
  tiers,
  attendees,
  attendeeProfiles,
  isLoading,
  onSelectAttendee,
}: {
  orders: TicketOrder[];
  tiers: any[];
  attendees: EventAttendee[];
  attendeeProfiles: ProfileMap;
  isLoading: boolean;
  onSelectAttendee?: (key: AttendeeKey, name: string | null) => void;
}) {
  const [search, setSearch] = useState("");

  const tierMap = Object.fromEntries(tiers.map(t => [t.id, t]));
  const attendeesByOrder = attendees.reduce<Record<string, EventAttendee[]>>((acc, a) => {
    if (!a.order_id) return acc;
    (acc[a.order_id] = acc[a.order_id] || []).push(a);
    return acc;
  }, {});

  const filtered = orders.filter(o => {
    const profile = o.purchaser_user_id ? attendeeProfiles[o.purchaser_user_id] : null;
    const name = (profile?.display_name || o.purchaser_name || o.purchaser_email || "").toLowerCase();
    return name.includes(search.toLowerCase());
  });

  const paid = orders.filter(o => o.payment_status === "paid");
  const totalRevenue = paid.reduce((s, o) => s + o.total_cents, 0);
  const totalCredits = orders.reduce((s, o) => s + (o.credits_spent || 0), 0);
  const totalTickets = orders.reduce((s, o) => s + o.quantity, 0);

  if (isLoading) {
    return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-border/40 bg-card/60">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-primary">{orders.length}</p>
            <p className="text-xs text-muted-foreground">{totalTickets} tickets</p>
          </CardContent>
        </Card>
        <Card className="border-border/40 bg-card/60">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-emerald-500">{formatMoney(totalRevenue)}</p>
            <p className="text-xs text-muted-foreground">Revenue</p>
          </CardContent>
        </Card>
        <Card className="border-border/40 bg-card/60">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-amber-500">{totalCredits}</p>
            <p className="text-xs text-muted-foreground">Credits</p>
          </CardContent>
        </Card>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search orders..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Ticket} title="No orders yet" description="Orders will appear when people purchase tickets." />
      ) : (
        <div className="space-y-2">
          {filtered.map(order => {
            const profile = order.purchaser_user_id ? attendeeProfiles[order.purchaser_user_id] : null;
            const name = profile?.display_name || order.purchaser_name || order.purchaser_email || "Guest";
            const orderAttendees = attendeesByOrder[order.id] || [];
            const tierBreakdown = orderAttendees.reduce<Record<string, number>>((acc, a) => {
              const tn = a.tier_id ? (tierMap[a.tier_id]?.name || "Ticket") : "Ticket";
              acc[tn] = (acc[tn] || 0) + 1;
              return acc;
            }, {});
            return (
              <Card
                key={order.id}
                className="border-border/40 bg-card/60 cursor-pointer hover:border-primary/40 hover:bg-card/80 transition-colors"
                onClick={() => onSelectAttendee?.(
                  { email: order.purchaser_email || null, user_id: order.purchaser_user_id || null },
                  profile?.display_name || order.purchaser_name || null,
                )}
              >
                <CardContent className="p-3 flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={profile?.avatar_url || undefined} />
                    <AvatarFallback>{name[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium text-sm truncate">{name}</p>
                      {!order.purchaser_user_id && <Badge variant="outline" className="text-[10px] px-1 py-0">Guest</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {Object.entries(tierBreakdown).map(([t, q]) => `${q}× ${t}`).join(", ") || `${order.quantity} ticket${order.quantity > 1 ? "s" : ""}`}
                      {" · "}
                      {format(new Date(order.created_at), "MMM d, h:mm a")}
                    </p>
                  </div>
                  <div className="text-right space-y-1">
                    {order.payment_method === "stripe" ? (
                      <Badge variant="outline" className={cn("text-[10px]", order.payment_status === "paid" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" : "bg-amber-500/10 text-amber-600 border-amber-500/30")}>
                        {order.payment_status === "paid" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                        {formatMoney(order.total_cents, order.currency)}
                      </Badge>
                    ) : order.payment_method === "credits" ? (
                      <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/30">
                        {order.credits_spent} cr
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">Free</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============ Attendees Tab V2 ============
function AttendeesTabV2({
  attendees,
  tiers,
  checkIns,
  attendeeProfiles,
  isLoading,
  eventTitle,
  onSelectAttendee,
}: {
  attendees: EventAttendee[];
  tiers: any[];
  checkIns: any[];
  attendeeProfiles: ProfileMap;
  isLoading: boolean;
  eventTitle: string;
  onSelectAttendee?: (key: AttendeeKey, name: string | null) => void;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "checked_in" | "not_checked_in" | "guests">("all");

  const tierMap = Object.fromEntries(tiers.map(t => [t.id, t]));
  const checkedInIds = new Set(checkIns.map((c: any) => c.attendee_id));

  const getName = (a: EventAttendee) => {
    if (a.attendee_user_id && attendeeProfiles[a.attendee_user_id]) {
      return attendeeProfiles[a.attendee_user_id].display_name || a.attendee_name || "Attendee";
    }
    return a.attendee_name || "Guest";
  };

  const filtered = attendees.filter(a => {
    const matchesSearch = getName(a).toLowerCase().includes(search.toLowerCase()) ||
      (a.attendee_email || "").toLowerCase().includes(search.toLowerCase()) ||
      a.ticket_number.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (filter === "checked_in") return checkedInIds.has(a.id);
    if (filter === "not_checked_in") return !checkedInIds.has(a.id);
    if (filter === "guests") return !a.attendee_user_id;
    return true;
  });

  const stats = {
    total: attendees.length,
    checkedIn: attendees.filter(a => checkedInIds.has(a.id)).length,
    notCheckedIn: attendees.filter(a => !checkedInIds.has(a.id)).length,
    guests: attendees.filter(a => !a.attendee_user_id).length,
  };

  const handleDownloadCSV = () => {
    const rows = [["Name", "Email", "Phone", "Ticket #", "Tier", "Status", "Checked In", "Created"]];
    attendees.forEach(a => {
      rows.push([
        getName(a),
        a.attendee_email || "",
        a.attendee_phone || "",
        a.ticket_number,
        a.tier_id ? (tierMap[a.tier_id]?.name || "") : "",
        a.status,
        checkedInIds.has(a.id) ? "Yes" : "No",
        format(new Date(a.created_at), "yyyy-MM-dd HH:mm"),
      ]);
    });
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${eventTitle.replace(/[^a-zA-Z0-9]/g, "_")}_attendees.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`${attendees.length} attendees exported`);
  };

  if (isLoading) {
    return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>;
  }

  const filterChips: Array<{ key: typeof filter; label: string; count: number }> = [
    { key: "all", label: "All", count: stats.total },
    { key: "checked_in", label: "Checked In", count: stats.checkedIn },
    { key: "not_checked_in", label: "Not Yet", count: stats.notCheckedIn },
    { key: "guests", label: "Guests", count: stats.guests },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-2">
        {filterChips.map(chip => (
          <button
            key={chip.key}
            onClick={() => setFilter(chip.key)}
            className={cn(
              "p-2 rounded-lg border text-center transition-all",
              filter === chip.key ? "border-primary bg-primary/10" : "border-border/40 bg-card/60"
            )}
          >
            <p className="text-lg font-bold">{chip.count}</p>
            <p className="text-[10px] text-muted-foreground">{chip.label}</p>
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, email, ticket #..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button variant="outline" size="icon" onClick={handleDownloadCSV} title="Download CSV">
          <Download className="h-4 w-4" />
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Users} title="No attendees" description="Attendees appear here once tickets are issued." />
      ) : (
        <div className="space-y-2">
          {filtered.map(a => {
            const isGuest = !a.attendee_user_id;
            const profile = a.attendee_user_id ? attendeeProfiles[a.attendee_user_id] : null;
            const name = getName(a);
            const isCheckedIn = checkedInIds.has(a.id);
            const tierName = a.tier_id ? tierMap[a.tier_id]?.name : null;
            return (
              <Card
                key={a.id}
                className={cn(
                  "border-border/40 bg-card/60 cursor-pointer hover:border-primary/40 hover:bg-card/80 transition-colors",
                  isCheckedIn && "border-emerald-500/30 bg-emerald-500/5"
                )}
                onClick={() => onSelectAttendee?.(
                  { email: a.attendee_email || null, user_id: a.attendee_user_id || null },
                  name,
                )}
              >
                <CardContent className="p-3 flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={profile?.avatar_url || undefined} />
                    <AvatarFallback>{name[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium text-sm truncate">{name}</p>
                      {isGuest && <Badge variant="outline" className="text-[10px] px-1 py-0">Guest</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      <span className="font-mono">{a.ticket_number}</span>
                      {tierName && <> · {tierName}</>}
                      {a.attendee_email && <> · {a.attendee_email}</>}
                    </p>
                  </div>
                  {isCheckedIn ? (
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      In
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      <Clock className="h-3 w-3 mr-1" />
                      Not yet
                    </Badge>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============ Check-In Tab ============
function CheckInTab({
  eventId,
  attendees,
  checkIns,
}: {
  eventId: string;
  attendees: EventAttendee[];
  checkIns: any[];
}) {
  const total = attendees.filter(a => a.status === "confirmed" || a.status === "checked_in").length;
  const checkedIn = checkIns.length;
  const remaining = Math.max(0, total - checkedIn);
  const pct = total > 0 ? Math.round((checkedIn / total) * 100) : 0;

  return (
    <div className="space-y-4">
      <Card className="border-border/40 bg-card/60">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Checked in</p>
              <p className="text-3xl font-bold text-emerald-500">{checkedIn} <span className="text-base text-muted-foreground font-normal">/ {total}</span></p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Remaining</p>
              <p className="text-3xl font-bold">{remaining}</p>
            </div>
          </div>
          <Progress value={pct} className="h-2" />
          <p className="text-xs text-center text-muted-foreground">{pct}% checked in</p>
        </CardContent>
      </Card>

      <CheckInScanner eventId={eventId} />

      {checkIns.length > 0 && (
        <Card className="border-border/40 bg-card/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <QrCode className="h-4 w-4" />
              Recent check-ins
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {checkIns.slice(0, 10).map((ci: any) => (
              <div key={ci.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border/30 last:border-0">
                <div className="min-w-0">
                  <p className="truncate font-medium">{ci.event_attendees?.attendee_name || "Attendee"}</p>
                  <p className="text-xs text-muted-foreground font-mono truncate">{ci.event_attendees?.ticket_number}</p>
                </div>
                <div className="text-right text-xs text-muted-foreground shrink-0 ml-2">
                  <p>{format(new Date(ci.created_at), "h:mm a")}</p>
                  <Badge variant="outline" className="text-[9px] mt-0.5">{ci.method}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============ Finance Tab V2 ============
function FinanceTabV2({
  orders,
  tiers,
}: {
  orders: TicketOrder[];
  tiers: any[];
}) {
  const paid = orders.filter(o => o.payment_status === "paid");
  const grossCents = paid.reduce((s, o) => s + o.total_cents, 0);
  const refundedCents = orders.reduce((s, o) => s + (o.refund_amount_cents || 0), 0);
  const netCents = grossCents - refundedCents;
  const currency = orders[0]?.currency || "usd";

  const tierBreakdown = tiers.map(t => ({
    name: t.name,
    sold: t.quantity_sold || 0,
    capacity: t.capacity,
    revenueCents: (t.quantity_sold || 0) * (t.price_cents || 0),
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-border/40 bg-card/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-emerald-500" />
              <span className="text-xs text-muted-foreground">Gross Revenue</span>
            </div>
            <p className="text-2xl font-bold text-emerald-500">{formatMoney(grossCents, currency)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{paid.length} paid order{paid.length !== 1 ? "s" : ""}</p>
          </CardContent>
        </Card>
        <Card className="border-border/40 bg-card/60">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Net Revenue</span>
            </div>
            <p className="text-2xl font-bold text-primary">{formatMoney(netCents, currency)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">After {formatMoney(refundedCents, currency)} refunded</p>
          </CardContent>
        </Card>
      </div>

      {tierBreakdown.length > 0 && (
        <Card className="border-border/40 bg-card/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Tier sales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {tierBreakdown.map(t => (
              <div key={t.name} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{t.name}</span>
                  <span className="text-muted-foreground">
                    {t.sold}{t.capacity ? ` / ${t.capacity}` : ""} · {formatMoney(t.revenueCents, currency)}
                  </span>
                </div>
                {t.capacity && <Progress value={Math.min(100, (t.sold / t.capacity) * 100)} className="h-1.5" />}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="border-border/40 bg-card/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4" /> Payout Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {grossCents > 0 ? (
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                <Clock className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="font-medium text-sm">Pending</p>
                <p className="text-xs text-muted-foreground">Payouts processed after the event ends</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No revenue to pay out yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
