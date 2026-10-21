import { useEffect, useState } from "react";

export function NoviCelebration() {
  const [gained, setGained] = useState<number | null>(null);

  useEffect(() => {
    let timer = 0;
    const onXp = (event: Event) => {
      const detail = (event as CustomEvent<{ gained?: number }>).detail;
      const amount = Number(detail?.gained ?? 0);
      if (amount <= 0) return;
      setGained(amount);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setGained(null), 2400);
    };
    window.addEventListener("ether-novi-xp", onXp);
    return () => {
      window.removeEventListener("ether-novi-xp", onXp);
      window.clearTimeout(timer);
    };
  }, []);

  if (!gained) return null;
  return (
    <div
      role="status"
      className="pointer-events-none fixed left-1/2 top-16 z-[80] -translate-x-1/2 rounded-full bg-[linear-gradient(180deg,#FFD6E8,#FF9FC8)] px-4 py-2 font-body text-sm font-extrabold text-[#0A0A0A] shadow-lg"
    >
      +{gained} XP
    </div>
  );
}
