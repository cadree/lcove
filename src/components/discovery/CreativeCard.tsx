import { ReportDialog } from "@/components/safety/ReportDialog";
import { useUserBlocks } from "@/hooks/useUserBlocks";
import { toast } from "sonner";
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Heart, X, ArrowUpRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { CreativePerson } from "@/lib/creativeDiscovery";
import { safeWebLink } from "@/lib/tripMoney";

export function CreativeCard({
  person,
  onSwipe,
  pending,
}: {
  person: CreativePerson;
  onSwipe: (liked: boolean) => void;
  pending: boolean;
}) {
  const [reportOpen, setReportOpen] = useState(false);
  const { blockUser } = useUserBlocks();
  const start = useRef<{ x: number; y: number } | null>(null);
  const work = useQuery({
    queryKey: ["discovery-work", person.user_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portfolio_items")
        .select("id,title,media_url,media_type,thumbnail_url")
        .eq("user_id", person.user_id)
        .order("display_order")
        .limit(3);
      if (error) throw error;
      return data;
    },
  });
  return (
    <article
      className="overflow-hidden rounded-[28px] border border-white/15 bg-[#28252e] text-white"
      aria-label={`${person.display_name || "Creative"} profile card`}
    >
      <div
        className="relative flex min-h-[320px] touch-pan-y flex-col justify-end overflow-hidden bg-gradient-to-br from-[#73666e] to-[#24232c] p-5"
        onPointerDown={(e) => {
          start.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerCancel={() => {
          start.current = null;
        }}
        onPointerUp={(e) => {
          if (start.current && !pending) {
            const dx = e.clientX - start.current.x;
            const dy = e.clientY - start.current.y;
            if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5)
              onSwipe(dx > 0);
          }
          start.current = null;
        }}
      >
        {safeWebLink(person.avatar_url) && (
          <img
            src={safeWebLink(person.avatar_url)}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/95 via-black/10 to-transparent" />
        <div className="relative">
          <p className="text-xs uppercase tracking-[.2em] text-white/75">
            {person.city || "City not shared"}
          </p>
          <h3 className="mt-2 font-display text-4xl">
            {person.display_name || "Creative"}
          </h3>
          <p className="mt-2 line-clamp-4 text-sm leading-relaxed">
            {person.bio || "Open their profile to explore their creative work."}
          </p>
        </div>
      </div>
      <div className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-[.16em] text-white/60">
            Selected work
          </p>
          <Link
            className="inline-flex min-h-11 items-center gap-1 text-sm"
            to={`/profile/${person.user_id}`}
          >
            Full profile <ArrowUpRight size={16} />
          </Link>
        </div>
        {work.isLoading ? (
          <p className="text-sm text-white/60">Loading work…</p>
        ) : work.isError ? (
          <p className="text-sm text-white/60">
            Work preview unavailable. Open their profile to try again.
          </p>
        ) : work.data?.length ? (
          <div className="grid grid-cols-3 gap-2">
            {work.data.map((item) => (
              <Link
                key={item.id}
                to={`/profile/${person.user_id}`}
                className="min-w-0 overflow-hidden rounded-xl bg-white/5"
              >
                {safeWebLink(
                  item.thumbnail_url ||
                    (item.media_type === "image" ? item.media_url : null)
                ) ? (
                  <img
                    loading="lazy"
                    className="aspect-square w-full object-cover"
                    src={safeWebLink(item.thumbnail_url || item.media_url)}
                    alt={item.title || "Portfolio work"}
                  />
                ) : (
                  <div className="flex aspect-square items-center justify-center text-xs">
                    {item.media_type}
                  </div>
                )}
                <p className="truncate px-2 py-1 text-xs">
                  {item.title || "View work"}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-white/60">No public work previews yet.</p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <button
            disabled={pending}
            onClick={() => onSwipe(false)}
            className="flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/20 disabled:opacity-40"
          >
            <X size={20} /> Pass
          </button>
          <button
            disabled={pending}
            onClick={() => onSwipe(true)}
            className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#d7e9dd] text-[#203328] disabled:opacity-40"
          >
            <Heart size={20} /> {person.liked ? "Liked" : "Connect"}
          </button>
        </div>
        <p className="text-center text-xs text-white/60">
          Swipe right to connect. A mutual like opens a chat.
        </p>
      </div>
      <div className="flex justify-center gap-5 border-t border-white/10 px-4">
        <button
          className="min-h-11 text-xs text-white/60"
          onClick={() => setReportOpen(true)}
        >
          Report profile
        </button>
        <button
          className="min-h-11 text-xs text-white/60"
          disabled={blockUser.isPending}
          onClick={() => {
            if (
              window.confirm(
                "Block this creative? They will disappear from discovery and any match will be removed."
              )
            )
              blockUser.mutate(person.user_id, {
                onError: (e: Error) => toast.error(e.message),
              });
          }}
        >
          Block
        </button>
      </div>
      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        targetType="profile"
        targetId={person.user_id}
      />
    </article>
  );
}
