import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { startOfMonth, endOfMonth, subMonths, format, startOfDay, endOfDay, eachDayOfInterval, eachMonthOfInterval, subDays } from "date-fns";

interface DashboardEvent {
  id: string;
  title: string;
  start_date: string;
  end_date: string | null;
  ticket_type: string;
  ticket_price: number | null;
  capacity: number | null;
  image_url: string | null;
  city: string;
  status: string | null;
  organization_id: string | null;
}

interface EventRSVP {
  id: string;
  event_id: string;
  user_id: string;
  status: string;
  ticket_purchased: boolean;
  stripe_payment_id: string | null;
  credits_spent: number | null;
  created_at: string;
}

interface DashboardMetrics {
  totalEvents: number;
  upcomingEvents: number;
  pastEvents: number;
  totalAttendees: number;
  totalRevenue: number;
  totalCreditsEarned: number;
  ticketsSold: number;
  averageAttendance: number;
}

interface RecentOrder {
  id: string;
  eventTitle: string;
  eventId: string;
  attendeeName: string | null;
  attendeeAvatar: string | null;
  amount: number;
  credits: number | null;
  createdAt: string;
  isPaid: boolean;
}

interface SalesDataPoint {
  date: string;
  revenue: number;
  tickets: number;
}

export function useEventDashboard() {
  const { user } = useAuth();

  // Fetch user's organization memberships
  const { data: userOrgs } = useQuery({
    queryKey: ['user-organizations', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id);
      if (error) throw error;
      return data?.map(m => m.organization_id) || [];
    },
    enabled: !!user,
  });

  // Fetch events where user is creator OR belongs to their orgs
  const { data: events, isLoading: eventsLoading } = useQuery({
    queryKey: ['dashboard-events', user?.id, userOrgs],
    queryFn: async () => {
      if (!user) return [];
      
      // Build query for events created by user
      let query = supabase
        .from('events')
        .select('*')
        .eq('creator_id', user.id);
      
      const { data: userEvents, error: userError } = await query;
      if (userError) throw userError;

      // If user has org memberships, also fetch org events
      let orgEvents: DashboardEvent[] = [];
      if (userOrgs && userOrgs.length > 0) {
        const { data: orgData, error: orgError } = await supabase
          .from('events')
          .select('*')
          .in('organization_id', userOrgs)
          .neq('creator_id', user.id); // Avoid duplicates
        
        if (orgError) throw orgError;
        orgEvents = orgData || [];
      }

      return [...(userEvents || []), ...orgEvents] as DashboardEvent[];
    },
    enabled: !!user && userOrgs !== undefined,
  });

  // Fetch RSVPs for all user's events
  const { data: rsvps, isLoading: rsvpsLoading } = useQuery({
    queryKey: ['dashboard-rsvps', events?.map(e => e.id)],
    queryFn: async () => {
      if (!events || events.length === 0) return [];
      
      const eventIds = events.map(e => e.id);
      const { data, error } = await supabase
        .from('event_rsvps')
        .select('*')
        .in('event_id', eventIds);
      
      if (error) throw error;
      return data as EventRSVP[];
    },
    enabled: !!events && events.length > 0,
  });

  // Calculate metrics
  const metrics: DashboardMetrics = {
    totalEvents: events?.length || 0,
    upcomingEvents: events?.filter(e => new Date(e.start_date) > new Date()).length || 0,
    pastEvents: events?.filter(e => new Date(e.start_date) <= new Date()).length || 0,
    totalAttendees: rsvps?.filter(r => r.status === 'going' || r.ticket_purchased).length || 0,
    totalRevenue: rsvps?.reduce((sum, r) => {
      if (r.ticket_purchased && r.stripe_payment_id) {
        const event = events?.find(e => e.id === r.event_id);
        return sum + (event?.ticket_price || 0);
      }
      return sum;
    }, 0) || 0,
    totalCreditsEarned: rsvps?.reduce((sum, r) => sum + (r.credits_spent || 0), 0) || 0,
    ticketsSold: rsvps?.filter(r => r.ticket_purchased).length || 0,
    averageAttendance: events?.length 
      ? Math.round((rsvps?.filter(r => r.status === 'going' || r.ticket_purchased).length || 0) / events.length)
      : 0,
  };

  // Recent orders (last 30 days, paid tickets)
  const recentOrders: RecentOrder[] = rsvps
    ?.filter(r => r.ticket_purchased)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10)
    .map(r => {
      const event = events?.find(e => e.id === r.event_id);
      return {
        id: r.id,
        eventTitle: event?.title || 'Unknown Event',
        eventId: r.event_id,
        attendeeName: null, // Would need to fetch profiles
        attendeeAvatar: null,
        amount: event?.ticket_price || 0,
        credits: r.credits_spent,
        createdAt: r.created_at,
        isPaid: !!r.stripe_payment_id,
      };
    }) || [];

  // Sales data for chart (last 6 months)
  const salesData: SalesDataPoint[] = (() => {
    if (!rsvps || !events) return [];
    
    const months = eachMonthOfInterval({
      start: subMonths(new Date(), 5),
      end: new Date(),
    });

    return months.map(month => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);
      
      const monthRsvps = rsvps.filter(r => {
        const date = new Date(r.created_at);
        return r.ticket_purchased && date >= monthStart && date <= monthEnd;
      });

      const revenue = monthRsvps.reduce((sum, r) => {
        const event = events?.find(e => e.id === r.event_id);
        return sum + (r.stripe_payment_id ? (event?.ticket_price || 0) : 0);
      }, 0);

      return {
        date: format(month, 'MMM yyyy'),
        revenue,
        tickets: monthRsvps.length,
      };
    });
  })();

  // Upcoming events (campaigns)
  const upcomingCampaigns = events
    ?.filter(e => new Date(e.start_date) > new Date())
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
    .slice(0, 5)
    .map(e => {
      const eventRsvps = rsvps?.filter(r => r.event_id === e.id) || [];
      return {
        ...e,
        attendeeCount: eventRsvps.filter(r => r.status === 'going' || r.ticket_purchased).length,
        interestedCount: eventRsvps.filter(r => r.status === 'interested').length,
        ticketsSold: eventRsvps.filter(r => r.ticket_purchased).length,
      };
    }) || [];

  // Attendee counts per event
  const eventAttendees = events?.map(e => {
    const eventRsvps = rsvps?.filter(r => r.event_id === e.id) || [];
    return {
      eventId: e.id,
      eventTitle: e.title,
      going: eventRsvps.filter(r => r.status === 'going').length,
      interested: eventRsvps.filter(r => r.status === 'interested').length,
      ticketed: eventRsvps.filter(r => r.ticket_purchased).length,
      total: eventRsvps.length,
    };
  }) || [];

  return {
    events,
    rsvps,
    metrics,
    recentOrders,
    salesData,
    upcomingCampaigns,
    eventAttendees,
    isLoading: eventsLoading || rsvpsLoading,
  };
}
