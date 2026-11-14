import { Ticket, Users } from "lucide-react";

export function CreateEventChoice({ onChoose }: { onChoose: (mode: "tickets" | "rsvp") => void }) {
  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <h1 className="ether-title text-4xl">Let's launch your next event</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        You keep 100% of ticket revenue. Ether takes a 0% platform fee. Card processing is shown to the buyer as “incl. $X fees”, or you can absorb it on the next screen.
      </p>
      <div className="mt-6 grid gap-3">
        <button type="button" onClick={() => onChoose("tickets")} className="rounded-3xl border border-border/70 bg-card p-6 text-left">
          <Ticket className="h-6 w-6 text-primary" />
          <p className="mt-4 text-xl">Sell tickets</p>
          <p className="mt-1 text-sm text-muted-foreground">Set a price. Buyers pay by card, and you keep the ticket price.</p>
        </button>
        <button type="button" onClick={() => onChoose("rsvp")} className="rounded-3xl border border-border/70 bg-card p-6 text-left">
          <Users className="h-6 w-6 text-primary" />
          <p className="mt-4 text-xl">RSVP only</p>
          <p className="mt-1 text-sm text-muted-foreground">Free to join. No card.</p>
        </button>
      </div>
    </div>
  );
}
