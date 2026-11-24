import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowUpRight, MessageCircle, Plane, Radio, UserCheck } from "lucide-react";
import { MessageRequestDialog } from "@/components/messages/MessageRequestDialog";
import { supabase } from "@/integrations/supabase/client";
import { ConnectNudgeLine } from "@/components/people/ConnectMoment";
import { tripBadge, type Person } from "@/lib/peopleDiscovery";
import { OpenToChips } from "@/components/openTo/OpenToChips";
import type { ConnectNudge, IcebreakerMe } from "@/lib/connectMoment";
import { safeWebLink } from "@/lib/tripMoney";

/** The card in front of the match deck: role and latest work on top, then the photo. Work loads only for the front card. */
export function ProfileCard({ person, near, nudge, viewerId, me }: { person: Person; near: boolean; nudge?: ConnectNudge; viewerId?: string; me?: IcebreakerMe | null }) {
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
  const firstWork = work.data?.[0];
  const workThumb = firstWork ? safeWebLink(firstWork.thumbnail_url || (firstWork.media_type === "image" ? firstWork.media_url : null)) : null;
  return (
    <article
      className="relative flex h-full flex-col overflow-hidden rounded-[30px] border border-white/15 bg-[#3a3340]/85 p-2.5 text-white shadow-[0_30px_70px_-28px_rgba(0,0,0,.95)] backdrop-blur-xl"
      aria-label={`${person.name}${person.role ? `, ${person.role}` : ""}${place ? `, ${place}` : ""}`}
    >
      <header className="flex items-center justify-between gap-3 px-2 pb-2 pt-0.5">
        <p className="min-w-0 truncate text-[17px] font-medium text-white/90">{person.role || "Creative"}</p>
        {workThumb ? (
          <Link to={`/profile/${person.user_id}`} className="h-7 w-7 shrink-0 overflow-hidden rounded-[8px] ring-1 ring-white/50" title={firstWork?.title || "Work"}>
            <img src={workThumb} alt={firstWork?.title || "Latest work"} loading="lazy" className="h-full w-full object-cover" />
          </Link>
        ) : (
          <span className="mono-label shrink-0 text-[9px] text-white/45">{work.isLoading ? "" : "New here"}</span>
        )}
      </header>
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-[22px] bg-gradient-to-br from-[#7b6a73] via-[#433a49] to-[#1f1c25]">
        {photo ? (
          <img src={photo} alt="" loading={near ? "eager" : "lazy"} className="absolute inset-0 h-full w-full object-cover" draggable={false} />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center font-display text-[120px] leading-none text-white/15" aria-hidden="true">
            {person.name.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
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
        <div className="absolute inset-x-0 bottom-0 p-4">
          <p className="text-[11px] uppercase tracking-[.2em] text-white/70">{place || "City not shared"}</p>
          <h3 className="mt-1 font-display text-[32px] leading-[1.05]">{person.name}</h3>
          {!!person.open_to?.length && <OpenToChips tags={person.open_to} tone="photo" limit={3} className="mt-2" />}
          {person.bio && <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-white/85">{person.bio}</p>}
        </div>
      </div>
      {nudge && (
        <ConnectNudgeLine nudge={nudge} viewerId={viewerId} me={me} className="mx-1 mt-2" />
      )}
      <div className="flex items-center justify-end gap-1 px-1 pt-1.5">
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
