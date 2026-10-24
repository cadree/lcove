import { useLocation } from "react-router-dom";
import { toneForPath } from "@/lib/screenTone";

/** Film grain, CRT scanlines, vignette, cyan scan band, and screen glows. */
export function WorldLayer() {
  const { pathname } = useLocation();
  const tone = toneForPath(pathname);

  return (
    <div className="world" data-tone={tone} aria-hidden="true">
      <div className="world-glow world-glow-a" />
      <div className="world-glow world-glow-b" />
      {tone === "blood" && <div className="world-grid" />}
      <div className="world-sweep" />
      <div className="world-scanlines" />
      <div className="world-grain" />
      <div className="world-vignette" />
    </div>
  );
}
