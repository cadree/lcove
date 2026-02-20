import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { format } from "date-fns";
import {
  Calendar,
  MapPin,
  Users,
  Clock,
  Ticket,
  CheckCircle2,
  ExternalLink,
  Share2,
  Copy,
  LogIn,
  Phone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function PublicEventPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [rsvpSuccess, setRsvpSuccess] = useState(false);

  // Fetch event (public – anon can read)
  const { data: event, isLoading } = useQuery({
    queryKey: ["public-event", eventId],
    queryFn: async () => {
      if (!eventId) throw new Error("No event ID");
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("id", eventId)
        .eq("is_public", true)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!eventId,
  });

  // Fetch organizer profile
  const { data: organizer } = useQuery({
    queryKey: ["public-event-organizer", event?.creator_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles_public")
        .select("display_name, avatar_url")
        .eq("user_id", event!.creator_id)
        .maybeSingle();
      return data;
    },
    enabled: !!event?.creator_id,
  });

  // Fetch RSVP count
  const { data: rsvpCount } = useQuery({
    queryKey: ["public-event-rsvp-count", eventId],
    queryFn: async () => {
      const { count } = await supabase
        .from("event_rsvps")
        .select("*", { count: "exact", head: true })
        .eq("event_id", eventId!)
        .eq("status", "going");
      return count || 0;
    },
    enabled: !!eventId,
  });

  // Guest RSVP mutation
  const guestRsvpMutation = useMutation({
    mutationFn: async () => {
      if (!eventId) throw new Error("No event");
      const { error } = await supabase.from("event_rsvps").insert({
        event_id: eventId,
        status: "going",
        guest_name: guestName.trim(),
        guest_email: guestEmail.trim().toLowerCase(),
        guest_phone: guestPhone.trim() || null,
      });
      if (error) {
        if (error.code === "23505") {
          throw new Error("You've already RSVP'd with this email!");
        }
        throw error;
      }
    },
    onSuccess: () => {
      setRsvpSuccess(true);
      queryClient.invalidateQueries({ queryKey: ["public-event-rsvp-count", eventId] });
      toast.success("You're on the list!");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to RSVP");
    },
  });

  const handleGuestRsvp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim() || !guestEmail.trim()) {
      toast.error("Please enter your name and email");
      return;
    }
    guestRsvpMutation.mutate();
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: event?.title, text: `Check out this event: ${event?.title}`, url });
      } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied!");
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied!");
  };

  const isPast = event ? new Date(event.end_date || event.start_date) < new Date() : false;
  const isFree = !event?.ticket_price || event.ticket_price <= 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-full max-w-lg mx-auto px-4 space-y-4">
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center px-6">
          <Calendar className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-display font-bold mb-2">Event Not Found</h1>
          <p className="text-muted-foreground">This event doesn't exist or isn't public.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative">
        {event.image_url ? (
          <div className="h-56 sm:h-72 w-full overflow-hidden">
            <img src={event.image_url} alt={event.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
          </div>
        ) : (
          <div className="h-40 sm:h-56 w-full bg-gradient-to-br from-primary/20 via-primary/10 to-background" />
        )}

        {/* Share buttons */}
        <div className="absolute top-4 right-4 flex gap-2">
          <Button variant="secondary" size="icon" className="h-9 w-9 rounded-full backdrop-blur-md bg-background/60" onClick={handleCopy}>
            <Copy className="h-4 w-4" />
          </Button>
          <Button variant="secondary" size="icon" className="h-9 w-9 rounded-full backdrop-blur-md bg-background/60" onClick={handleShare}>
            <Share2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-12 relative z-10 pb-12">
        {/* Event info card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-border/50 shadow-xl bg-card/95 backdrop-blur-md">
            <CardContent className="p-5 space-y-4">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <h1 className="text-xl sm:text-2xl font-display font-bold leading-tight">{event.title}</h1>
                  {isPast && (
                    <Badge variant="outline" className="shrink-0 bg-muted text-muted-foreground">Past</Badge>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4 text-primary shrink-0" />
                <span>{format(new Date(event.start_date), "EEEE, MMMM d, yyyy")}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4 text-primary shrink-0" />
                <span>
                  {format(new Date(event.start_date), "h:mm a")}
                  {event.end_date && ` – ${format(new Date(event.end_date), "h:mm a")}`}
                </span>
              </div>

              {(event.venue || event.city) && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 text-primary shrink-0" />
                  <span>{[event.venue, event.address, event.city, event.state].filter(Boolean).join(", ")}</span>
                </div>
              )}

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4 text-primary shrink-0" />
                <span>
                  {rsvpCount} attending
                  {event.capacity && ` · ${event.capacity - (rsvpCount || 0)} spots left`}
                </span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <Ticket className="h-4 w-4 text-primary shrink-0" />
                <span className="font-medium">{isFree ? "Free Event" : `$${event.ticket_price}`}</span>
              </div>

              {organizer && (
                <div className="flex items-center gap-3 pt-2 border-t border-border/30">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={organizer.avatar_url || undefined} />
                    <AvatarFallback>{organizer.display_name?.[0] || "?"}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-xs text-muted-foreground">Hosted by</p>
                    <p className="text-sm font-medium">{organizer.display_name}</p>
                  </div>
                </div>
              )}

              {event.description && (
                <div className="pt-2 border-t border-border/30">
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{event.description}</p>
                </div>
              )}

              {event.external_url && (
                <a href={event.external_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                  <ExternalLink className="h-4 w-4" />
                  Event Link
                </a>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* RSVP Section for free events */}
        {!isPast && isFree && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <Card className="mt-4 border-border/50 shadow-lg bg-card/95 backdrop-blur-md">
              <CardContent className="p-5">
                {rsvpSuccess ? (
                  <div className="text-center py-4 space-y-3">
                    <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
                    <h3 className="text-lg font-display font-semibold">You're on the list!</h3>
                    <p className="text-sm text-muted-foreground">
                      We've saved your RSVP for <strong>{event.title}</strong>.
                    </p>
                  </div>
                ) : (
                  <>
                    <h3 className="text-lg font-display font-semibold mb-1">RSVP to this event</h3>
                    <p className="text-xs text-muted-foreground mb-4">Fill in your info below, or sign in to RSVP with your profile.</p>

                    <form onSubmit={handleGuestRsvp} className="space-y-3">
                      <div>
                        <Label htmlFor="guest-name" className="text-xs">Full Name *</Label>
                        <Input
                          id="guest-name"
                          value={guestName}
                          onChange={(e) => setGuestName(e.target.value)}
                          placeholder="Enter your full name"
                          required
                          maxLength={100}
                        />
                      </div>
                      <div>
                        <Label htmlFor="guest-email" className="text-xs">Email Address *</Label>
                        <Input
                          id="guest-email"
                          type="email"
                          value={guestEmail}
                          onChange={(e) => setGuestEmail(e.target.value)}
                          placeholder="you@example.com"
                          required
                          maxLength={255}
                        />
                      </div>
                      <div>
                        <Label htmlFor="guest-phone" className="text-xs flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          Phone Number
                        </Label>
                        <Input
                          id="guest-phone"
                          type="tel"
                          value={guestPhone}
                          onChange={(e) => setGuestPhone(e.target.value)}
                          placeholder="(555) 123-4567"
                          maxLength={20}
                        />
                      </div>
                      <Button
                        type="submit"
                        className="w-full"
                        disabled={guestRsvpMutation.isPending}
                      >
                        {guestRsvpMutation.isPending ? "Submitting…" : "RSVP – I'm Going!"}
                      </Button>
                    </form>

                    <div className="relative my-4">
                      <Separator />
                      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground">
                        or
                      </span>
                    </div>

                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      onClick={() => navigate(`/auth?redirect=/calendar?event=${eventId}`)}
                    >
                      <LogIn className="h-4 w-4" />
                      Sign in to RSVP with your profile
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Paid event CTA */}
        {!isPast && !isFree && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <Card className="mt-4 border-border/50 shadow-lg bg-card/95 backdrop-blur-md">
              <CardContent className="p-5 text-center space-y-3">
                <Ticket className="h-10 w-10 text-primary mx-auto" />
                <h3 className="text-lg font-display font-semibold">Tickets: ${event.ticket_price}</h3>
                <p className="text-sm text-muted-foreground">
                  Sign in to the app to purchase tickets for this event.
                </p>
                <Button variant="outline" className="gap-2" onClick={() => navigate(`/auth?redirect=/calendar?event=${eventId}`)}>
                  <LogIn className="h-4 w-4" />
                  Sign In to Buy Tickets
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {isPast && (
          <Card className="mt-4 border-border/50 bg-muted/30">
            <CardContent className="p-5 text-center">
              <p className="text-sm text-muted-foreground">This event has already ended.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
