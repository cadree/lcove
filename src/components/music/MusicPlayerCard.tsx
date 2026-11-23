import { useMemo } from "react";
import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { usePrivateTrackUrl, type ExclusiveTrack } from "@/hooks/useExclusiveMusic";
import { useMusicPlayer } from "@/hooks/useMusicPlayer";
import { formatTime, nextTrack, playTrack, previousTrack, seekPlayer, togglePlayer, type PlayerTrack } from "@/lib/musicPlayer";
import { playableTrack } from "@/lib/musicView";

/**
 * The glass player card on a music profile. Plays through the app's one shared
 * player: the full file when the viewer already has access, otherwise the preview.
 */
export function MusicPlayerCard({ track, tracks, artist, hasAccess, onOpen }: {
  track: ExclusiveTrack | null;
  tracks: ExclusiveTrack[];
  artist: string;
  hasAccess: (trackId: string) => boolean;
  onOpen?: () => void;
}) {
  const player = useMusicPlayer();
  const full = usePrivateTrackUrl(track ?? { id: "none", audio_file_path: null }, !!track && hasAccess(track.id));
  const current = useMemo(() => (track ? playableTrack(track, artist, full.data) : null), [track, artist, full.data]);
  const queue = useMemo(() => {
    const list = tracks.map((t) => (t.id === track?.id ? current : playableTrack(t, artist, null))).filter(Boolean) as PlayerTrack[];
    return current && !list.some((t) => t.id === current.id) ? [current, ...list] : list;
  }, [tracks, track?.id, current, artist]);

  if (!track) return null;
  const mine = player.track && player.track.artistUserId === track.artist_user_id;
  const shown = mine ? player.track! : current;
  const isThis = !!mine;
  const playing = isThis && player.playing;
  const duration = isThis && player.duration ? player.duration : track.duration_seconds || 0;
  const position = isThis ? player.position : 0;
  const cover = shown?.artwork ?? track.cover_image_url;

  return (
    <section aria-label="Player" className="music-player rounded-[28px] border border-[var(--mv-line)] bg-[var(--mv-surface)] p-4 backdrop-blur-xl" data-testid="music-player-card">
      <button type="button" onClick={onOpen} className="music-player-art relative block aspect-square w-full overflow-hidden rounded-[22px] bg-black/30">
        {cover && <img src={cover} alt="" className="h-full w-full object-cover" />}
        <span className="absolute inset-x-6 bottom-6 rounded-[16px] border border-white/15 bg-black/45 px-4 py-3 text-center backdrop-blur-md">
          <span className="block truncate text-[20px] font-semibold uppercase tracking-[0.06em] text-white">{shown?.title ?? track.title}</span>
          <span className="block truncate text-[12px] uppercase tracking-[0.12em] text-white/70">{artist}</span>
        </span>
      </button>
      <div className="mt-4 text-center">
        <p className="truncate text-[22px] font-semibold uppercase tracking-[0.05em] text-[var(--mv-text)] [text-shadow:var(--mv-text-glow)]">{shown?.title ?? track.title}</p>
        <p className="truncate text-[13px] uppercase tracking-[0.12em] text-[var(--mv-muted)]">
          {artist}
          {(shown?.previewOnly ?? true) && current ? " · preview" : ""}
        </p>
      </div>
      <div className="mt-4">
        <input
          type="range"
          min={0}
          max={Math.max(1, Math.round(duration))}
          step={1}
          value={Math.min(Math.round(position), Math.round(duration) || 1)}
          onChange={(e) => isThis && seekPlayer(Number(e.target.value))}
          disabled={!isThis}
          aria-label="Seek"
          className="music-progress w-full"
          style={{ ["--mv-progress" as string]: `${duration ? (position / duration) * 100 : 0}%` }}
        />
        <div className="mt-1 flex justify-between text-[12px] tabular-nums text-[var(--mv-muted)]">
          <span>{formatTime(position)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-center gap-6">
        <button type="button" aria-label="Previous" disabled={!isThis} onClick={previousTrack} className="flex h-12 w-12 items-center justify-center text-[var(--mv-accent)] disabled:opacity-40">
          <SkipBack className="h-6 w-6 fill-current" />
        </button>
        <button
          type="button"
          aria-label={playing ? "Pause" : "Play"}
          disabled={!current && !isThis}
          onClick={() => (isThis ? togglePlayer() : current && void playTrack(current, queue))}
          className="music-play flex h-[72px] w-[72px] items-center justify-center rounded-full border-2 border-[var(--mv-accent)] bg-[var(--mv-surface-strong)] text-[var(--mv-text)] disabled:opacity-40"
        >
          {playing ? <Pause className="h-8 w-8 fill-current" /> : <Play className="ml-1 h-8 w-8 fill-current" />}
        </button>
        <button type="button" aria-label="Next" disabled={!isThis || player.index + 1 >= player.queue.length} onClick={nextTrack} className="flex h-12 w-12 items-center justify-center text-[var(--mv-accent)] disabled:opacity-40">
          <SkipForward className="h-6 w-6 fill-current" />
        </button>
      </div>
      {!current && <p className="mt-2 text-center text-xs text-[var(--mv-muted)]">No preview for this track yet.</p>}
    </section>
  );
}
