import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Headphones, LogOut, Pause, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LOCKED_MUSIC_BUCKET } from "@/lib/lockedMusic";
import { joinMode, type ListenCard } from "@/lib/listenTogether";
import { joinListening, leaveListening, startHosting } from "@/lib/listenRealtime";
import { playTrack, togglePlayer, type PlayerTrack } from "@/lib/musicPlayer";
import { useListenMe } from "@/hooks/useListenMe";
import { useListenState, useRoomListeners } from "@/hooks/useListenTogether";
import { useMusicPlayer } from "@/hooks/useMusicPlayer";
import { ListeningNow } from "@/components/music/ListeningNow";

const SERVICE: Record<Exclude<ListenCard["source"], "ether">, string> = {
  spotify: "Spotify",
  soundcloud: "SoundCloud",
  apple_music: "Apple Music",
};

/**
 * Resolve what this viewer may play, before the tap, so the tap itself can start
 * sound (iOS only allows audio that starts inside the gesture). The full file is
 * only ever a URL the storage server signed for this person.
 */
function useJoinTarget(card: ListenCard, enabled: boolean) {
  return useQuery({
    queryKey: ["listen-target", card.trackId],
    enabled: enabled && card.source === "ether" && !!card.trackId,
    staleTime: 40 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      const { data: track } = await supabase
        .from("exclusive_tracks")
        .select("id, title, cover_image_url, preview_clip_url, audio_file_path, artist_user_id")
        .eq("id", card.trackId as string)
        .maybeSingle();
      if (!track) return { fullUrl: null, previewUrl: null };
      let fullUrl: string | null = null;
      if (track.audio_file_path) {
        const signed = await supabase.storage.from(LOCKED_MUSIC_BUCKET).createSignedUrl(track.audio_file_path, 60 * 60);
        fullUrl = signed.data?.signedUrl ?? null;
      }
      return { fullUrl, previewUrl: (track.preview_clip_url as string | null) ?? null };
    },
  });
}

export function ListenCardBubble({ card }: { card: ListenCard }) {
  const me = useListenMe();
  const live = useListenState();
  const player = useMusicPlayer();
  const others = useRoomListeners(card.source === "ether" ? card.session : null, me?.userId);
  const isHost = me?.userId === card.hostId;
  const target = useJoinTarget(card, !!me && !isHost);
  const inThis = live?.card.session === card.session;
  const playerId = `track:${card.trackId}`;

  const mode = target.data
    ? joinMode({ source: card.source, hostPreviewOnly: !!card.hostPreview, fullUrl: target.data.fullUrl, previewUrl: target.data.previewUrl })
    : card.source === "ether" ? null : "link";

  const asTrack = (src: string, previewOnly: boolean): PlayerTrack => ({
    id: playerId,
    title: card.title,
    artist: card.artist,
    artwork: card.artwork,
    src,
    artistUserId: card.href.split("/")[2],
    previewOnly,
  });

  const join = () => {
    if (!me || !target.data) return;
    if (mode === "sync-full" && target.data.fullUrl) joinListening(card, me, asTrack(target.data.fullUrl, false));
    if (mode === "sync-preview" && target.data.previewUrl) joinListening(card, me, asTrack(target.data.previewUrl, true));
  };
  const preview = () => {
    if (!target.data?.previewUrl) return;
    if (player.track?.id === playerId) togglePlayer();
    else void playTrack(asTrack(target.data.previewUrl, true));
  };

  const othersHere = others.filter((o) => o.userId !== me?.userId);
  const hostHere = others.some((o) => o.userId === card.hostId);
  const button = "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full px-4 text-[13px] font-semibold";

  return (
    <div className="mb-1 w-[min(72vw,272px)] overflow-hidden rounded-[20px] border border-white/10 bg-[#1d1a22] p-3 text-[#faf5f0] shadow-[0_14px_30px_-20px_rgba(0,0,0,.8)]" data-testid="listen-card">
      <div className="flex items-center gap-3">
        <span className="relative block h-14 w-14 shrink-0 overflow-hidden rounded-[14px] bg-white/10">
          {card.artwork ? <img src={card.artwork} alt="" className="h-full w-full object-cover" /> : <Headphones className="m-4 h-6 w-6 text-white/60" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="mono-label block text-[9px] text-[#ff9fc8]">{card.source === "ether" ? "Listen together" : `On ${SERVICE[card.source]}`}</span>
          <span className="block truncate text-[15px] font-semibold">{card.title}</span>
          <span className="block truncate text-[12px] text-white/60">{card.artist}</span>
        </span>
      </div>

      {card.source === "ether" && (othersHere.length > 0 || inThis) && (
        <div className="mt-2.5 min-h-5">
          {othersHere.length > 0 ? <ListeningNow others={othersHere} /> : <span className="text-[11px] text-white/50">{isHost ? "Waiting for your friend" : "Connecting"}</span>}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {card.source !== "ether" && card.url && (
          <a href={card.url} target="_blank" rel="noopener noreferrer" className={`${button} bg-white text-[#1d1a22]`}>
            <ExternalLink className="h-4 w-4" /> Open in {SERVICE[card.source]}
          </a>
        )}

        {card.source === "ether" && isHost && (
          inThis ? (
            <button type="button" onClick={leaveListening} className={`${button} border border-white/20`}>
              <LogOut className="h-4 w-4" /> Stop sharing
            </button>
          ) : player.track?.id === playerId && me ? (
            <button type="button" onClick={() => startHosting(card, me)} className={`${button} bg-[#ff9fc8] text-[#1d1a22]`}>
              <Headphones className="h-4 w-4" /> Share again
            </button>
          ) : (
            <span className="text-[12px] text-white/50">You shared this</span>
          )
        )}

        {card.source === "ether" && !isHost && (
          inThis ? (
            <button type="button" onClick={leaveListening} className={`${button} border border-white/20`} data-testid="listen-leave">
              <LogOut className="h-4 w-4" /> Leave
            </button>
          ) : (mode === "sync-full" || mode === "sync-preview") && !hostHere ? (
            <span className="text-[12px] text-white/50" data-testid="listen-not-live">Not live right now</span>
          ) : mode === "sync-full" || mode === "sync-preview" ? (
            <button type="button" onClick={join} className={`${button} bg-[#ff9fc8] text-[#1d1a22]`} data-testid="listen-join">
              <Headphones className="h-4 w-4" /> Listen together
            </button>
          ) : mode === "preview-only" ? (
            <>
              <button type="button" onClick={preview} className={`${button} border border-white/20`}>
                {player.track?.id === playerId && player.playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />} 30s preview
              </button>
              <Link to={card.href} className={`${button} bg-[#ff9fc8] text-[#1d1a22]`}>Get the song</Link>
            </>
          ) : mode === "buy" ? (
            <Link to={card.href} className={`${button} bg-[#ff9fc8] text-[#1d1a22]`}>Get the song</Link>
          ) : (
            <span className="text-[12px] text-white/50">Checking access…</span>
          )
        )}
      </div>
      {card.source === "ether" && !isHost && mode === "preview-only" && (
        <p className="mt-2 text-[11px] leading-snug text-white/55">Listening together needs the full song. You can play the preview now.</p>
      )}
    </div>
  );
}

/** Thread banner while I am listening together with someone in this chat. */
export function ListeningStrip({ participantIds }: { participantIds: string[] }) {
  const live = useListenState();
  const player = useMusicPlayer();
  const withHere = live?.others.filter((o) => participantIds.includes(o.userId)) ?? [];
  if (!live || withHere.length === 0) return null;
  return (
    <div className="flex items-center gap-2 border-b border-border/30 bg-[#1d1a22] px-4 py-2 text-[#faf5f0]" data-testid="listening-strip">
      <ListeningNow others={withHere} label={`Listening now with ${withHere[0].name}`} />
      <span className="ml-auto truncate text-[11px] text-white/60">{player.track?.title ?? live.card.title}</span>
    </div>
  );
}
