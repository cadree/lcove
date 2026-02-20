import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import BottomNav from "@/components/navigation/BottomNav";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
  const [activeTab, setActiveTab] = useState("orders");

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
      const userIds = [...new Set(rsvps.map(r => r.user_id))];
      const { data, error } = await supabase
        .from("profiles_public")
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
        .from("profiles_public")
        .select("user_id, display_name, avatar_url")
        .in("user_id", userIds);
      if (error) throw error;
      return Object.fromEntries((data || []).map(p => [p.user_id, p]));
    },
    enabled: !!teamMembers && teamMembers.length > 0,
  });

  const handleShare = async () => {
    const url = `${window.location.origin}/event/${eventId}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: event?.title,
          text: `Check out this event: ${event?.title}`,
          url,
        });
      } catch {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard");
    }
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/event/${eventId}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard");
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
                <DropdownMenuItem onClick={() => navigate(`/calendar?event=${eventId}`)}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Public Page
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Event
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive">
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
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start gap-0 rounded-none border-t border-border/20 bg-transparent h-11 px-2">
            <TabsTrigger value="orders" className="gap-1.5 data-[state=active]:bg-primary/10 rounded-lg">
              <Ticket className="h-3.5 w-3.5" />
              Orders
            </TabsTrigger>
            <TabsTrigger value="attendees" className="gap-1.5 data-[state=active]:bg-primary/10 rounded-lg">
              <Users className="h-3.5 w-3.5" />
              Attendees
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
        </Tabs>
      </motion.header>

      <main className="px-4 py-4">
        {!event && !isLoading ? (
          <EmptyState
            icon={Calendar}
            title="Event not found"
            description="This event may have been deleted or you don't have access."
          />
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            {/* Orders Tab */}
            <TabsContent value="orders" className="mt-0 space-y-4">
              <OrdersTab 
                orders={orders} 
                attendeeProfiles={attendeeProfiles || {}} 
                event={event}
                isLoading={rsvpsLoading}
              />
            </TabsContent>

            {/* Attendees Tab */}
            <TabsContent value="attendees" className="mt-0 space-y-4">
              <AttendeesTab 
                attendees={attendees} 
                attendeeProfiles={attendeeProfiles || {}}
                isLoading={rsvpsLoading}
              />
            </TabsContent>

            {/* Marketing Tab */}
            <TabsContent value="marketing" className="mt-0 space-y-4">
              <MarketingTab eventId={eventId!} />
            </TabsContent>

            {/* Finance Tab */}
            <TabsContent value="finance" className="mt-0 space-y-4">
              <FinanceTab 
                orders={orders}
                event={event}
                totalRevenue={totalRevenue}
                totalCredits={totalCredits}
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
          </Tabs>
        )}
      </main>

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
    created_at: string;
  }>;
  attendeeProfiles: Record<string, { display_name: string | null; avatar_url: string | null }>;
  event: { ticket_price: number | null } | null | undefined;
  isLoading: boolean;
}

function OrdersTab({ orders, attendeeProfiles, event, isLoading }: OrdersTabProps) {
  const [search, setSearch] = useState("");

  const filteredOrders = orders.filter(order => {
    const profile = attendeeProfiles[order.user_id];
    const name = profile?.display_name || "";
    return name.toLowerCase().includes(search.toLowerCase());
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
            const profile = attendeeProfiles[order.user_id];
            return (
              <Card key={order.id} className="border-border/40 bg-card/60">
                <CardContent className="p-3 flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={profile?.avatar_url || undefined} />
                    <AvatarFallback>{profile?.display_name?.[0] || "?"}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {profile?.display_name || "Unknown"}
                    </p>
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
}

function AttendeesTab({ attendees, attendeeProfiles, isLoading }: AttendeesTabProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "going" | "interested" | "ticketed" | "guests">("all");

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
        <Button variant="outline" size="icon">
          <Download className="h-4 w-4" />
        </Button>
      </div>

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

            return (
              <Card key={attendee.id} className="border-border/40 bg-card/60">
                <CardContent className="p-3 flex items-center gap-3">
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
                        {attendee.guest_email && <p>{attendee.guest_email}</p>}
                        {attendee.guest_phone && <p>{attendee.guest_phone}</p>}
                        <p className="capitalize">{attendee.status} · {format(new Date(attendee.created_at), "MMM d")}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground capitalize">
                        {attendee.status} · {format(new Date(attendee.created_at), "MMM d")}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {attendee.ticket_purchased && (
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                        <Ticket className="h-3 w-3 mr-1" />
                        Ticket
                      </Badge>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Mail className="h-4 w-4" />
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
function MarketingTab({ eventId }: { eventId: string }) {
  // TODO: Fetch campaigns for this event
  return (
    <div className="space-y-4">
      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-border/40 bg-card/60 cursor-pointer hover:bg-card/80 transition-colors">
          <CardContent className="p-4 text-center">
            <Mail className="h-8 w-8 mx-auto mb-2 text-primary" />
            <p className="font-medium text-sm">Email Blast</p>
            <p className="text-xs text-muted-foreground">Send to attendees</p>
          </CardContent>
        </Card>
        <Card className="border-border/40 bg-card/60 cursor-pointer hover:bg-card/80 transition-colors">
          <CardContent className="p-4 text-center">
            <Send className="h-8 w-8 mx-auto mb-2 text-primary" />
            <p className="font-medium text-sm">Push Notification</p>
            <p className="text-xs text-muted-foreground">Remind attendees</p>
          </CardContent>
        </Card>
      </div>

      {/* Campaign Stats */}
      <Card className="border-border/40 bg-card/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Campaign Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={Megaphone}
            title="No campaigns yet"
            description="Create an email blast or push notification to reach your attendees."
          />
        </CardContent>
      </Card>
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
