import { useRef, useState } from 'react';
import { Play, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Optional film, mounted only after a deliberate play. Closing unmounts audio. */
export function WaitingFilm() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <section aria-labelledby="waiting-film-title" className="my-9 w-full text-left">
      <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-black shadow-[0_16px_60px_rgba(0,0,0,0.4)]">
        {playing ? (
          <div>
            <video ref={videoRef} className="mx-auto max-h-[58dvh] w-full object-contain" controls autoPlay playsInline
              preload="metadata" poster="/films/ether-feeling-poster.jpg"
              onError={() => setFailed(true)} aria-label="ETHER — The Feeling Behind Creating">
              <source src="/films/ether-feeling.mp4" type="video/mp4" />
              <track kind="captions" src="/films/ether-feeling.en.vtt" srcLang="en" label="English" default />
            </video>
            {failed && <p role="alert" className="p-4 text-sm text-white/80">The film could not load. You can close it and try again. Your application is still under review.</p>}
            <Button variant="ghost" className="h-12 w-full text-white/80" onClick={() => { setPlaying(false); setFailed(false); }}>
              Close film
            </Button>
          </div>
        ) : (
          <button type="button" onClick={() => setPlaying(true)} aria-label="Watch the ETHER film"
            className="group relative flex aspect-[4/3] w-full flex-col items-center justify-center overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
            <img src="/films/ether-feeling-poster.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-65" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
            <span className="relative flex h-14 w-14 items-center justify-center rounded-full border border-white/50 bg-white/10 text-white backdrop-blur-sm transition-colors group-hover:bg-white/20">
              <Play className="ml-1 h-5 w-5" fill="currentColor" aria-hidden="true" />
            </span>
            <span className="absolute bottom-6 text-[10px] uppercase tracking-[0.28em] text-white/90">Watch the ETHER film</span>
          </button>
        )}
      </div>
      <h2 id="waiting-film-title" className="mt-5 text-center font-display text-xl leading-snug text-foreground">ETHER — The Feeling Behind Creating</h2>
      <p className="mt-2 text-center text-[10px] uppercase tracking-[0.16em] text-muted-foreground">18-second film · Optional viewing</p>
      <p className="mx-auto mt-5 max-w-xs text-center font-display text-lg italic leading-relaxed text-foreground/80">Creativity is more than what you make. It's a part of who you are.</p>
      <p className="mt-3 text-center text-xs leading-relaxed text-muted-foreground">An introduction to the spirit behind ETHER.</p>
      {playing && <Button variant="ghost" size="sm" className="mx-auto mt-2 flex" onClick={() => {
        const video = videoRef.current;
        if (video) { video.currentTime = 0; void video.play().catch(() => setFailed(true)); }
      }}><RotateCcw className="mr-2 h-3 w-3" /> Replay film</Button>}
    </section>
  );
}
