import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

export default function HostDoor() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: events = [] } = useQuery({
    queryKey: ["host-door", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("events").select("id, title, start_date").eq("creator_id", user!.id).order("start_date", { ascending: false });
      return data || [];
    },
  });
  if (!user) {
    navigate("/auth?redirect=/dashboard/events/door");
    return null;
  }
  return (
    <div className="min-h-screen bg-background px-4 py-6">
      <h1 className="ether-title text-3xl">In-person</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Scan the ticket QR at the door. The code is the same one on the confirmation and in the email. Card readers are not connected.
      </p>
      <ul className="mt-5 space-y-2">
        {events.map((event) => (
          <li key={event.id}>
            <Button variant="outline" className="h-auto w-full justify-between rounded-2xl px-4 py-3" onClick={() => navigate(`/dashboard/events/${event.id}`)}>
              <span className="text-left">{event.title}</span>
              <span className="text-xs text-muted-foreground">Scan</span>
            </Button>
          </li>
        ))}
        {events.length === 0 && <li className="text-sm text-muted-foreground">No events yet.</li>}
      </ul>
    </div>
  );
}
