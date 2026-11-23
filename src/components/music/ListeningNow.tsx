import type { Listener } from "@/lib/listenTogether";

/** Small live marker: the other person's face with a pulse, and who is listening. */
export function ListeningNow({ others, label, tone = "dark" }: { others: Listener[]; label?: string; tone?: "dark" | "light" }) {
  if (!others.length) return null;
  const first = others[0];
  const text = label ?? (others.length === 1 ? `${first.name} listening now` : `${first.name} +${others.length - 1} listening now`);
  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 text-[11px] font-semibold ${tone === "dark" ? "text-white/80" : "text-foreground/80"}`} data-testid="listening-now">
      <span className="relative h-5 w-5 shrink-0">
        <span aria-hidden="true" className="listen-pulse absolute inset-0 rounded-full" />
        {first.avatar ? (
          <img src={first.avatar} alt="" className="relative h-5 w-5 rounded-full object-cover ring-1 ring-white/40" />
        ) : (
          <span className="relative flex h-5 w-5 items-center justify-center rounded-full bg-[#ff9fc8] text-[10px] text-[#1d1a22]">{first.name.slice(0, 1)}</span>
        )}
      </span>
      <span className="truncate">{text}</span>
    </span>
  );
}
