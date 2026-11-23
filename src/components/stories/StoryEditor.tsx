import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ChevronLeft, Check, Type } from "lucide-react";
import {
  STORY_BACKGROUNDS,
  STORY_PILL_PAD_X,
  STORY_PILL_PAD_Y,
  STORY_TEXT_COLORS,
  STORY_TEXT_FONT_WEIGHT,
  STORY_TEXT_LINE_HEIGHT,
  STORY_TEXT_TRACKING,
  clampOverlayCenter,
  createStoryText,
  drawStoryOverlays,
  STORY_FRAME_HEIGHT,
  STORY_FRAME_WIDTH,
  fitStoryStage,
  installStoryWysiwygHook,
  layoutStoryText,
  pointerToNormalized,
  storyFontFamily,
  waitForStoryFonts,
  type StoryDrawContext,
  type StoryTextFont,
  type StoryTextOverlay,
  type StoryTextSize,
} from "@/lib/storyOverlay";
import { useNativeKeyboardInset } from "@/hooks/useNativeKeyboardInset";
import { cn } from "@/lib/utils";

const SIZES: StoryTextSize[] = ["s", "m", "l"];
const FONTS: { id: StoryTextFont; label: string }[] = [
  { id: "sans", label: "Sans" },
  { id: "serif", label: "Serif" },
  { id: "display", label: "Display" },
];

interface StoryEditorProps {
  previewUrl: string | null;
  mediaType: "photo" | "video";
  background: string;
  overlays: StoryTextOverlay[];
  onOverlaysChange: (overlays: StoryTextOverlay[]) => void;
  onBackgroundChange: (color: string) => void;
  onBack: () => void;
  onShare: () => void;
  sharing: boolean;
  textOnly: boolean;
}

export function StoryEditor({
  previewUrl,
  mediaType,
  background,
  overlays,
  onOverlaysChange,
  onBackgroundChange,
  onBack,
  onShare,
  sharing,
  textOnly,
}: StoryEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const [frameSize, setFrameSize] = useState(fitStoryStage(390, 693));
  const [fontsReady, setFontsReady] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(overlays[0]?.id ?? null);
  const [editing, setEditing] = useState(Boolean(textOnly && overlays[0] && !overlays[0].text));
  const dragRef = useRef<{ id: string; moved: boolean } | null>(null);
  const canEditText = mediaType === "photo";
  const selected = overlays.find((item) => item.id === selectedId) ?? null;
  const keyboardInset = useNativeKeyboardInset(editing && canEditText);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const update = () => setFrameSize(fitStoryStage(host.clientWidth, host.clientHeight));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void waitForStoryFonts().then(() => {
      if (!cancelled) setFontsReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    installStoryWysiwygHook({ overlays, background });
  }, [overlays, background]);

  useEffect(() => {
    if (!editing || keyboardInset <= 0) return;
    const input = textInputRef.current;
    if (!input) return;
    input.scrollIntoView({ block: "center", inline: "nearest" });
  }, [editing, keyboardInset, selectedId]);

  const scale = frameSize.width / STORY_FRAME_WIDTH;
  void fontsReady;

  useLayoutEffect(() => {
    const canvas = previewRef.current;
    if (!canvas || !canEditText) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(frameSize.width * dpr));
    canvas.height = Math.max(1, Math.round(frameSize.height * dpr));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, frameSize.width, frameSize.height);
    if (!fontsReady) return;
    const visible = overlays.filter((item) => item.text.trim() && !(editing && item.id === selectedId));
    if (!visible.length) return;
    ctx.save();
    ctx.scale(scale, scale);
    drawStoryOverlays(ctx as unknown as StoryDrawContext, visible, STORY_FRAME_WIDTH, STORY_FRAME_HEIGHT);
    ctx.restore();
  }, [overlays, frameSize.width, frameSize.height, fontsReady, canEditText, editing, selectedId, scale]);

  const update = (id: string, patch: Partial<StoryTextOverlay>) => {
    onOverlaysChange(overlays.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const addText = () => {
    const next = createStoryText({ text: "" });
    onOverlaysChange([...overlays, next]);
    setSelectedId(next.id);
    setEditing(true);
  };

  const removeSelected = () => {
    if (!selectedId) return;
    const next = overlays.filter((item) => item.id !== selectedId);
    onOverlaysChange(next);
    setSelectedId(next[0]?.id ?? null);
    setEditing(false);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>, id: string) => {
    if (event.button !== 0) return;
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* synthetic events in tests may not have a real pointer */
    }
    dragRef.current = { id, moved: false };
    setSelectedId(id);
    setEditing(false);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    const frame = frameRef.current;
    if (!drag || !frame) return;
    if (Math.abs(event.movementX) + Math.abs(event.movementY) > 2) drag.moved = true;
    const point = pointerToNormalized(event.clientX, event.clientY, frame.getBoundingClientRect());
    const current = overlays.find((item) => item.id === drag.id);
    if (!current) return;
    const next = clampOverlayCenter(
      { ...current, x: point.x, y: point.y },
      STORY_FRAME_WIDTH,
      STORY_FRAME_HEIGHT,
    );
    update(drag.id, next);
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLButtonElement>, id: string) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag && !drag.moved) {
      setSelectedId(id);
      setEditing(true);
    }
  };

  const shareDisabled = sharing || (textOnly && !overlays.some((item) => item.text.trim()));
  const chromePad = keyboardInset > 0
    ? `${keyboardInset}px`
    : "max(1rem, env(safe-area-inset-bottom, 0px))";

  return (
    <div
      className="relative flex h-full min-h-0 w-full flex-col bg-black text-white"
      data-story-stage="editor"
      data-story-fonts-ready={fontsReady ? "true" : "false"}
      data-story-keyboard-inset={keyboardInset}
    >
      <div ref={hostRef} className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black">
        <div
          ref={frameRef}
          data-story-frame
          className="relative overflow-hidden bg-black"
          style={{ width: frameSize.width, height: frameSize.height }}
        >
        {previewUrl && mediaType === "video" ? (
          <video src={previewUrl} className="absolute inset-0 h-full w-full object-cover" autoPlay loop muted playsInline />
        ) : previewUrl ? (
          <img src={previewUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0" style={{ background }} />
        )}

        {canEditText && (
          <canvas
            ref={previewRef}
            data-story-preview-canvas
            className="pointer-events-none absolute inset-0"
            style={{ width: frameSize.width, height: frameSize.height }}
          />
        )}

        {canEditText && overlays.map((item) => {
          const active = item.id === selectedId;
          const layout = layoutStoryText(item, STORY_FRAME_WIDTH, STORY_FRAME_HEIGHT);
          return (
            <button
              key={item.id}
              type="button"
              data-story-overlay={item.id}
              data-story-lines={layout.lines.map((line) => line.text).join("\n")}
              aria-label={item.text.trim() ? `Edit text, ${item.text}` : "Edit text"}
              className={cn(
                "absolute cursor-grab touch-none bg-transparent active:cursor-grabbing",
                active && !editing ? "ring-1 ring-white/50" : "ring-0",
              )}
              style={{
                left: layout.left * scale,
                top: layout.top * scale,
                width: layout.width * scale,
                height: layout.height * scale,
              }}
              onPointerDown={(event) => onPointerDown(event, item.id)}
              onPointerMove={onPointerMove}
              onPointerUp={(event) => onPointerUp(event, item.id)}
              onPointerCancel={(event) => onPointerUp(event, item.id)}
            >
              <span className="sr-only">{editing && active ? "Editing" : item.text || "Text"}</span>
            </button>
          );
        })}

        {editing && selected && canEditText && (
          <label
            className="absolute z-10 px-6"
            style={{
              left: 0,
              right: 0,
              top: keyboardInset > 0 ? "16%" : "33%",
            }}
          >
            <span className="sr-only">Story text</span>
            <textarea
              ref={textInputRef}
              data-story-text-input
              autoFocus
              rows={3}
              value={selected.text}
              onChange={(event) => update(selected.id, { text: event.target.value })}
              placeholder="Type something"
              className="w-full resize-none bg-transparent text-center text-[28px] leading-tight text-white outline-none placeholder:text-white/40"
              style={{
                color: selected.color,
                fontFamily: storyFontFamily(selected.font),
                fontWeight: STORY_TEXT_FONT_WEIGHT[selected.font],
                letterSpacing: `${STORY_TEXT_TRACKING[selected.font]}em`,
                lineHeight: STORY_TEXT_LINE_HEIGHT,
                padding: selected.pill ? `${STORY_PILL_PAD_Y}em ${STORY_PILL_PAD_X}em` : 0,
                textShadow: "0 1px 8px rgba(0,0,0,0.45)",
              }}
            />
          </label>
        )}
        </div>
      </div>

      <div
        className="z-10 flex shrink-0 flex-col gap-3 bg-gradient-to-t from-black/80 via-black/50 to-transparent px-3 pt-8"
        style={{ paddingBottom: chromePad }}
      >
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            data-story-back
            aria-label="Back"
            onClick={onBack}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-black/35 text-white ring-1 ring-white/15"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          {canEditText && editing && selected ? (
            <button
              type="button"
              data-story-text-done
              onClick={() => setEditing(false)}
              className="flex h-11 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-semibold normal-case text-black"
            >
              <Check className="h-4 w-4" />
              Done
            </button>
          ) : (
            <button
              type="button"
              data-story-share
              onClick={onShare}
              disabled={shareDisabled}
              className="flex h-11 items-center rounded-full bg-white px-6 text-sm font-semibold normal-case text-black hover:bg-white/90 disabled:opacity-50"
            >
              {sharing ? "Sharing..." : "Share story"}
            </button>
          )}
        </div>

        {canEditText && (
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-story-add-text
                aria-label="Add text"
                onClick={addText}
                className="flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-3 text-sm font-semibold tracking-wide ring-1 ring-white/15"
              >
                <Type className="h-4 w-4" />
                Aa
              </button>
              {SIZES.map((size) => (
                <button
                  key={size}
                  type="button"
                  data-story-size={size}
                  aria-label={`Text size ${size.toUpperCase()}`}
                  aria-pressed={selected?.size === size}
                  disabled={!selected}
                  onClick={() => selected && update(selected.id, { size })}
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold ring-1 ring-white/15",
                    selected?.size === size ? "bg-white text-black" : "bg-white/10 text-white disabled:opacity-40",
                  )}
                >
                  {size.toUpperCase()}
                </button>
              ))}
              {FONTS.map((font) => (
                <button
                  key={font.id}
                  type="button"
                  data-story-font={font.id}
                  aria-pressed={selected?.font === font.id}
                  disabled={!selected}
                  onClick={() => selected && update(selected.id, { font: font.id })}
                  className={cn(
                    "flex h-11 shrink-0 items-center rounded-full px-3 text-sm ring-1 ring-white/15 disabled:opacity-40",
                    selected?.font === font.id ? "bg-white text-black" : "bg-white/10 text-white",
                    font.id === "serif" && "font-lore",
                    font.id === "display" && "font-display",
                    font.id === "sans" && "font-body font-semibold",
                  )}
                >
                  {font.label}
                </button>
              ))}
              <button
                type="button"
                data-story-pill
                aria-pressed={selected?.pill === true}
                disabled={!selected}
                onClick={() => selected && update(selected.id, { pill: !selected.pill })}
                className={cn(
                  "flex h-11 shrink-0 items-center rounded-full px-3 text-sm font-semibold ring-1 ring-white/15 disabled:opacity-40",
                  selected?.pill ? "bg-white text-black" : "bg-white/10 text-white",
                )}
              >
                Background
              </button>
              {selected && (
                <button
                  type="button"
                  data-story-remove-text
                  onClick={removeSelected}
                  className="flex h-11 shrink-0 items-center rounded-full bg-white/10 px-3 text-sm font-semibold text-white ring-1 ring-white/15"
                >
                  Remove
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {STORY_TEXT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  data-story-color={color}
                  aria-label={`Text color ${color}`}
                  aria-pressed={selected?.color.toLowerCase() === color.toLowerCase()}
                  disabled={!selected}
                  onClick={() => selected && update(selected.id, { color })}
                  className={cn(
                    "h-8 w-8 shrink-0 rounded-full ring-2 ring-offset-2 ring-offset-black disabled:opacity-40",
                    selected?.color.toLowerCase() === color.toLowerCase() ? "ring-white" : "ring-white/20",
                  )}
                  style={{ background: color }}
                />
              ))}
            </div>
            {textOnly && (
              <div className="flex flex-wrap items-center gap-2">
                {STORY_BACKGROUNDS.map((color) => (
                  <button
                    key={`bg-${color}`}
                    type="button"
                    data-story-backdrop={color}
                    aria-label="Story background"
                    aria-pressed={background === color}
                    onClick={() => onBackgroundChange(color)}
                    className={cn(
                      "h-8 w-8 shrink-0 rounded-md ring-2 ring-offset-2 ring-offset-black",
                      background === color ? "ring-white" : "ring-white/20",
                    )}
                    style={{ background: color }}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
