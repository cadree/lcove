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
  clampTextScale,
  createStoryText,
  drawStoryOverlays,
  STORY_FRAME_HEIGHT,
  STORY_FRAME_WIDTH,
  fitStoryStage,
  installStoryWysiwygHook,
  layoutStoryText,
  overlayTransform,
  storyFontFamily,
  waitForStoryFonts,
  type StoryDrawContext,
  type StoryTextFont,
  type StoryTextOverlay,
  type StoryTextSize,
} from "@/lib/storyOverlay";
import { useNativeKeyboardInset } from "@/hooks/useNativeKeyboardInset";
import { useBlockPagePinch } from "@/hooks/useBlockPagePinch";
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
  /** Text tools on a clip recorded in the composer (burned in on share). */
  textOnVideo?: boolean;
  /** Front-camera clip: preview it mirrored, as it was filmed and will be saved. */
  videoMirror?: boolean;
  /** Screen zoom used while recording; the saved clip is cropped the same way. */
  videoZoom?: number;
  /** Share progress while a clip is being saved, 0 to 1. */
  shareProgress?: number | null;
}

interface TextGesture {
  id: string;
  /** Set when the first finger landed on this text: a lift without movement opens the editor. */
  tapId: string | null;
  /** First finger was on empty space: only a two-finger pinch moves the selected text. */
  pinchOnly: boolean;
  moved: boolean;
  startX: number;
  startY: number;
  startScale: number;
  startRotation: number;
  anchorX: number;
  anchorY: number;
  gap: number;
  angle: number;
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
  textOnVideo = false,
  videoMirror = false,
  videoZoom = 1,
  shareProgress = null,
}: StoryEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const [frameSize, setFrameSize] = useState(fitStoryStage(390, 693));
  const [fontsReady, setFontsReady] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(overlays[0]?.id ?? null);
  const [editing, setEditing] = useState(Boolean(textOnly && overlays[0] && !overlays[0].text));
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const gestureRef = useRef<TextGesture | null>(null);
  const canEditText = mediaType === "photo" || textOnVideo;
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

  const [frameNode, setFrameNode] = useState<HTMLDivElement | null>(null);
  useBlockPagePinch(frameNode, canEditText);

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

  /** Start (or restart, when a finger joins or lifts) from the fingers now down. */
  const rebaseline = (gesture: TextGesture) => {
    const current = overlays.find((item) => item.id === gesture.id);
    if (!current) return;
    const points = [...pointersRef.current.values()];
    const { scale: s0, rotation: r0 } = overlayTransform(current);
    gesture.startX = current.x;
    gesture.startY = current.y;
    gesture.startScale = s0;
    gesture.startRotation = r0;
    if (points.length >= 2) {
      const [a, b] = points;
      gesture.anchorX = (a.x + b.x) / 2;
      gesture.anchorY = (a.y + b.y) / 2;
      gesture.gap = Math.hypot(b.x - a.x, b.y - a.y);
      gesture.angle = Math.atan2(b.y - a.y, b.x - a.x);
    } else if (points.length === 1) {
      gesture.anchorX = points[0].x;
      gesture.anchorY = points[0].y;
    }
  };

  const onFramePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!canEditText) return;
    const target = event.target as HTMLElement;
    if (target.closest("textarea")) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const hitId = target.closest("[data-story-overlay]")?.getAttribute("data-story-overlay") ?? null;
    if (!gestureRef.current) {
      const id = hitId ?? (editing ? null : selectedId);
      if (!id) return;
      gestureRef.current = {
        id,
        tapId: hitId,
        pinchOnly: !hitId,
        moved: false,
        startX: 0,
        startY: 0,
        startScale: 1,
        startRotation: 0,
        anchorX: 0,
        anchorY: 0,
        gap: 0,
        angle: 0,
      };
      if (hitId) {
        setSelectedId(hitId);
        setEditing(false);
      }
    }
    event.preventDefault();
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* synthetic events in tests may not have a real pointer */
    }
    rebaseline(gestureRef.current);
  };

  const onFramePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    const frame = frameRef.current;
    if (!gesture || !frame || !pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const rect = frame.getBoundingClientRect();
    if (!(rect.width > 0) || !(rect.height > 0)) return;
    const points = [...pointersRef.current.values()];
    if (points.length >= 2) {
      const [a, b] = points;
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      const gap = Math.hypot(b.x - a.x, b.y - a.y);
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      gesture.moved = true;
      update(gesture.id, {
        x: clamp01(gesture.startX + (midX - gesture.anchorX) / rect.width),
        y: clamp01(gesture.startY + (midY - gesture.anchorY) / rect.height),
        scale: clampTextScale(gesture.startScale * (gesture.gap > 0 ? gap / gesture.gap : 1)),
        rotation: gesture.startRotation + (angle - gesture.angle),
      });
      return;
    }
    if (gesture.pinchOnly || points.length !== 1) return;
    const dx = points[0].x - gesture.anchorX;
    const dy = points[0].y - gesture.anchorY;
    if (!gesture.moved && Math.hypot(dx, dy) < 4) return;
    gesture.moved = true;
    update(gesture.id, {
      x: clamp01(gesture.startX + dx / rect.width),
      y: clamp01(gesture.startY + dy / rect.height),
    });
  };

  const onFramePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.delete(event.pointerId);
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      /* already released */
    }
    const gesture = gestureRef.current;
    if (!gesture) return;
    if (pointersRef.current.size > 0) {
      rebaseline(gesture);
      return;
    }
    gestureRef.current = null;
    if (gesture.tapId && !gesture.moved && event.type === "pointerup") {
      setSelectedId(gesture.tapId);
      setEditing(true);
    }
  };

  const shareDisabled = sharing || (textOnly && !overlays.some((item) => item.text.trim()));
  // The dialog already ends above the keyboard (useOverlayViewport), so never add the keyboard again here.
  const chromePad = keyboardInset > 0
    ? "0.75rem"
    : "max(1rem, env(safe-area-inset-bottom, 0px))";
  const videoTransform = [videoMirror ? "scaleX(-1)" : "", videoZoom > 1 ? `scale(${videoZoom})` : ""].filter(Boolean).join(" ");

  return (
    <div
      className="relative flex h-full min-h-0 w-full flex-col bg-black text-white"
      data-story-stage="editor"
      data-story-fonts-ready={fontsReady ? "true" : "false"}
      data-story-keyboard-inset={keyboardInset}
    >
      <div ref={hostRef} className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black">
        <div
          ref={(node) => {
            frameRef.current = node;
            setFrameNode(node);
          }}
          data-story-frame
          className={cn("relative overflow-hidden bg-black", canEditText && "touch-none select-none")}
          style={{ width: frameSize.width, height: frameSize.height }}
          onPointerDown={onFramePointerDown}
          onPointerMove={onFramePointerMove}
          onPointerUp={onFramePointerUp}
          onPointerCancel={onFramePointerUp}
        >
        {previewUrl && mediaType === "video" ? (
          <video
            src={previewUrl}
            data-story-video-preview
            className="absolute inset-0 h-full w-full object-cover"
            style={videoTransform ? { transform: videoTransform } : undefined}
            autoPlay
            loop
            muted
            playsInline
          />
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
          const { scale: textScale, rotation } = overlayTransform(item);
          return (
            <button
              key={item.id}
              type="button"
              data-story-overlay={item.id}
              data-story-lines={layout.lines.map((line) => line.text).join("\n")}
              data-press="none"
              aria-label={item.text.trim() ? `Edit text, ${item.text}` : "Edit text"}
              className={cn(
                "absolute cursor-grab touch-none rounded-md bg-transparent active:cursor-grabbing",
                active && !editing ? "ring-1 ring-white/50" : "ring-0",
              )}
              style={{
                left: layout.left * scale,
                top: layout.top * scale,
                width: layout.width * scale,
                height: layout.height * scale,
                transform: textScale !== 1 || rotation !== 0 ? `rotate(${rotation}rad) scale(${textScale})` : undefined,
                transformOrigin: "50% 50%",
              }}
              onClick={(event) => {
                // Keyboard and screen readers: Enter or Space opens the text.
                if (event.detail === 0) {
                  setSelectedId(item.id);
                  setEditing(true);
                }
              }}
            >
              <span className="sr-only">{editing && active ? "Editing" : item.text || "Text"}</span>
            </button>
          );
        })}

        </div>
        {editing && selected && canEditText && (
          <label
            className="absolute inset-0 z-20 flex items-center bg-black/45 px-6"
            data-story-text-editing
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

      <div
        onMouseDown={(event) => {
          // Keep the caption field focused (and the keyboard up) while tapping tools.
          if (editing && (event.target as HTMLElement).closest("button")) event.preventDefault();
        }}
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
              {sharing
                ? typeof shareProgress === "number" ? `Saving ${Math.round(shareProgress * 100)}%` : "Sharing..."
                : "Share story"}
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

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
