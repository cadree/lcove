import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Headphones, Pause, Play, SkipForward, X } from "lucide-react";
import { ShareSheet } from "@/components/messages/ShareSheet";
import { ListeningNow } from "@/components/music/ListeningNow";
import { useListenMe } from "@/hooks/useListenMe";
import { useListenState } from "@/hooks/useListenTogether";
import { cardFromPlaying, newSessionId } from "@/lib/listenTogether";
import { leaveListening, startHosting } from "@/lib/listenRealtime";
import { useMusicPlayer } from "@/hooks/useMusicPlayer";
import { nextTrack, playerElement, stopPlayer, togglePlayer } from "@/lib/musicPlayer";

const HIDDEN_ON = [/^\/$/, /^\/auth/, /^\/onboarding/, /^\/live/];

/**
 * Mounted once at the app root. Keeps the shared audio element alive across
 * routes and shows what is playing above the tab bar.
 */
export function MusicMiniPlayer() {
  const player = useMusicPlayer();
  const me = useListenMe();
  const live = useListenState();
  const [sharing, setSharing] = useState(false);
  const shareCard = useMemo(
    () => (sharing && me ? cardFromPlaying(player.track, me.userId, newSessionId()) : null),
    // A new session id each time the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sharing, me?.userId, player.track?.id],
  );
  const { pathname } = useLocation();
  useEffect(() => {
    playerElement();
  }, []);
  const visible = !!player.track && !HIDDEN_ON.some((re) => re.test(pathname));
  // Pages leave room at the bottom so the last row is not hidden under the bar.
  useEffect(() => {
    document.documentElement.classList.toggle("has-mini-player", visible);
  }, [visible]);
  if (!visible || !player.track) return null;
  const canShare = !!me && player.track.id.startsWith("track:") && !!player.track.artistUserId;
  const hostName = live?.role === "guest" ? live.others.find((o) => o.userId === live.card.hostId)?.name : undefined;
  const progress = player.duration ? Math.min(100, (player.position / player.duration) * 100) : 0;
  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[45] flex justify-center px-3"
      style={{ bottom: "calc(84px + env(safe-area-inset-bottom, 0px) + 8px)" }}
      data-testid="music-mini-player"
    >
      <div className="pointer-events-auto relative flex w-full max-w-[460px] items-center gap-3 overflow-hidden rounded-[20px] border border-white/15 bg-[#1d1a22]/90 p-2 pr-1 text-[#faf5f0] shadow-[0_18px_40px_-18px_rgba(0,0,0,.9)] backdrop-blur-xl">
        <span className="block h-11 w-11 shrink-0 overflow-hidden rounded-[12px] bg-white/10">
          {player.track.artwork && <img src={player.track.artwork} alt="" className="h-full w-full object-cover" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold">{player.track.title}</span>
          {live && live.others.length > 0 ? (
            <ListeningNow others={live.others} label={live.role === "guest" ? `With ${hostName ?? live.others[0].name}${live.waiting ? " · paused" : ""}` : undefined} />
          ) : (
            <span className="block truncate text-[12px] text-white/60">
              {player.track.artist}
              {player.track.previewOnly ? " · preview" : ""}
              {live ? (live.role === "host" ? " · shared" : " · connecting") : ""}
            </span>
          )}
        </span>
        {live ? (
          <button type="button" onClick={leaveListening} aria-label={live.role === "host" ? "Stop listening together" : "Leave listening together"} className="flex h-11 w-9 shrink-0 items-center justify-center text-[#ff9fc8]">
            <Headphones className="h-4 w-4" />
          </button>
        ) : canShare ? (
          <button type="button" onClick={() => setSharing(true)} aria-label="Listen together with a friend" className="flex h-11 w-9 shrink-0 items-center justify-center" data-testid="listen-share">
            <Headphones className="h-4 w-4" />
          </button>
        ) : null}
        <button type="button" onClick={togglePlayer} aria-label={player.playing ? "Pause" : "Play"} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
          {player.playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="ml-0.5 h-5 w-5 fill-current" />}
        </button>
        <button type="button" onClick={nextTrack} disabled={player.index + 1 >= player.queue.length} aria-label="Next" className="flex h-11 w-9 shrink-0 items-center justify-center disabled:opacity-30">
          <SkipForward className="h-4 w-4 fill-current" />
        </button>
        <button type="button" onClick={stopPlayer} aria-label="Close player" className="flex h-11 w-9 shrink-0 items-center justify-center text-white/60">
          <X className="h-4 w-4" />
        </button>
        <span aria-hidden="true" className="absolute inset-x-3 bottom-0 h-[2px] overflow-hidden rounded-full bg-white/10">
          <span className="block h-full origin-left bg-[#ff9fc8]" style={{ transform: `scaleX(${progress / 100})` }} />
        </span>
      </div>
      <ShareSheet
        open={sharing}
        onOpenChange={setSharing}
        card={shareCard}
        linkUrl={shareCard ? `${window.location.origin}${shareCard.href}` : window.location.href}
        title="Listen together"
        description="Send this song. When your friend opens it, you both hear the same part at the same time."
        onSent={() => shareCard && me && startHosting(shareCard, me)}
      />
    </div>
  );
}
