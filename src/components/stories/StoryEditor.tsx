import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ChevronLeft, Check, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  STORY_BACKGROUNDS,
  STORY_TEXT_COLORS,
  clampOverlayCenter,
  createStoryText,
  fontSizeFor,
  pointerToNormalized,
  type StoryTextFont,
  type StoryTextOverlay,
  type StoryTextSize,
} from "@/lib/storyOverlay";
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
  const frameRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(overlays[0]?.id ?? null);
  const [editing, setEditing] = useState(Boolean(textOnly && overlays[0] && !overlays[0].text));
  const dragRef = useRef<{ id: string; moved: boolean } | null>(null);
  const canEditText = mediaType === "photo";
  const selected = overlays.find((item) => item.id === selectedId) ?? null;

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
    event.currentTarget.setPointerCapture(event.pointerId);
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
      frame.clientWidth,
      frame.clientHeight,
      (text, font) => measureInEditor(text, font, frame.clientWidth),
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

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col bg-black text-white" data-story-stage="editor">
      <div ref={frameRef} className="relative min-h-0 flex-1 overflow-hidden bg-black">
        {previewUrl && mediaType === "video" ? (
          <video src={previewUrl} className="absolute inset-0 h-full w-full object-cover" autoPlay loop muted playsInline />
        ) : previewUrl ? (
          <img src={previewUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0" style={{ background }} />
        )}

        {canEditText && overlays.map((item) => {
          const active = item.id === selectedId;
          return (
            <button
              key={item.id}
              type="button"
              data-story-overlay={item.id}
              aria-label={item.text.trim() ? `Edit text, ${item.text}` : "Edit text"}
              className={cn(
                "absolute max-w-[80%] -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none text-center active:cursor-grabbing",
                active && !editing ? "outline outline-1 outline-white/70" : "outline-none",
              )}
              style={{
                left: `${item.x * 100}%`,
                top: `${item.y * 100}%`,
                color: item.color,
                fontSize: fontSizeFor(item.size, frameRef.current?.clientWidth || 390),
                fontFamily: fontFamily(item.font),
                fontWeight: item.font === "display" ? 500 : item.font === "serif" ? 600 : 650,
                letterSpacing: item.font === "display" ? "0.08em" : item.font === "sans" ? "0.01em" : 0,
                lineHeight: 1.15,
                textShadow: item.pill ? "none" : shadowFor(item.color),
                padding: item.pill ? "0.12em 0.45em" : 0,
                background: item.pill ? pillBackground(item.color) : "transparent",
                borderRadius: item.pill ? "999px" : 0,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
              onPointerDown={(event) => onPointerDown(event, item.id)}
              onPointerMove={onPointerMove}
              onPointerUp={(event) => onPointerUp(event, item.id)}
              onPointerCancel={(event) => onPointerUp(event, item.id)}
            >
              {editing && active ? (
                <span className="sr-only">Editing</span>
              ) : (
                item.text.trim() || <span className="opacity-50">Text</span>
              )}
            </button>
          );
        })}

        {editing && selected && canEditText && (
          <label className="absolute inset-x-0 top-1/3 z-10 px-6">
            <span className="sr-only">Story text</span>
            <textarea
              data-story-text-input
              autoFocus
              rows={3}
              value={selected.text}
              onChange={(event) => update(selected.id, { text: event.target.value })}
              placeholder="Type something"
              className="w-full resize-none bg-transparent text-center text-[28px] leading-tight text-white outline-none placeholder:text-white/40"
              style={{
                color: selected.color,
                fontFamily: fontFamily(selected.font),
                textShadow: "0 1px 8px rgba(0,0,0,0.45)",
              }}
            />
          </label>
        )}
      </div>

      <div
        className="z-10 flex shrink-0 flex-col gap-3 bg-gradient-to-t from-black/80 via-black/50 to-transparent px-3 pt-8"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))" }}
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
              className="flex h-11 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-semibold text-black"
            >
              <Check className="h-4 w-4" />
              Done
            </button>
          ) : (
            <Button
              data-story-share
              onClick={onShare}
              disabled={shareDisabled}
              className="h-11 rounded-full bg-white px-6 font-semibold text-black hover:bg-white/90 disabled:opacity-50"
            >
              {sharing ? "Sharing..." : "Share story"}
            </Button>
          )}
        </div>

        {canEditText && (
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
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
            <div className="flex items-center gap-2">
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
              {textOnly && STORY_BACKGROUNDS.map((color) => (
                <button
                  key={`bg-${color}`}
                  type="button"
                  data-story-backdrop={color}
                  aria-label="Story background"
                  aria-pressed={background === color}
                  onClick={() => onBackgroundChange(color)}
                  className={cn(
                    "ml-1 h-8 w-8 shrink-0 rounded-md ring-2 ring-offset-2 ring-offset-black",
                    background === color ? "ring-white" : "ring-white/20",
                  )}
                  style={{ background: color }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function fontFamily(font: StoryTextFont): string {
  if (font === "serif") return "Fraunces, Georgia, serif";
  if (font === "display") return "Cinzel, Georgia, serif";
  return "Archivo, system-ui, sans-serif";
}

function shadowFor(color: string): string {
  const light = color.toLowerCase() === "#ffffff" || color.toLowerCase() === "#f5e6c8" || color.toLowerCase() === "#e8a0bf";
  return light ? "0 1px 8px rgba(0,0,0,0.55)" : "0 1px 8px rgba(255,255,255,0.35)";
}

function pillBackground(color: string): string {
  const light = color.toLowerCase() === "#ffffff" || color.toLowerCase() === "#f5e6c8" || color.toLowerCase() === "#e8a0bf";
  return light ? "rgba(0,0,0,0.82)" : "rgba(255,255,255,0.94)";
}

let editorMeasureCanvas: HTMLCanvasElement | null = null;

function measureInEditor(text: string, font: string, frameWidth: number): number {
  if (typeof document === "undefined") return text.length * (frameWidth / 54);
  const canvas = editorMeasureCanvas ?? (editorMeasureCanvas = document.createElement("canvas"));
  const ctx = canvas.getContext("2d");
  if (!ctx) return text.length * (frameWidth / 54);
  ctx.font = font;
  return ctx.measureText(text).width;
}
