import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowUpRight, MessageCircle, Plane, Radio, UserCheck } from "lucide-react";
import { MessageRequestDialog } from "@/components/messages/MessageRequestDialog";
import { supabase } from "@/integrations/supabase/client";
import { tripBadge, type Person } from "@/lib/peopleDiscovery";
import { safeWebLink } from "@/lib/tripMoney";

/** A large swipe-deck profile card. Work previews load only for cards near the screen. */
export function ProfileCard({ person, near }: { person: Person; near: boolean }) {
  const [messaging, setMessaging] = useState(false);
  const work = useQuery({
    queryKey: ["discovery-work", person.user_id],
    enabled: near,
    staleTime: 5 * 60_000,
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
  const photo = safeWebLink(person.avatar_url);
  const place = person.live?.label || person.home?.label || person.city_display || person.city;
  return (
    <article
      className="relative flex h-full flex-col overflow-hidden rounded-[28px] bg-[#2c2731] text-white shadow-[0_24px_60px_-24px_rgba(0,0,0,.8)] ring-1 ring-white/10"
      aria-label={`${person.name}${person.role ? `, ${person.role}` : ""}${place ? `, ${place}` : ""}`}
    >
      <div className="relative min-h-0 flex-1 bg-gradient-to-br from-[#7b6a73] via-[#433a49] to-[#1f1c25]">
        {photo ? (
          <img src={photo} alt="" loading={near ? "eager" : "lazy"} className="absolute inset-0 h-full w-full object-cover" draggable={false} />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center font-display text-[120px] leading-none text-white/15" aria-hidden="true">
            {person.name.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/15 to-black/30" />
        <div className="absolute left-3 right-3 top-3 flex flex-wrap gap-1.5">
          {person.live && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#79c3cf] px-2.5 py-1 text-[11px] font-semibold text-[#0f2a2e]">
              <Radio size={12} /> In {person.live.label.split(",")[0]} now
            </span>
          )}
          {person.trip && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#faf4ed] px-2.5 py-1 text-[11px] font-semibold text-[#2c2731]">
              <Plane size={12} /> {tripBadge(person.trip)}
            </span>
          )}
          {person.liked && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#ff9fc8] px-2.5 py-1 text-[11px] font-semibold text-[#2c1320]">
              <UserCheck size={12} /> Connected
            </span>
          )}
        </div>
        <div className="absolute inset-x-0 bottom-0 p-5">
          <p className="text-[11px] uppercase tracking-[.2em] text-white/70">{place || "City not shared"}</p>
          <h3 className="mt-1 font-display text-[34px] leading-[1.05]">{person.name}</h3>
          {person.role && <p className="mt-1 text-sm font-medium text-[#ffc6de]">{person.role}</p>}
          {person.bio && <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-white/85">{person.bio}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2 p-3">
        <div className="flex min-w-0 flex-1 gap-2" aria-label="Work preview">
          {(work.data || []).map((item) => {
            const thumb = safeWebLink(item.thumbnail_url || (item.media_type === "image" ? item.media_url : null));
            return (
              <Link key={item.id} to={`/profile/${person.user_id}`} className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-white/10" title={item.title || "Work"}>
                {thumb ? <img src={thumb} alt={item.title || "Portfolio work"} loading="lazy" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-[9px] uppercase text-white/60">{item.media_type}</span>}
              </Link>
            );
          })}
          {!work.isLoading && !work.data?.length && <span className="min-w-0 self-center truncate text-xs text-white/50">No work yet</span>}
        </div>
        <button
          type="button"
          onClick={() => setMessaging(true)}
          className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full px-3 text-sm text-white/85 hover:bg-white/10"
          aria-label={`Message ${person.name}`}
        >
          <MessageCircle size={16} /> Message
        </button>
        <Link to={`/profile/${person.user_id}`} className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full px-3 text-sm text-white/85 hover:bg-white/10">
          Profile <ArrowUpRight size={16} />
        </Link>
        {messaging && <MessageRequestDialog person={person} open={messaging} onOpenChange={setMessaging} />}
      </div>
    </article>
  );
}
