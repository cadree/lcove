/** Soft drifting light for entry screens. Motion is CSS-only and pauses with reduced-motion. */
export function EntryAtmosphere() {
  return (
    <div className="entry-atmosphere" aria-hidden="true">
      <div className="entry-glow entry-glow-a" />
      <div className="entry-glow entry-glow-b" />
      <div className="entry-glow entry-glow-c" />
      <div className="entry-vignette" />
    </div>
  );
}
