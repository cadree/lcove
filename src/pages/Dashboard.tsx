import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  Calendar,
  DollarSign,
  Users,
  Ticket,
  TrendingUp,
  Clock,
  ChevronRight,
  Coins,
  BarChart3,
  CalendarPlus,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useEventDashboard } from "@/hooks/useEventDashboard";
import BottomNav from "@/components/navigation/BottomNav";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    metrics,
    recentOrders,
    salesData,
    upcomingCampaigns,
    eventAttendees,
    isLoading,
  } = useEventDashboard();

  if (!user) {
    navigate("/auth");
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-50 backdrop-blur-xl bg-background/95 border-b border-border/30"
        style={{ paddingTop: "max(env(safe-area-inset-top, 0px), 0px)" }}
      >
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="h-9 w-9"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-display font-semibold">Event Dashboard</h1>
              <p className="text-xs text-muted-foreground">Your hosting overview</p>
            </div>
          </div>
          <Button
            onClick={() => navigate("/calendar")}
            size="sm"
            className="gap-2"
          >
            <CalendarPlus className="h-4 w-4" />
            Create Event
          </Button>
        </div>
      </motion.header>

      <main className="px-4 py-6 space-y-6">
        {/* View All Events Link */}
        <Button
          variant="outline"
          className="w-full justify-between"
          onClick={() => navigate("/dashboard/events")}
        >
          <span className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            View All Events
          </span>
          <ChevronRight className="h-4 w-4" />
        </Button>

        {/* KPI Cards */}
        <section className="grid grid-cols-2 gap-3">
          <KPICard
            icon={Calendar}
            label="Total Events"
            value={metrics.totalEvents}
            subvalue={`${metrics.upcomingEvents} upcoming`}
            isLoading={isLoading}
            color="primary"
          />
          <KPICard
            icon={Users}
            label="Total Attendees"
            value={metrics.totalAttendees}
            subvalue={`${metrics.averageAttendance} avg/event`}
            isLoading={isLoading}
            color="emerald"
          />
          <KPICard
            icon={DollarSign}
            label="Revenue"
            value={`$${metrics.totalRevenue.toLocaleString()}`}
            subvalue={`${metrics.ticketsSold} tickets sold`}
            isLoading={isLoading}
            color="amber"
          />
          <KPICard
            icon={Coins}
            label="Credits Earned"
            value={metrics.totalCreditsEarned}
            subvalue="LC Credits"
            isLoading={isLoading}
            color="purple"
          />
        </section>

        {/* Sales Chart */}
        <Card className="border-border/40 bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Sales Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : salesData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={salesData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis
                    dataKey="date"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    stroke="hsl(var(--muted-foreground))"
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    formatter={(value: number, name: string) => [
                      name === "revenue" ? `$${value}` : value,
                      name === "revenue" ? "Revenue" : "Tickets",
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(var(--primary))"
                    fillOpacity={1}
                    fill="url(#colorRevenue)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                No sales data yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card className="border-border/40 bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Ticket className="h-4 w-4 text-emerald-500" />
              Recent Orders
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : recentOrders.length > 0 ? (
              <div className="divide-y divide-border/30">
                {recentOrders.map((order) => (
                  <Link
                    key={order.id}
                    to={`/calendar?event=${order.eventId}`}
                    className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <Ticket className="h-5 w-5 text-emerald-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{order.eventTitle}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {order.isPaid && (
                        <p className="text-sm font-medium text-emerald-500">
                          +${order.amount}
                        </p>
                      )}
                      {order.credits && order.credits > 0 && (
                        <p className="text-xs text-purple-400">
                          +{order.credits} credits
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground text-sm">
                No ticket orders yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Campaigns */}
        <Card className="border-border/40 bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              Upcoming Events
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : upcomingCampaigns.length > 0 ? (
              <div className="divide-y divide-border/30">
                {upcomingCampaigns.map((event) => (
                  <Link
                    key={event.id}
                    to={`/calendar?event=${event.id}`}
                    className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {event.image_url ? (
                        <img
                          src={event.image_url}
                          alt={event.title}
                          className="w-12 h-12 rounded-lg object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Calendar className="h-5 w-5 text-primary" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{event.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(event.start_date), "MMM d, h:mm a")}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {event.attendeeCount} going
                          </Badge>
                          {event.ticketsSold > 0 && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-emerald-500 border-emerald-500/30">
                              {event.ticketsSold} tickets
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground text-sm">
                No upcoming events
              </div>
            )}
          </CardContent>
        </Card>

        {/* Attendee Counts */}
        <Card className="border-border/40 bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              Attendee Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : eventAttendees.length > 0 ? (
              <div className="divide-y divide-border/30">
                {eventAttendees.slice(0, 8).map((event) => (
                  <div
                    key={event.eventId}
                    className="flex items-center justify-between p-4"
                  >
                    <p className="text-sm font-medium truncate flex-1 mr-4">
                      {event.eventTitle}
                    </p>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-center">
                        <p className="text-sm font-semibold text-emerald-500">{event.going}</p>
                        <p className="text-[10px] text-muted-foreground">Going</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold text-amber-500">{event.interested}</p>
                        <p className="text-[10px] text-muted-foreground">Interested</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold text-primary">{event.ticketed}</p>
                        <p className="text-[10px] text-muted-foreground">Ticketed</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground text-sm">
                No events with attendees yet
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
}

// KPI Card Component
interface KPICardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subvalue?: string;
  isLoading?: boolean;
  color?: "primary" | "emerald" | "amber" | "purple";
}

function KPICard({ icon: Icon, label, value, subvalue, isLoading, color = "primary" }: KPICardProps) {
  const colorClasses = {
    primary: "bg-primary/10 text-primary",
    emerald: "bg-emerald-500/10 text-emerald-500",
    amber: "bg-amber-500/10 text-amber-500",
    purple: "bg-purple-500/10 text-purple-500",
  };

  return (
    <Card className="border-border/40 bg-card/60 backdrop-blur-sm">
      <CardContent className="p-4">
        {isLoading ? (
          <>
            <Skeleton className="h-8 w-8 rounded-lg mb-2" />
            <Skeleton className="h-6 w-16 mb-1" />
            <Skeleton className="h-3 w-20" />
          </>
        ) : (
          <>
            <div className={`w-9 h-9 rounded-lg ${colorClasses[color]} flex items-center justify-center mb-2`}>
              <Icon className="h-4 w-4" />
            </div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
            {subvalue && (
              <p className="text-[10px] text-muted-foreground/70 mt-0.5">{subvalue}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
