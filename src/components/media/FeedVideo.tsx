import { useEffect, useRef, useState, type VideoHTMLAttributes } from "react";
import { feedVideoSource, VIDEO_KEEP_MARGIN_PX } from "@/lib/videoWindow";

type Props = Omit<VideoHTMLAttributes<HTMLVideoElement>, "src" | "autoPlay"> & {
  src: string | null | undefined;
  /** Play only while most of it is on screen (reels). Only one plays at a time that way. */
  playWhenVisible?: boolean;
};

let observer: IntersectionObserver | null = null;
const watchers = new WeakMap<Element, (near: boolean) => void>();
let playObserver: IntersectionObserver | null = null;
const players = new WeakMap<Element, (visible: boolean) => void>();

function watchVisible(element: Element, onChange: (visible: boolean) => void) {
  if (typeof IntersectionObserver === "undefined") return () => undefined;
  playObserver ??= new IntersectionObserver(
    (entries) => entries.forEach((entry) => players.get(entry.target)?.(entry.intersectionRatio >= 0.6)),
    { threshold: [0, 0.6] },
  );
  players.set(element, onChange);
  playObserver.observe(element);
  return () => {
    players.delete(element);
    playObserver?.unobserve(element);
  };
}

function watch(element: Element, onChange: (near: boolean) => void) {
  if (typeof IntersectionObserver === "undefined") {
    onChange(true);
    return () => undefined;
  }
  observer ??= new IntersectionObserver(
    (entries) => entries.forEach((entry) => watchers.get(entry.target)?.(entry.isIntersecting)),
    { rootMargin: `${VIDEO_KEEP_MARGIN_PX}px 0px` },
  );
  watchers.set(element, onChange);
  observer.observe(element);
  return () => {
    watchers.delete(element);
    observer?.unobserve(element);
  };
}

/**
 * A muted feed video that only holds its source near the screen. Scrolling far
 * past it releases the media, which is what kept Safari's memory climbing.
 */
export function FeedVideo({ src, preload = "metadata", muted = true, playsInline = true, loop = true, playWhenVisible = false, ...props }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || !playWhenVisible) return;
    return watchVisible(element, (visible) => {
      if (visible && !document.hidden) void element.play().catch(() => undefined);
      else element.pause();
    });
  }, [playWhenVisible]);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    return watch(element, setNear);
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element || near) return;
    // Dropping the attribute is not enough; load() makes the browser let go of the buffer.
    if (element.getAttribute("src")) {
      element.pause();
      element.removeAttribute("src");
      element.load();
    }
  }, [near]);

  const source = feedVideoSource(src, near);
  return <video ref={ref} {...props} src={source} preload={near ? preload : "none"} muted={muted} playsInline={playsInline} loop={loop} />;
}
