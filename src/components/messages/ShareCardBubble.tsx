import { Link } from "react-router-dom";
import type { ShareCard } from "@/lib/shareCard";

const kindLabel: Record<ShareCard["kind"], string> = {
  post: "Post",
  story: "Story",
  project: "Project",
  reel: "Reel",
};

export function ShareCardBubble({ card }: { card: ShareCard }) {
  const video = card.mediaType === "video";
  return (
    <Link
      to={card.href}
      className="mb-1 block w-[min(70vw,260px)] overflow-hidden rounded-[16px] border border-border bg-card text-foreground"
    >
      {card.mediaUrl && (
        video ? (
          <video src={card.mediaUrl} className="aspect-[4/5] max-h-64 w-full bg-black object-contain" muted playsInline />
        ) : (
          <img src={card.mediaUrl} alt="" className="aspect-[4/5] max-h-64 w-full bg-muted object-contain" />
        )
      )}
      <span className="block px-3 py-2">
        <span className="mono-label text-[9px] text-muted-foreground">{kindLabel[card.kind]}</span>
        <span className="block truncate font-body text-sm font-extrabold">{card.title}</span>
        {card.subtitle && <span className="line-clamp-2 text-xs text-muted-foreground">{card.subtitle}</span>}
      </span>
    </Link>
  );
}
