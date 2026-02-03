import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Clock,
  Users,
  Ticket,
  DollarSign,
  Coins,
  Edit,
  Trash2,
  ExternalLink,
  Share2,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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

export default function EventDetail() {
  const navigate = useNavigate();
  const { eventId } = useParams();
  const { user } = useAuth();

  const { data: event, isLoading } = useQuery({
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

  const { data: rsvps } = useQuery({
    queryKey: ["event-rsvps", eventId],
    queryFn: async () => {
      if (!eventId) return [];
      const { data, error } = await supabase
        .from("event_rsvps")
        .select("*")
        .eq("event_id", eventId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!eventId,
  });

  const stats = {
    going: rsvps?.filter((r) => r.status === "going").length || 0,
    interested: rsvps?.filter((r) => r.status === "interested").length || 0,
    ticketed: rsvps?.filter((r) => r.ticket_purchased).length || 0,
    revenue:
      rsvps?.reduce((sum, r) => {
        if (r.ticket_purchased && r.stripe_payment_id) {
          return sum + (event?.ticket_price || 0);
        }
        return sum;
      }, 0) || 0,
    creditsEarned: rsvps?.reduce((sum, r) => sum + (r.credits_spent || 0), 0) || 0,
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/calendar?event=${eventId}`;
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
              onClick={() => navigate("/dashboard/events")}
              className="h-9 w-9"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-display font-semibold truncate max-w-[200px]">
                {isLoading ? <Skeleton className="h-5 w-32" /> : event?.title}
              </h1>
              <p className="text-xs text-muted-foreground">Event Details</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={handleShare}>
              <Share2 className="h-5 w-5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
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
      </motion.header>

      <main className="px-4 py-6 space-y-6">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : event ? (
          <>
            {/* Event Image */}
            {event.image_url ? (
              <div className="relative rounded-xl overflow-hidden aspect-video">
                <img
                  src={event.image_url}
                  alt={event.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4">
                  <Badge
                    className={cn(
                      "mb-2",
                      event.status === "published" && "bg-emerald-500",
                      event.status === "draft" && "bg-amber-500",
                      event.status === "cancelled" && "bg-destructive"
                    )}
                  >
                    {event.status || "draft"}
                  </Badge>
                  <h2 className="text-xl font-bold text-white">{event.title}</h2>
                </div>
              </div>
            ) : (
              <div className="rounded-xl bg-primary/10 aspect-video flex items-center justify-center">
                <Calendar className="h-16 w-16 text-primary/50" />
              </div>
            )}

            {/* Quick Stats */}
            <div className="grid grid-cols-4 gap-2">
              <StatCard icon={Users} label="Going" value={stats.going} color="emerald" />
              <StatCard icon={Ticket} label="Tickets" value={stats.ticketed} color="primary" />
              <StatCard icon={DollarSign} label="Revenue" value={`$${stats.revenue}`} color="amber" />
              <StatCard icon={Coins} label="Credits" value={stats.creditsEarned} color="purple" />
            </div>

            {/* Event Info */}
            <Card className="border-border/40 bg-card/60 backdrop-blur-sm">
              <CardContent className="p-4 space-y-4">
                {/* Date & Time */}
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Calendar className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">
                      {format(new Date(event.start_date), "EEEE, MMMM d, yyyy")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(event.start_date), "h:mm a")}
                      {event.end_date &&
                        ` - ${format(new Date(event.end_date), "h:mm a")}`}
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Location */}
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <MapPin className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    {event.venue && <p className="font-medium">{event.venue}</p>}
                    {event.address && (
                      <p className="text-sm text-muted-foreground">{event.address}</p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      {event.city}
                      {event.state && `, ${event.state}`}
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Ticket Info */}
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Ticket className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium capitalize">{event.ticket_type} Event</p>
                    {event.ticket_price && (
                      <p className="text-sm text-muted-foreground">
                        ${event.ticket_price} per ticket
                      </p>
                    )}
                    {event.credits_price && (
                      <p className="text-sm text-muted-foreground">
                        {event.credits_price} credits per ticket
                      </p>
                    )}
                    {event.capacity && (
                      <p className="text-sm text-muted-foreground">
                        Capacity: {event.capacity} guests
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Description */}
            {event.description && (
              <Card className="border-border/40 bg-card/60 backdrop-blur-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">About</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {event.description}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Attendees Summary */}
            <Card className="border-border/40 bg-card/60 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Attendees
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-emerald-500">{stats.going}</p>
                    <p className="text-xs text-muted-foreground">Going</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-amber-500">{stats.interested}</p>
                    <p className="text-xs text-muted-foreground">Interested</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-primary">{stats.ticketed}</p>
                    <p className="text-xs text-muted-foreground">Ticketed</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="w-full mt-4"
                  onClick={() => navigate(`/calendar?event=${eventId}`)}
                >
                  Manage Attendees
                </Button>
              </CardContent>
            </Card>

            {/* Timestamps */}
            <p className="text-xs text-muted-foreground text-center">
              Created {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
            </p>
          </>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Event not found</p>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color?: "primary" | "emerald" | "amber" | "purple";
}

function StatCard({ icon: Icon, label, value, color = "primary" }: StatCardProps) {
  const colorClasses = {
    primary: "text-primary",
    emerald: "text-emerald-500",
    amber: "text-amber-500",
    purple: "text-purple-500",
  };

  return (
    <div className="text-center p-3 rounded-xl border border-border/40 bg-card/60">
      <Icon className={cn("h-4 w-4 mx-auto mb-1", colorClasses[color])} />
      <p className={cn("text-lg font-bold", colorClasses[color])}>{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
