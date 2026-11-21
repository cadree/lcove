const BITS = [
  { x: -22, y: -28, color: "#FF9FC8", delay: "0ms", round: true },
  { x: -36, y: -10, color: "#79C3CF", delay: "30ms", round: false },
  { x: -8, y: -32, color: "#FFD6E8", delay: "50ms", round: true },
  { x: -30, y: 8, color: "#E0B07A", delay: "20ms", round: true },
  { x: -46, y: -18, color: "#FF9FC8", delay: "70ms", round: false },
  { x: -14, y: -14, color: "#79C3CF", delay: "40ms", round: true },
  { x: -40, y: -30, color: "#FFD6E8", delay: "10ms", round: true },
  { x: 8, y: -20, color: "#E0B07A", delay: "60ms", round: false },
] as const;

/** Short CSS burst. Pointer events stay off so the feed can scroll. */
export function XpBurst() {
  return (
    <span className="xp-burst" aria-hidden="true">
      {BITS.map((bit, index) => (
        <i
          key={index}
          style={{
            background: bit.color,
            animationDelay: bit.delay,
            borderRadius: bit.round ? "999px" : "2px",
            ["--dx" as string]: `${bit.x}px`,
            ["--dy" as string]: `${bit.y}px`,
          }}
        />
      ))}
    </span>
  );
}
